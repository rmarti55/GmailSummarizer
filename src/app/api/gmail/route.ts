import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/request'
import type { GmailMessage } from '@/types'

export async function GET(request: NextRequest) {
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
        
        const processedEmail = {
          gmail_id: message.id,
          sender: sender.includes('<') ? sender.split('<')[0].trim() : sender,
          subject,
          body_preview: message.snippet || '',
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
    }).filter(email => email !== null)

    console.log(`📋 Successfully processed ${processedEmails.length} emails for database save`)

    // Store emails in Supabase (upsert to avoid duplicates)
    console.log('💾 Saving emails to database...')
    console.log('📝 Sample email data:', JSON.stringify(processedEmails[0], null, 2))
    console.log('🔍 Total emails to save:', processedEmails.length)
    console.log('👤 User ID:', user.id)
    
    // First, let's try a simple insert to see what happens
    try {
      const { data: emails, error: dbError } = await supabase
        .from('emails')
        .insert(processedEmails)
        .select()

      if (dbError) {
        console.error('❌ Database error:', dbError)
        console.error('❌ Error code:', dbError.code)
        console.error('❌ Error message:', dbError.message)
        console.error('❌ Error details:', dbError.details)
        console.error('❌ Error hint:', dbError.hint)
        
        // If it's a duplicate key error, try upsert instead
        if (dbError.code === '23505') {
          console.log('🔄 Duplicate key error, trying upsert...')
          
          // The constraint is on gmail_id only, so we need to handle this differently
          // Let's try to get existing emails first and only insert new ones
          console.log('🔍 Checking for existing emails...')
          const gmailIds = processedEmails.map(email => email.gmail_id)
          
          const { data: existingEmails, error: existingError } = await supabase
            .from('emails')
            .select('gmail_id')
            .in('gmail_id', gmailIds)
            .eq('user_id', user.id)
            
          if (existingError) {
            console.error('❌ Error checking existing emails:', existingError)
            return NextResponse.json({ error: 'Failed to check existing emails', existingError }, { status: 500 })
          }
          
          const existingGmailIds = new Set(existingEmails?.map(e => e.gmail_id) || [])
          const newEmails = processedEmails.filter(email => !existingGmailIds.has(email.gmail_id))
          
          console.log(`📊 Found ${existingEmails?.length || 0} existing emails, ${newEmails.length} new emails to insert`)
          
          if (newEmails.length > 0) {
            const { data: insertedEmails, error: insertError } = await supabase
              .from('emails')
              .insert(newEmails)
              .select()
              
            if (insertError) {
              console.error('❌ Insert error:', insertError)
              return NextResponse.json({ error: 'Failed to insert new emails', insertError }, { status: 500 })
            }
            
            console.log(`✅ Successfully inserted ${insertedEmails?.length || 0} new emails`)
            
            // Get all emails for this user to return
            const { data: allEmails, error: allError } = await supabase
              .from('emails')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20)
              
            if (allError) {
              console.error('❌ Error fetching all emails:', allError)
              return NextResponse.json({ emails: insertedEmails || [] })
            }
            
            return NextResponse.json({ emails: allEmails || [] })
          } else {
            console.log('📧 No new emails to insert, returning existing emails')
            
            // Get existing emails for this user
            const { data: allEmails, error: allError } = await supabase
              .from('emails')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20)
              
            if (allError) {
              console.error('❌ Error fetching existing emails:', allError)
              return NextResponse.json({ emails: [] })
            }
            
            return NextResponse.json({ emails: allEmails || [] })
          }
        }
        
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



