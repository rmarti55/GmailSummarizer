import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { origin } = new URL(request.url)
    
    // Get the redirect URL (where to go after successful auth)
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/dashboard'
    
    // Start OAuth flow with Google
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://mail.google.com/',
        redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })

    if (error) {
      console.error('OAuth signin error:', error)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    if (data.url) {
      // Redirect to Google OAuth
      return NextResponse.redirect(data.url)
    }

    // Fallback redirect
    return NextResponse.redirect(`${origin}/login`)

  } catch (error) {
    console.error('Signin API error:', error)
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/login?error=signin_failed`)
  }
}
