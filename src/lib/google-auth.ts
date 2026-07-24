import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type GoogleTokenFailureCode =
  | 'missing_tokens'
  | 'missing_refresh_token'
  | 'token_refresh_failed'
  | 'transient_error'

export type GoogleTokenResult =
  | { ok: true; accessToken: string }
  | {
      ok: false
      code: GoogleTokenFailureCode
      error: string
      needsReauth: boolean
    }

interface GmailCredentialsRow {
  user_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string
  scopes: string | null
  updated_at: string
}

/** Refresh ~60s before Google's expiry to avoid racey 401s. */
const EXPIRY_SKEW_MS = 60_000
/** Google access tokens are typically ~1h; used when expiry is unknown. */
const DEFAULT_ACCESS_TOKEN_TTL_MS = 55 * 60 * 1000

const METADATA_TOKEN_KEYS = ['google_access_token', 'google_refresh_token'] as const

export function isGmailScopeError(error: unknown): boolean {
  const err = error as { code?: number; message?: string }
  return (
    err?.code === 403 &&
    (err?.message?.includes('insufficient authentication scopes') ?? false)
  )
}

export function isGoogleAuthError(error: unknown): boolean {
  const err = error as { code?: number; message?: string }
  if (isGmailScopeError(error)) return false

  const message = err?.message?.toLowerCase() ?? ''
  return (
    err?.code === 401 ||
    message.includes('invalid_grant') ||
    message.includes('unauthorized') ||
    message.includes('invalid credentials') ||
    message.includes('token has been expired') ||
    message.includes('token has been revoked')
  )
}

function isInvalidGrantError(error: unknown): boolean {
  const message = (error as { message?: string })?.message?.toLowerCase() ?? ''
  return message.includes('invalid_grant') || message.includes('token has been revoked')
}

function isAccessTokenFresh(expiresAt: string | Date): boolean {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime()
  return expiry - EXPIRY_SKEW_MS > Date.now()
}

function defaultExpiresAt(fromMs = Date.now()): string {
  return new Date(fromMs + DEFAULT_ACCESS_TOKEN_TTL_MS).toISOString()
}

function metadataHasGoogleTokens(user: User): boolean {
  return METADATA_TOKEN_KEYS.some((key) => Boolean(user.user_metadata?.[key]))
}

async function getVaultCredentials(userId: string): Promise<GmailCredentialsRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gmail_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[auth/gmail] Failed to read gmail_credentials:', error.message)
    return null
  }

  return data as GmailCredentialsRow | null
}

export async function hasVaultRefreshToken(userId: string): Promise<boolean> {
  const row = await getVaultCredentials(userId)
  return Boolean(row?.refresh_token)
}

export async function persistGoogleTokens(
  userId: string,
  accessToken: string,
  options?: {
    refreshToken?: string | null
    expiresAt?: string | Date | null
    scopes?: string | null
  }
): Promise<boolean> {
  const admin = createAdminClient()
  const existing = await getVaultCredentials(userId)

  // Never overwrite a stored refresh token with null — Google often omits it on re-login.
  const refreshToken = options?.refreshToken || existing?.refresh_token || null

  const expiresAt =
    options?.expiresAt != null
      ? typeof options.expiresAt === 'string'
        ? options.expiresAt
        : options.expiresAt.toISOString()
      : defaultExpiresAt()

  const { error } = await admin.from('gmail_credentials').upsert(
    {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scopes: options?.scopes ?? existing?.scopes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[auth/gmail] Failed to persist gmail_credentials:', error.message)
    return false
  }

  return true
}

/** Remove google_* keys from user_metadata so they leave the JWT / browser session. */
export async function clearGoogleTokensFromMetadata(
  supabase: SupabaseClient,
  user: User
): Promise<void> {
  if (!metadataHasGoogleTokens(user)) return

  const { error } = await supabase.auth.updateUser({
    data: {
      google_access_token: null,
      google_refresh_token: null,
    },
  })

  if (error) {
    console.error('[auth/gmail] Failed to clear metadata tokens:', error.message)
  } else {
    console.info('[auth/gmail] Cleared google_* tokens from user_metadata')
  }
}

/**
 * One-time migrate: copy tokens from user_metadata / session into the vault, then scrub metadata.
 */
export async function migrateLegacyGoogleTokens(
  supabase: SupabaseClient,
  session: Session | null,
  user: User
): Promise<GmailCredentialsRow | null> {
  const existing = await getVaultCredentials(user.id)
  if (existing?.access_token || existing?.refresh_token) {
    if (metadataHasGoogleTokens(user)) {
      await clearGoogleTokensFromMetadata(supabase, user)
    }
    return existing
  }

  const accessToken =
    (user.user_metadata?.google_access_token as string | undefined) ??
    session?.provider_token ??
    null
  const refreshToken =
    (user.user_metadata?.google_refresh_token as string | undefined) ??
    session?.provider_refresh_token ??
    null

  if (!accessToken && !refreshToken) {
    return null
  }

  // With a refresh token, mark access expired so the next resolve refreshes cleanly.
  // Access-only migrate: keep a short usable window until re-consent is needed.
  const expiresAt = refreshToken
    ? defaultExpiresAt(Date.now() - DEFAULT_ACCESS_TOKEN_TTL_MS)
    : defaultExpiresAt()

  if (accessToken) {
    await persistGoogleTokens(user.id, accessToken, {
      refreshToken,
      expiresAt,
    })
  } else if (refreshToken) {
    // Access missing: store a placeholder that forces refresh on next resolve.
    await persistGoogleTokens(user.id, 'pending_refresh', {
      refreshToken,
      expiresAt,
    })
  }

  await clearGoogleTokensFromMetadata(supabase, user)
  console.info('[auth/gmail] Migrated legacy tokens into gmail_credentials', {
    userId: user.id,
    hadAccessToken: !!accessToken,
    hadRefreshToken: !!refreshToken,
  })

  return getVaultCredentials(user.id)
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt: string
}> {
  const { google } = await import('googleapis')
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh Google access token')
  }

  const expiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date).toISOString()
    : defaultExpiresAt()

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? undefined,
    expiresAt,
  }
}

