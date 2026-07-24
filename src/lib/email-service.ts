import { EmailContentParser } from './email-parser'
import type { GmailMessage, GmailMessagePart } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProcessedEmail {
  gmail_id: string
  sender: string
  subject: string
  body_preview: string
  created_at: string
  user_id: string
  read: boolean
}

type Supabase = SupabaseClient

export class EmailService {
  static decodeEmailContent(data: string): string {
    try {
      let decoded = Buffer.from(data, 'base64').toString('utf-8')
      decoded = decoded.replace(/=\r?\n/g, '')
      return decoded.trim()
    } catch (error) {
      console.warn('[email-service] Failed to decode email content:', error)
      return ''
    }
  }

  static extractContentFromParts(
    parts: GmailMessagePart[],
    depth = 0
  ): { plainText: string; html: string } {
    let plainText = ''
    let html = ''

    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plainText += `${this.decodeEmailContent(part.body.data)}\n`
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = this.decodeEmailContent(part.body.data)
      } else if (part.parts && part.parts.length > 0) {
        const nestedContent = this.extractContentFromParts(part.parts, depth + 1)
        plainText += nestedContent.plainText
        if (!html) html = nestedContent.html
      }
    }

    return { plainText, html }
  }

  static extractEmailBody(message: GmailMessage): string {
    let fullBody = ''

    try {
      if (message.payload?.body?.data) {
        const rawContent = this.decodeEmailContent(message.payload.body.data)
        fullBody = EmailContentParser.processEmailContent(rawContent)
      } else if (message.payload?.parts) {
        const content = this.extractContentFromParts(message.payload.parts)

        if (content.html.trim()) {
          fullBody = EmailContentParser.processEmailContent(content.html)
        } else if (content.plainText.trim()) {
          fullBody = EmailContentParser.processEmailContent(content.plainText)
        }
      }
    } catch (bodyError) {
      console.warn(`[email-service] Failed to extract body for message ${message.id}:`, bodyError)
      fullBody = message.snippet || ''
    }

    return fullBody || message.snippet || ''
  }

  static processGmailMessage(message: GmailMessage, userId: string): ProcessedEmail | null {
    try {
      const headers = message.payload?.headers || []
      const sender = headers.find((h) => h.name === 'From')?.value || 'Unknown'
      const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject'
      const fullBody = this.extractEmailBody(message)

      return {
        gmail_id: message.id,
        sender: sender.includes('<') ? sender.split('<')[0].trim() : sender,
        subject,
        body_preview: fullBody || message.snippet || '',
        user_id: userId,
        created_at: new Date(parseInt(message.internalDate || '0', 10)).toISOString(),
        read: false,
      }
    } catch (error) {
      console.error('[email-service] Failed to process email:', error)
      return null
    }
  }

  static async processGmailMessages(
    messages: GmailMessage[],
    userId: string
  ): Promise<ProcessedEmail[]> {
    return messages
      .map((message) => this.processGmailMessage(message, userId))
      .filter((email): email is ProcessedEmail => email !== null)
  }

  static async cleanupStaleEmails(
    supabase: Supabase,
    currentGmailIds: string[],
    userId: string
  ): Promise<{ success: boolean; deletedCount?: number; error?: unknown }> {
    try {
      const { data: existingEmails, error: fetchError } = await supabase
        .from('emails')
        .select('id, gmail_id')
        .eq('user_id', userId)

      if (fetchError) {
        console.error('[email-service] Cleanup fetch error:', fetchError)
        return { success: false, error: fetchError }
      }

      const currentIdSet = new Set(currentGmailIds)
      const staleIds =
        existingEmails
          ?.filter((email) => !currentIdSet.has(email.gmail_id))
          .map((email) => email.id) ?? []

      if (staleIds.length === 0) {
        return { success: true, deletedCount: 0 }
      }

      const BATCH_SIZE = 100
      let deletedCount = 0

      for (let i = 0; i < staleIds.length; i += BATCH_SIZE) {
        const batch = staleIds.slice(i, i + BATCH_SIZE)
        const { data, error } = await supabase
          .from('emails')
          .delete()
          .in('id', batch)
          .eq('user_id', userId)
          .select('id')

        if (error) {
          console.error('[email-service] Cleanup delete error:', error)
          return { success: false, error }
        }

        deletedCount += data?.length ?? 0
      }

      return { success: true, deletedCount }
    } catch (error) {
      console.error('[email-service] Unexpected cleanup error:', error)
      return { success: false, error }
    }
  }

  static async saveEmailsToDatabase(
    supabase: Supabase,
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
          ignoreDuplicates: false,
        })
        .select()

      if (error) {
        console.error('[email-service] Database error:', error)
        return { success: false, error }
      }

      return { success: true, data: data || [] }
    } catch (error) {
      console.error('[email-service] Unexpected database error:', error)
      return { success: false, error }
    }
  }
}
