import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import type { GmailMessage } from '@/types'
import { EmailService } from '@/lib/email-service'
import { withAuthHandler } from '@/lib/auth-middleware'
import { getValidGoogleAccessToken } from '@/lib/google-auth'

export const GET = withAuthHandler(async ({ user, supabase }) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = await getValidGoogleAccessToken(supabase, session, user)

    console.info('[auth/gmail] sync', {
      hasSession: !!session,
      hasProviderToken: !!session?.provider_token,
      hasMetadataToken: !!user.user_metadata?.google_access_token,
      hasAccessToken: !!accessToken,
    })

    if (!accessToken) {
      return NextResponse.json({
        error: 'No Google access token found',
        debug: {
          hasSession: !!session,
          hasMetadataToken: !!user.user_metadata?.google_access_token,
        },
      }, { status: 400 })
    }

    // Get the most recent email timestamp from database
    const { data: latestEmail } = await supabase
      .from('emails')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Build Gmail query - only fetch emails newer than last sync
    let gmailQuery = 'in:inbox'
    if (latestEmail?.created_at) {
      // Convert to Gmail's date format (YYYY/MM/DD)
      const lastSyncDate = new Date(latestEmail.created_at)
      const gmailDateFormat = `${lastSyncDate.getFullYear()}/${String(lastSyncDate.getMonth() + 1).padStart(2, '0')}/${String(lastSyncDate.getDate()).padStart(2, '0')}`
      gmailQuery = `in:inbox after:${gmailDateFormat}`
      console.log(`🔄 Refreshing: fetching emails after ${gmailDateFormat}`)
    } else {
      console.log('📥 First sync: fetching recent emails')
    }

    // Initialize Gmail API
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    // Fetch emails from Gmail inbox
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100, // Increased to catch more new emails on refresh
      q: gmailQuery,
    })

    console.log('Gmail API response:', {
      messageCount: messagesResponse.data.messages?.length || 0,
      hasMessages: !!messagesResponse.data.messages
    })

    if (!messagesResponse.data.messages || messagesResponse.data.messages.length === 0) {
      return NextResponse.json({ 
        emails: [], 
        message: latestEmail ? 'No new emails since last sync' : 'No emails found in Gmail'
      })
    }

    console.log('📧 Starting to fetch full details for', messagesResponse.data.messages.length, 'messages')

    // Fetch full message details
    const emailPromises = messagesResponse.data.messages.map(async (message, index) => {
      try {
        console.log(`📩 Fetching message ${index + 1}/${messagesResponse.data.messages!.length}: ${message.id}`)
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        })
        console.log(`✅ Successfully fetched message ${index + 1}: ${message.id}`)
        return messageResponse.data as GmailMessage
      } catch (error) {
        console.error(`❌ Failed to fetch message ${index + 1}: ${message.id}`, error)
        return null
      }
    })

    console.log('⏳ Waiting for all message details...')
    const gmailMessages = await Promise.all(emailPromises)
    const validMessages = gmailMessages.filter(msg => msg !== null)
    console.log(`📊 Retrieved ${validMessages.length}/${gmailMessages.length} messages successfully`)

    // Process emails using shared service
    console.log('🔄 Processing email data...')
    const validProcessedEmails = await EmailService.processGmailMessages(validMessages, user.id)

    console.log(`📋 Successfully processed ${validProcessedEmails.length} emails for database save`)

    // Store emails in Supabase using shared service
    console.log('💾 Saving emails to database...')
    const saveResult = await EmailService.saveEmailsToDatabase(supabase, validProcessedEmails)

    if (!saveResult.success) {
      console.error('❌ Database error details:', JSON.stringify(saveResult.error, null, 2))
      return NextResponse.json({ error: 'Failed to save emails', dbError: saveResult.error }, { status: 500 })
    }

    console.log(`✅ Successfully saved ${saveResult.data?.length || 0} emails to database`)
    console.log('📤 Final response:', { emailCount: saveResult.data?.length || 0 })

    return NextResponse.json({ 
      emails: saveResult.data || [],
      message: latestEmail 
        ? `Synced ${saveResult.data?.length || 0} new emails` 
        : `Initial sync: ${saveResult.data?.length || 0} emails loaded`
    })

  } catch (error) {
    console.error('Gmail API error:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
})