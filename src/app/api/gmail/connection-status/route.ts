import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Google tokens from session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.provider_token) {
      return NextResponse.json({ 
        connected: false,
        error: 'No Google access token found',
        lastChecked: new Date().toISOString()
      })
    }

    try {
      // Initialize Gmail API with lightweight check
      const auth = new google.auth.OAuth2()
      auth.setCredentials({ access_token: session.provider_token })
      const gmail = google.gmail({ version: 'v1', auth })

      // Lightweight API call to check connection
      await gmail.users.getProfile({ userId: 'me' })
      
      return NextResponse.json({
        connected: true,
        lastChecked: new Date().toISOString()
      })

    } catch (gmailError: any) {
      console.error('Gmail connection check failed:', gmailError)
      
      // Check if it's an auth error
      const isAuthError = gmailError?.code === 401 || 
                         gmailError?.message?.includes('invalid_grant') ||
                         gmailError?.message?.includes('unauthorized')

      return NextResponse.json({
        connected: false,
        error: isAuthError ? 'Authentication expired' : 'Connection failed',
        lastChecked: new Date().toISOString(),
        needsReauth: isAuthError
      })
    }

  } catch (error) {
    console.error('Connection status API error:', error)
    return NextResponse.json({ 
      connected: false,
      error: 'Internal server error',
      lastChecked: new Date().toISOString()
    }, { status: 500 })
  }
}
