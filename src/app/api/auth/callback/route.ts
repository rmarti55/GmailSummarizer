import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  clearGoogleTokensFromMetadata,
  hasVaultRefreshToken,
  isGmailScopeError,
  persistGoogleTokens,
  safeAuthRedirectPath,
  verifyGmailAccess,
  verifyVaultRefreshAtLogin,
} from '@/lib/google-auth'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeAuthRedirectPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.info('[auth/callback]', {
      success: !error,
      hasProviderToken: !!data.session?.provider_token,
      hasRefreshToken: !!data.session?.provider_refresh_token,
      error: error?.message,
    })

    if (!error && data.session && data.user) {
      if (data.session.provider_token) {
        try {
          await verifyGmailAccess(data.session.provider_token)
        } catch (gmailError) {
          console.error('[auth/callback] Gmail scope verification failed:', gmailError)
          if (isGmailScopeError(gmailError)) {
            return NextResponse.redirect(`${origin}/login?error=gmail_scope_missing`)
          }
          return NextResponse.redirect(`${origin}/login?error=gmail_connection_failed`)
        }

        const hasProviderRefresh = Boolean(data.session.provider_refresh_token)
        const hasStoredRefresh = await hasVaultRefreshToken(data.user.id)
        const hasDurableRefresh = hasProviderRefresh || hasStoredRefresh

        if (!hasDurableRefresh) {
          console.error('[auth/callback] No durable refresh token — cannot stay connected', {
            hasProviderRefresh,
            hasStoredRefresh,
          })
          return NextResponse.redirect(`${origin}/login?error=gmail_refresh_missing`)
        }

        const saved = await persistGoogleTokens(data.user.id, data.session.provider_token, {
          refreshToken: data.session.provider_refresh_token,
          // Provider token lifetime is typically ~1h; we don't get expiry from Supabase.
          expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
          scopes: 'openid email profile https://mail.google.com/',
        })

        if (!saved) {
          console.error('[auth/callback] Failed to persist Google tokens to vault')
          return NextResponse.redirect(`${origin}/login?error=gmail_token_save_failed`)
        }

        const refreshCheck = await verifyVaultRefreshAtLogin(data.user.id)
        if (!refreshCheck.ok) {
          console.error('[auth/callback] Vault refresh verification failed', {
            code: refreshCheck.code,
            error: refreshCheck.error,
          })
          return NextResponse.redirect(`${origin}/login?error=gmail_connection_failed`)
        }

        console.info('[auth/callback] Google tokens saved to gmail_credentials', {
          savedRefreshToken: hasProviderRefresh || hasStoredRefresh,
          refreshVerified: true,
        })

        await clearGoogleTokensFromMetadata(supabase, data.user)
      } else {
        console.warn('[auth/callback] No provider_token in session after OAuth exchange')
        return NextResponse.redirect(`${origin}/login?error=gmail_scope_missing`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
