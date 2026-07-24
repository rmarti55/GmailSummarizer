import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { getValidGoogleAccessToken, isGmailScopeError } from '@/lib/google-auth'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { session } } = await supabase.auth.getSession()

    console.info('[auth/gmail]', {
      hasUser: !!user,
      hasSession: !!session,
      hasProviderToken: !!session?.provider_token,
      hasMetadataToken: !!user.user_metadata?.google_access_token,
    })

    let accessToken: string | null
    try {
      accessToken = await getValidGoogleAccessToken(supabase, session, user)
    } catch (gmailError) {
      if (isGmailScopeError(gmailError)) {
        return NextResponse.json({
          connected: false,
          error: 'Gmail permission missing — reconnect to grant access',
          lastChecked: new Date().toISOString(),
          needsReauth: true,
        })
      }
      throw gmailError
    }

    console.info('[auth/gmail]', { hasAccessToken: !!accessToken })

    if (!accessToken) {
      return NextResponse.json({
        connected: false,
        error: 'No Google access token found',
        lastChecked: new Date().toISOString(),
        needsReauth: true,
      })
    }

    try {
      const auth = new google.auth.OAuth2()
      auth.setCredentials({ access_token: accessToken })
      const gmail = google.gmail({ version: 'v1', auth })

      await gmail.users.getProfile({ userId: 'me' })

      return NextResponse.json({
        connected: true,
        lastChecked: new Date().toISOString(),
      })
    } catch (gmailError: unknown) {
      const err = gmailError as { code?: number; message?: string }
      console.error('Gmail connection check failed:', gmailError)

      const isAuthError =
        err?.code === 401 ||
        err?.message?.includes('invalid_grant') ||
        err?.message?.includes('unauthorized')

      const isScopeError =
        err?.code === 403 ||
        err?.message?.includes('insufficient authentication scopes')

      return NextResponse.json({
        connected: false,
        error: isScopeError
          ? 'Gmail permission missing — reconnect to grant access'
          : isAuthError
            ? 'Authentication expired'
            : 'Connection failed',
        lastChecked: new Date().toISOString(),
        needsReauth: isAuthError || isScopeError,
      })
    }
  } catch (error) {
    console.error('Connection status API error:', error)
    return NextResponse.json({
      connected: false,
      error: 'Internal server error',
      lastChecked: new Date().toISOString(),
    }, { status: 500 })
  }
}
