import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { origin } = new URL(request.url)

    // Get the redirect URL (where to go after successful auth)
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/dashboard'
    const forceConsent = request.nextUrl.searchParams.get('consent') === 'true'

    // Offline refresh tokens are unreliable without consent. Force consent when
    // explicitly requested, on first login, or when no refresh token is stored.
    const { data: { user } } = await supabase.auth.getUser()
    const hasStoredRefreshToken = !!user?.user_metadata?.google_refresh_token
    const useConsent = forceConsent || !user || !hasStoredRefreshToken

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'openid email profile https://mail.google.com/',
        queryParams: {
          access_type: 'offline',
          prompt: useConsent ? 'consent' : 'select_account',
        },
        redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })

    console.info('[auth/signin]', {
      useConsent,
      hasUser: !!user,
      hasStoredRefreshToken,
    })

    if (error) {
      console.error('OAuth signin error:', error)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    if (data.url) {
      return NextResponse.redirect(data.url)
    }

    return NextResponse.redirect(`${origin}/login`)
  } catch (error) {
    console.error('Signin API error:', error)
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/login?error=signin_failed`)
  }
}
