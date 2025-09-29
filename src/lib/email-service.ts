import { EmailContentParser } from './email-parser'
import type { GmailMessage } from '@/types'

export interface ProcessedEmail {
  gmail_id: string
  sender: string
  subject: string
  body_preview: string
  created_at: string
  user_id: string
  read: boolean
}

export class EmailService {
  /**
   * Decode email content with proper encoding handling
   */
  static decodeEmailContent(data: string): string {
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

  /**
   * Recursively extract content from email parts (handles nested structures)
   */
  static extractContentFromParts(parts: any[], depth = 0): { plainText: string; html: string } {
    const indent = '  '.repeat(depth)
    let plainText = ''
    let html = ''
    
    for (const part of parts) {
      console.log(`${indent}Part: ${part.mimeType}, hasBody: ${!!part.body?.data}, hasNested: ${!!part.parts}`)
      
      if (part.mimeType === 'text/plain' && part.body?.data) {
        const partContent = this.decodeEmailContent(part.body.data)
        plainText += partContent + '\n'
        console.log(`${indent}  ✅ Found text/plain content (${partContent.length} chars)`)
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = this.decodeEmailContent(part.body.data)
        console.log(`${indent}  ✅ Found text/html content (${html.length} chars)`)
      } else if (part.parts && part.parts.length > 0) {
        console.log(`${indent}  🔍 Part has ${part.parts.length} nested parts - PROCESSING RECURSIVELY`)
        const nestedContent = this.extractContentFromParts(part.parts, depth + 1)
        plainText += nestedContent.plainText
        if (!html) html = nestedContent.html // Only use nested HTML if we don't have HTML yet
      }
    }
    
    return { plainText, html }
  }

  /**
   * Extract email body content from Gmail message payload
   */
  static extractEmailBody(message: GmailMessage): string {
    // 🔍 DIAGNOSTIC: Log email structure for truncation debugging
    console.log(`\n📧 DEBUGGING EMAIL (${message.id}):`)
    console.log(`Snippet: "${message.snippet}"`)
    console.log(`Payload structure:`, {
      hasDirectBody: !!message.payload?.body?.data,
      hasParts: !!message.payload?.parts,
      partsCount: message.payload?.parts?.length || 0,
      partsStructure: message.payload?.parts?.map(part => ({
        mimeType: part.mimeType,
        hasBody: !!part.body?.data,
        hasNestedParts: !!part.parts,
        nestedPartsCount: part.parts?.length || 0,
        nestedPartsTypes: part.parts?.map(p => p.mimeType) || []
      })) || []
    })
    
    let fullBody = ''
    
    try {
      if (message.payload?.body?.data) {
        // Simple text email
        console.log(`✅ Found direct body data`)
        const rawContent = this.decodeEmailContent(message.payload.body.data)
        fullBody = EmailContentParser.processEmailContent(rawContent)
        console.log(`Direct body content length: ${fullBody.length}`)
      } else if (message.payload?.parts) {
        // Multi-part email - use recursive processing
        console.log(`📦 Processing ${message.payload.parts.length} parts (with recursive nested support)`)
        const content = this.extractContentFromParts(message.payload.parts)
        
        // Prioritize HTML for rich content, fallback to plain text
        if (content.html.trim()) {
          fullBody = EmailContentParser.processEmailContent(content.html)
          console.log(`✅ Using HTML content (final length: ${fullBody.length})`)
        } else if (content.plainText.trim()) {
          fullBody = EmailContentParser.processEmailContent(content.plainText)
          console.log(`✅ Using plain text content (final length: ${fullBody.length})`)
        } else {
          console.log(`❌ No content found in any parts (including nested)`)
        }
      } else {
        console.log(`❌ No body data or parts found`)
      }
    } catch (bodyError) {
      console.warn(`⚠️ Failed to extract body for message ${message.id}:`, bodyError)
      fullBody = message.snippet || ''
    }

    // 🔍 DIAGNOSTIC: Final result
    console.log(`Final body length: ${fullBody.length}`)
    console.log(`Using snippet fallback: ${fullBody === message.snippet}`)
    if (fullBody === message.snippet) {
      console.log(`🚨 TRUNCATION DETECTED: Falling back to snippet!`)
    }
    console.log(`─────────────────────────────────────────────────────────\n`)

    return fullBody
  }

  /**
   * Process Gmail message into database-ready format
   */
  static processGmailMessage(message: GmailMessage, userId: string): ProcessedEmail | null {
    try {
      const headers = message.payload?.headers || []
      const sender = headers.find(h => h.name === 'From')?.value || 'Unknown'
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject'
      
      // Extract email body
      const fullBody = this.extractEmailBody(message)
      
      return {
        gmail_id: message.id,
        sender: sender.includes('<') ? sender.split('<')[0].trim() : sender,
        subject,
        body_preview: fullBody || message.snippet || '',
        user_id: userId,
        created_at: new Date(parseInt(message.internalDate || '0')).toISOString(),
        read: false
      }
    } catch (error) {
      console.error('❌ Failed to process email:', error)
      return null
    }
  }

  /**
   * Process multiple Gmail messages in parallel
   */
  static async processGmailMessages(
    messages: GmailMessage[], 
    userId: string
  ): Promise<ProcessedEmail[]> {
    const processedEmails = messages
      .map(message => this.processGmailMessage(message, userId))
      .filter((email): email is ProcessedEmail => email !== null)

    return processedEmails
  }

  /**
   * Clean up stale emails that are no longer in Gmail inbox
   */
  static async cleanupStaleEmails(
    supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    currentGmailIds: string[],
    userId: string
  ): Promise<{ success: boolean; deletedCount?: number; error?: unknown }> {
    if (currentGmailIds.length === 0) {
      console.log('⚠️ No Gmail IDs provided, skipping cleanup')
      return { success: true, deletedCount: 0 }
    }

    try {
      const { data, error } = await supabase
        .from('emails')
        .delete()
        .eq('user_id', userId)
        .not('gmail_id', 'in', `(${currentGmailIds.map(id => `'${id}'`).join(',')})`)
        .select('gmail_id')

      if (error) {
        console.error('❌ Cleanup error:', error)
        return { success: false, error }
      }

      const deletedCount = data?.length || 0
      console.log(`🗑️ Cleaned up ${deletedCount} stale emails`)
      return { success: true, deletedCount }
    } catch (error) {
      console.error('❌ Unexpected cleanup error:', error)
      return { success: false, error }
    }
  }

  /**
   * Save processed emails to database with upsert
   */
  static async saveEmailsToDatabase(
    supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    emails: ProcessedEmail[]
  ): Promise<{ success: boolean; data?: ProcessedEmail[]; error?: unknown }> {
    if (emails.length === 0) {
      return { success: true, data: [] }
    }

    try {
      const { data, error } = await supabase
        .from('emails')
        .upsert(emails, { 
          onConflict: 'gmail_id,user_id',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        console.error('❌ Database error:', error)
        return { success: false, error }
      }

      console.log(`✅ Successfully saved ${data?.length || 0} emails to database`)
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('❌ Unexpected database error:', error)
      return { success: false, error }
    }
  }
}
