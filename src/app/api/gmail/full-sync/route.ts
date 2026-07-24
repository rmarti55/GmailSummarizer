import { google, type gmail_v1 } from 'googleapis'
import { NextResponse } from 'next/server'
import type { GmailMessage } from '@/types'
import { EmailService } from '@/lib/email-service'
import { getSyncProgress, setSyncProgress, isSyncRunning } from '@/lib/sync-progress'
import { withAuthHandler } from '@/lib/auth-middleware'
import { createClient } from '@/lib/supabase/server'
import { getValidGoogleAccessToken } from '@/lib/google-auth'

type GmailListMessagesResponse = {
  data: gmail_v1.Schema$ListMessagesResponse
}

export const POST = withAuthHandler(async ({ user, supabase }) => {
  try {
    // Check if sync is already running for this user
    if (isSyncRunning(user.id)) {
      const currentProgress = getSyncProgress(user.id)
      return NextResponse.json({ 
        error: 'Sync already in progress',
        progress: currentProgress 
      }, { status: 409 })
    }

    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = await getValidGoogleAccessToken(supabase, session, user)

    console.info('[auth/gmail] full-sync', {
      hasProviderToken: !!session?.provider_token,
      hasMetadataToken: !!user.user_metadata?.google_access_token,
      hasAccessToken: !!accessToken,
    })

    if (!accessToken) {
      return NextResponse.json({
        error: 'No Google access token found',
      }, { status: 400 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    // Start sync process in background
    startFullSync(gmail, supabase, user.id)

    return NextResponse.json({ 
      message: 'Full sync started',
      status: 'running'
    })

  } catch (error) {
    console.error('Full sync API error:', error)
    return NextResponse.json({ error: 'Failed to start full sync' }, { status: 500 })
  }
})

async function startFullSync(
  gmail: gmail_v1.Gmail,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  try {
    // Initialize progress tracking
    setSyncProgress(userId, { current: 0, total: 0, isRunning: true })

    // First, get total count of emails to process
    console.log('🔍 Getting total email count...')
    let totalMessages = 0
    let pageToken: string | null | undefined = undefined

    // Count all messages first
    do {
      const countResponse: GmailListMessagesResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: 'in:inbox',
        pageToken
      })

      if (countResponse.data.messages) {
        totalMessages += countResponse.data.messages.length
      }
      pageToken = countResponse.data.nextPageToken
    } while (pageToken)

    console.log(`📊 Found ${totalMessages} total emails to process`)
    
    // Update progress with total count
    setSyncProgress(userId, { current: 0, total: totalMessages, isRunning: true })

    // Collect all Gmail IDs for cleanup
    console.log('🔍 Collecting all Gmail message IDs for cleanup...')
    const allGmailIds: string[] = []
    pageToken = undefined

    do {
      const idResponse: GmailListMessagesResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: 'in:inbox',
        pageToken
      })

      if (idResponse.data.messages) {
        allGmailIds.push(...idResponse.data.messages.map((msg: any) => msg.id))
      }
      pageToken = idResponse.data.nextPageToken
    } while (pageToken)

    console.log(`📋 Collected ${allGmailIds.length} Gmail IDs`)

    // Clean up stale emails before processing
    console.log('🗑️ Cleaning up stale emails...')
    const cleanupResult = await EmailService.cleanupStaleEmails(supabase, allGmailIds, userId)
    if (cleanupResult.success) {
      console.log(`✅ Cleanup complete: removed ${cleanupResult.deletedCount} stale emails`)
    } else {
      console.error('❌ Cleanup failed:', cleanupResult.error)
    }

    // Now process all emails in batches
    let processedCount = 0
    pageToken = undefined

    do {
      // Get batch of message IDs
      const messagesResponse: GmailListMessagesResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: 'in:inbox',
        pageToken
      })

      if (!messagesResponse.data.messages) {
        break
      }

      console.log(`📧 Processing batch of ${messagesResponse.data.messages.length} emails...`)

      // Fetch full details for this batch
      const emailPromises = messagesResponse.data.messages.map(async (message: any, index: number) => {
        try {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          })
          return messageResponse.data as GmailMessage
        } catch (error) {
          console.error(`❌ Failed to fetch message ${index + 1}: ${message.id}`, error)
          return null
        }
      })

      const gmailMessages = await Promise.all(emailPromises)
      const validMessages = gmailMessages.filter(msg => msg !== null)

      // Process emails using shared service
      const processedEmails = await EmailService.processGmailMessages(validMessages, userId)

      // Store batch in database using shared service
      if (processedEmails.length > 0) {
        const saveResult = await EmailService.saveEmailsToDatabase(supabase, processedEmails)
        if (!saveResult.success) {
          console.error('❌ Database error:', saveResult.error)
        } else {
          console.log(`✅ Saved batch of ${processedEmails.length} emails`)
        }
      }

      // Update progress
      processedCount += messagesResponse.data.messages.length
      setSyncProgress(userId, { 
        current: processedCount, 
        total: totalMessages, 
        isRunning: true 
      })

      console.log(`📈 Progress: ${processedCount}/${totalMessages} emails processed`)

      pageToken = messagesResponse.data.nextPageToken

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100))

    } while (pageToken)

    // Mark sync as complete
    setSyncProgress(userId, { 
      current: totalMessages, 
      total: totalMessages, 
      isRunning: false 
    })

    console.log(`🎉 Full sync complete! Processed ${totalMessages} emails`)

  } catch (error) {
    console.error('❌ Full sync error:', error)
    setSyncProgress(userId, { current: 0, total: 0, isRunning: false })
  }
}
