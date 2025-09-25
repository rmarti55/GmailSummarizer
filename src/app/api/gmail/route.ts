import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import type { GmailMessage } from '@/types'
import { EmailContentParser } from '@/lib/email-parser'

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
    console.log('Session data:', { 
      hasSession: !!session, 
      hasProviderToken: !!session?.provider_token,
      provider: session?.user?.app_metadata?.provider 
    })
    
    if (!session?.provider_token) {
      return NextResponse.json({ 
        error: 'No Google access token found', 
        debug: { hasSession: !!session, provider: session?.user?.app_metadata?.provider }
      }, { status: 400 })
    }

    // Initialize Gmail API
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: session.provider_token })
    const gmail = google.gmail({ version: 'v1', auth })

    // Fetch emails from Gmail inbox (all categories)
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'in:inbox', // Gets all inbox emails regardless of tab
    })

    console.log('Gmail API response:', {
      messageCount: messagesResponse.data.messages?.length || 0,
      hasMessages: !!messagesResponse.data.messages
    })

    if (!messagesResponse.data.messages) {
      return NextResponse.json({ emails: [], debug: 'No messages found in Gmail' })
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

    // Process and store emails
    console.log('🔄 Processing email data...')
    const processedEmails = validMessages.map((message, index) => {
      try {
        const headers = message.payload?.headers || []
        const sender = headers.find(h => h.name === 'From')?.value || 'Unknown'
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject'
        
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

        const processedEmail = {
          gmail_id: message.id,
          sender: sender.includes('<') ? sender.split('<')[0].trim() : sender,
          subject,
          body_preview: fullBody || message.snippet || '',
          user_id: user.id,
          created_at: new Date(parseInt(message.internalDate || '0')).toISOString(),
        }
        
        console.log(`📝 Processed email ${index + 1}:`, {
          gmail_id: processedEmail.gmail_id,
          sender: processedEmail.sender,
          subject: processedEmail.subject?.substring(0, 50) + '...'
        })
        
        return processedEmail
      } catch (error) {
        console.error(`❌ Failed to process email ${index + 1}:`, error)
        return null
      }
    })

    // Filter out any failed email processing
    const validProcessedEmails = processedEmails.filter(email => email !== null)

    console.log(`📋 Successfully processed ${validProcessedEmails.length} emails for database save`)

    // Store emails in Supabase (upsert to avoid duplicates)
    console.log('💾 Saving emails to database...')
    console.log('📊 About to save emails:', processedEmails.length)
    console.log('📋 Sample email data:', processedEmails[0])
    
    try {
      const { data: emails, error: dbError } = await supabase
        .from('emails')
        .upsert(validProcessedEmails, { 
          onConflict: 'gmail_id,user_id',
          ignoreDuplicates: false  // Changed to false to see what's happening
        })
        .select()

      console.log('🔍 Database operation result:', {
        success: !dbError,
        emailsReturned: emails?.length || 0,
        error: dbError ? JSON.stringify(dbError, null, 2) : null
      })

      if (dbError) {
        console.error('❌ Database error details:', JSON.stringify(dbError, null, 2))
        return NextResponse.json({ error: 'Failed to save emails', dbError }, { status: 500 })
      }

      console.log(`✅ Successfully saved ${emails?.length || 0} emails to database`)
      console.log('📤 Final response:', { emailCount: emails?.length || 0 })

      return NextResponse.json({ emails: emails || [] })
    } catch (error) {
      console.error('❌ Unexpected database error:', error)
      return NextResponse.json({ error: 'Database operation failed', details: error }, { status: 500 })
    }

  } catch (error) {
    console.error('Gmail API error:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}



