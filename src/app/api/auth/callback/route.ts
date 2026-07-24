import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  clearGoogleTokensFromMetadata,
  isGmailScopeError,
  persistGoogleTokens,
  safeAuthRedirectPath,
  verifyGmailAccess,
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

        const saved = await persistGoogleTokens(data.user.id, data.session.provider_token, {
          refreshToken: data.session.provider_refresh_token,
          // Provider token lifetime is typically ~1h; we don't get expiry from Supabase.
          expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
          scopes: 'openid email profile https://mail.google.com/',
        })

        if (!saved) {
          console.error('[auth/callback] Failed to persist Google tokens to vault')
        } else {
          console.info('[auth/callback] Google tokens saved to gmail_credentials', {
            savedRefreshToken: !!data.session.provider_refresh_token,
          })
        }

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
