import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import type { GmailMessage } from '@/types'
import { EmailContentParser } from '@/lib/email-parser'
import { getSyncProgress, setSyncProgress, isSyncRunning } from '@/lib/sync-progress'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if sync is already running for this user
    if (isSyncRunning(user.id)) {
      const currentProgress = getSyncProgress(user.id)
      return NextResponse.json({ 
        error: 'Sync already in progress',
        progress: currentProgress 
      }, { status: 409 })
    }

    // Get user's Google tokens from session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.provider_token) {
      return NextResponse.json({ 
        error: 'No Google access token found'
      }, { status: 400 })
    }

    // Initialize Gmail API
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: session.provider_token })
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
}

async function startFullSync(gmail: any, supabase: any, userId: string) {
  try {
    // Initialize progress tracking
    setSyncProgress(userId, { current: 0, total: 0, isRunning: true })

    // First, get total count of emails to process
    console.log('🔍 Getting total email count...')
    let totalMessages = 0
    let pageToken: string | undefined = undefined

    // Count all messages first
    do {
      const countResponse = await gmail.users.messages.list({
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

    // Now process all emails in batches
    let processedCount = 0
    pageToken = undefined

    do {
      // Get batch of message IDs
      const messagesResponse = await gmail.users.messages.list({
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

      // Process and store emails
      const processedEmails = validMessages.map((message) => {
        try {
          const headers = message.payload?.headers || []
          const fromHeader = headers.find(h => h.name === 'From')
          const subjectHeader = headers.find(h => h.name === 'Subject')
          const dateHeader = headers.find(h => h.name === 'Date')

          // Extract and decode email body content with robust parsing
          let fullBody = ''
          try {
            // Helper function to decode email content with proper encoding handling
            const decodeEmailContent = (data: string) => {
              try {
                // First decode from base64
                let decoded = Buffer.from(data, 'base64').toString('utf-8')
                
                // Simple decoding for quoted-printable soft line breaks
                decoded = decoded.replace(/=\r?\n/g, '')
                
                return decoded.trim()
              } catch (error) {
                console.warn('Failed to decode email content:', error)
                return ''
              }
            }

            if (message.payload?.body?.data) {
              // Simple text email
              const rawContent = decodeEmailContent(message.payload.body.data)
              fullBody = EmailContentParser.processEmailContent(rawContent)
            } else if (message.payload?.parts) {
              // Multi-part email - prioritize text/plain over text/html
              let plainTextContent = ''
              let htmlContent = ''
              
              for (const part of message.payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                  const partContent = decodeEmailContent(part.body.data)
                  plainTextContent += partContent + '\n'
                } else if (part.mimeType === 'text/html' && part.body?.data) {
                  htmlContent = decodeEmailContent(part.body.data)
                }
              }
              
              // Prioritize HTML for rich content, fallback to plain text
              if (htmlContent.trim()) {
                fullBody = EmailContentParser.processEmailContent(htmlContent)
              } else if (plainTextContent.trim()) {
                fullBody = EmailContentParser.processEmailContent(plainTextContent)
              }
            }
          } catch (bodyError) {
            console.warn(`⚠️ Failed to extract body for message ${message.id}:`, bodyError)
            fullBody = message.snippet || ''
          }

          const bodyPreview = fullBody || message.snippet || ''

          return {
            gmail_id: message.id,
            sender: fromHeader?.value || 'Unknown Sender',
            subject: subjectHeader?.value || 'No Subject',
            body_preview: bodyPreview,
            created_at: dateHeader?.value ? new Date(dateHeader.value).toISOString() : new Date().toISOString(),
            user_id: userId,
            read: false
          }
        } catch (error) {
          console.error('❌ Failed to process email:', error)
          return null
        }
      }).filter(email => email !== null)

      // Store batch in database
      if (processedEmails.length > 0) {
        const { error: dbError } = await supabase
          .from('emails')
          .upsert(processedEmails, { 
            onConflict: 'gmail_id,user_id',
            ignoreDuplicates: true
          })

        if (dbError) {
          console.error('❌ Database error:', dbError)
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
