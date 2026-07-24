import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isGmailScopeError, verifyGmailAccess } from '@/lib/google-auth'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.info('[auth/callback]', {
      success: !error,
      hasProviderToken: !!data.session?.provider_token,
      hasRefreshToken: !!data.session?.provider_refresh_token,
      error: error?.message,
    })

    if (!error && data.session) {
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

        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            google_access_token: data.session.provider_token,
            google_refresh_token: data.session.provider_refresh_token ?? null,
          },
        })

        if (updateError) {
          console.error('[auth/callback] Failed to persist Google tokens:', updateError.message)
        } else {
          console.info('[auth/callback] Google tokens saved to user metadata')
        }
      } else {
        console.warn('[auth/callback] No provider_token in session after OAuth exchange')
        return NextResponse.redirect(`${origin}/login?error=gmail_scope_missing`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
