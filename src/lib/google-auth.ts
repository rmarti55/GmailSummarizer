import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

export function getGoogleAccessToken(
  session: Session | null,
  user: User | null
): string | null {
  return (
    session?.provider_token ??
    (user?.user_metadata?.google_access_token as string | undefined) ??
    null
  )
}

export function getGoogleRefreshToken(
  session: Session | null,
  user: User | null
): string | null {
  return (
    session?.provider_refresh_token ??
    (user?.user_metadata?.google_refresh_token as string | undefined) ??
    null
  )
}

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

async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string }> {
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

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? undefined,
  }
}

async function persistGoogleTokens(
  supabase: SupabaseClient,
  accessToken: string,
  refreshToken?: string | null
): Promise<void> {
  const data: Record<string, string> = { google_access_token: accessToken }
  if (refreshToken) {
    data.google_refresh_token = refreshToken
  }

  const { error } = await supabase.auth.updateUser({ data })
  if (error) {
    console.error('[auth/gmail] Failed to persist refreshed Google tokens:', error.message)
  }
}

export async function verifyGmailAccess(accessToken: string): Promise<void> {
  const { google } = await import('googleapis')
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.getProfile({ userId: 'me' })
}

export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  session: Session | null,
  user: User
): Promise<string | null> {
  const accessToken = getGoogleAccessToken(session, user)
  const refreshToken = getGoogleRefreshToken(session, user)

  if (!accessToken && !refreshToken) {
    return null
  }

  if (accessToken) {
    try {
      await verifyGmailAccess(accessToken)
      return accessToken
    } catch (error) {
      if (isGmailScopeError(error)) {
        throw error
      }
      if (!isGoogleAuthError(error) || !refreshToken) {
        console.error('[auth/gmail] Gmail access check failed:', error)
        return null
      }
    }
  }

  if (!refreshToken) {
    return null
  }

  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken)
    await persistGoogleTokens(
      supabase,
      refreshed.accessToken,
      refreshed.refreshToken ?? refreshToken
    )
    console.info('[auth/gmail] refreshed Google access token')
    return refreshed.accessToken
  } catch (error) {
    console.error('[auth/gmail] Google token refresh failed:', error)
    return null
  }
}