async function tryRefresh(userId: string, refreshToken: string): Promise<GoogleTokenResult> {
  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken)
    const saved = await persistGoogleTokens(userId, refreshed.accessToken, {
      refreshToken: refreshed.refreshToken ?? refreshToken,
      expiresAt: refreshed.expiresAt,
    })
    if (!saved) {
      console.error('[auth/gmail] Refreshed token but failed to persist to vault')
    } else {
      console.info('[auth/gmail] refreshed Google access token')
    }
    return { ok: true, accessToken: refreshed.accessToken }
  } catch (error) {
    console.error('[auth/gmail] Google token refresh failed:', error)
    if (isInvalidGrantError(error) || isGoogleAuthError(error)) {
      return {
        ok: false,
        code: 'token_refresh_failed',
        error: 'Google authentication expired — reconnect Gmail',
        needsReauth: true,
      }
    }
    return {
      ok: false,
      code: 'transient_error',
      error: 'Could not refresh Gmail connection — try again shortly',
      needsReauth: false,
    }
  }
}

export async function verifyGmailAccess(accessToken: string): Promise<void> {
  const { google } = await import('googleapis')
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.getProfile({ userId: 'me' })
}

/**
 * Resolve a usable Google access token from the server-only vault.
 * Uses expires_at for the happy path (no Gmail network call).
 * Migrates legacy user_metadata tokens on first use.
 */
export async function resolveGoogleAccessToken(
  supabase: SupabaseClient,
  session: Session | null,
  user: User,
  options?: { forceRefresh?: boolean }
): Promise<GoogleTokenResult> {
  let credentials = await getVaultCredentials(user.id)

  if (!credentials) {
    credentials = await migrateLegacyGoogleTokens(supabase, session, user)
  } else if (metadataHasGoogleTokens(user)) {
    await clearGoogleTokensFromMetadata(supabase, user)
  }

  // Fresh provider tokens from the current OAuth session (e.g. right after login)
  // before the callback has persisted — prefer session when vault is empty.
  if (!credentials) {
    const sessionAccess = session?.provider_token ?? null
    const sessionRefresh = session?.provider_refresh_token ?? null

    if (!sessionAccess && !sessionRefresh) {
      return {
        ok: false,
        code: 'missing_tokens',
        error: 'No Google access token found',
        needsReauth: true,
      }
    }

    if (sessionAccess && !options?.forceRefresh) {
      await persistGoogleTokens(user.id, sessionAccess, {
        refreshToken: sessionRefresh,
        expiresAt: defaultExpiresAt(),
      })
      return { ok: true, accessToken: sessionAccess }
    }

    if (!sessionRefresh) {
      return {
        ok: false,
        code: 'missing_refresh_token',
        error: 'Google authentication expired — reconnect Gmail',
        needsReauth: true,
      }
    }

    return tryRefresh(user.id, sessionRefresh)
  }

  const isFresh =
    !!credentials.access_token &&
    credentials.access_token !== 'pending_refresh' &&
    isAccessTokenFresh(credentials.expires_at)

  console.info('[auth/gmail] resolve', {
    userId: user.id,
    hasAccessToken: !!credentials.access_token,
    hasRefreshToken: !!credentials.refresh_token,
    expiresAt: credentials.expires_at,
    isFresh,
    forceRefresh: !!options?.forceRefresh,
  })

  if (isFresh && !options?.forceRefresh) {
    return { ok: true, accessToken: credentials.access_token }
  }

  if (!credentials.refresh_token) {
    return {
      ok: false,
      code: 'missing_refresh_token',
      error: 'Google authentication expired — reconnect Gmail',
      needsReauth: true,
    }
  }

  return tryRefresh(user.id, credentials.refresh_token)
}

/** @deprecated Prefer resolveGoogleAccessToken for distinct error handling */
export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  session: Session | null,
  user: User
): Promise<string | null> {
  const result = await resolveGoogleAccessToken(supabase, session, user)
  return result.ok ? result.accessToken : null
}

/** Safe same-origin path for OAuth redirects (blocks open redirects). */
export function safeAuthRedirectPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback
  if (!/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(next)) return fallback
  return next
}
