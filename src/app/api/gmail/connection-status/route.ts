import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  hasVaultRefreshToken,
  isGmailScopeError,
  isGoogleAuthError,
  resolveGoogleAccessToken,
  verifyGmailAccess,
} from '@/lib/google-auth'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { session } } = await supabase.auth.getSession()
    const hasRefreshToken = await hasVaultRefreshToken(user.id)

    console.info('[auth/gmail] connection-status', {
      hasUser: !!user,
      hasSession: !!session,
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

      try {
        // Explicit connectivity check (not done on every sync/delete resolve).
        await verifyGmailAccess(result.accessToken)
      } catch (verifyError) {
        if (isGmailScopeError(verifyError)) throw verifyError

        // expires_at said fresh but Google rejected — force refresh once, then re-verify.
        if (isGoogleAuthError(verifyError) && hasRefreshToken) {
          const refreshed = await resolveGoogleAccessToken(supabase, session, user, {
            forceRefresh: true,
          })
          if (!refreshed.ok) {
            return NextResponse.json({
              connected: false,
              error: refreshed.error,
              code: refreshed.code,
              lastChecked: new Date().toISOString(),
              needsReauth: refreshed.needsReauth,
            })
          }
          await verifyGmailAccess(refreshed.accessToken)
        } else {
          throw verifyError
        }
      }

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

      console.error('[auth/gmail] connection-status verify failed:', gmailError)
      return NextResponse.json({
        connected: false,
        error: 'Gmail connection check failed',
        lastChecked: new Date().toISOString(),
        needsReauth: isGoogleAuthError(gmailError),
      })
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
