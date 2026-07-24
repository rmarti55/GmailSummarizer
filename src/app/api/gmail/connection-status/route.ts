import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  getGoogleRefreshToken,
  isGmailScopeError,
  resolveGoogleAccessToken,
} from '@/lib/google-auth'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { session } } = await supabase.auth.getSession()
    const hasRefreshToken = !!getGoogleRefreshToken(session, user)

    console.info('[auth/gmail] connection-status', {
      hasUser: !!user,
      hasSession: !!session,
      hasProviderToken: !!session?.provider_token,
      hasMetadataAccessToken: !!user.user_metadata?.google_access_token,
      hasMetadataRefreshToken: !!user.user_metadata?.google_refresh_token,
      hasRefreshToken,
    })

    try {
      const result = await resolveGoogleAccessToken(supabase, session, user)

      if (!result.ok) {
        console.info('[auth/gmail] connection-status failed', {
          code: result.code,
          needsReauth: result.needsReauth,
          hasRefreshToken,
        })

        return NextResponse.json({
          connected: false,
          error: result.error,
          code: result.code,
          lastChecked: new Date().toISOString(),
          needsReauth: result.needsReauth,
        })
      }

      // resolveGoogleAccessToken already verified via getProfile — no second check.
      return NextResponse.json({
        connected: true,
        lastChecked: new Date().toISOString(),
      })
    } catch (gmailError) {
      if (isGmailScopeError(gmailError)) {
        return NextResponse.json({
          connected: false,
          error: 'Gmail permission missing — reconnect to grant access',
          code: 'missing_scopes',
          lastChecked: new Date().toISOString(),
          needsReauth: true,
        })
      }
      throw gmailError
    }
  } catch (error) {
    console.error('Connection status API error:', error)
    return NextResponse.json({
      connected: false,
      error: 'Internal server error',
      lastChecked: new Date().toISOString(),
      needsReauth: false,
    }, { status: 500 })
  }
}
