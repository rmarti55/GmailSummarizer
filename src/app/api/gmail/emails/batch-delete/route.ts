import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import { EmailService } from '@/lib/email-service'
import { createGmailSyncContext, trashGmailMessagesBatch } from '@/lib/gmail-sync'

export const maxDuration = 60

const MAX_BATCH_SIZE = 100

export const POST = withAuthHandler(async ({ user, supabase }, request: NextRequest) => {
  try {
    const body = await request.json().catch(() => null)
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Email IDs required' }, { status: 400 })
    }

    if (ids.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Cannot delete more than ${MAX_BATCH_SIZE} emails at once` },
        { status: 400 }
      )
    }

    const { data: emails, error: emailError } = await supabase
      .from('emails')
      .select('id, gmail_id')
      .in('id', ids)
      .eq('user_id', user.id)

    if (emailError) {
      console.error('[gmail] Batch delete lookup failed:', emailError)
      return NextResponse.json({ error: 'Failed to look up emails' }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ error: 'No matching emails found' }, { status: 404 })
    }

    const foundIds = new Set(emails.map((email) => email.id))
    const notFoundIds = ids.filter((id: string) => !foundIds.has(id))
    const gmailIds = emails.map((email) => email.gmail_id)

    const gmailContext = await createGmailSyncContext(supabase, user)

    if ('error' in gmailContext) {
      return NextResponse.json({ error: gmailContext.error }, { status: gmailContext.status })
    }

    try {
      await trashGmailMessagesBatch(gmailContext.gmail, gmailIds)
    } catch (error) {
      console.error('[gmail] Batch trash failed:', error)
      return NextResponse.json(
        { error: 'Failed to trash emails in Gmail', failedIds: ids },
        { status: 502 }
      )
    }

    const deleteResult = await EmailService.deleteEmailsByGmailIds(
      supabase,
      gmailIds,
      user.id
    )

    if (!deleteResult.success) {
      console.error('[gmail] Batch delete DB cleanup failed:', deleteResult.error)
      return NextResponse.json(
        { error: 'Failed to remove emails from cache', failedIds: ids },
        { status: 500 }
      )
    }

    const deletedIds = emails.map((email) => email.id)
    const failedIds = [...notFoundIds]

    if (deletedIds.length === 0) {
      return NextResponse.json({ error: 'Failed to delete emails', failedIds }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      deletedIds,
      failedIds,
    })
  } catch (error) {
    console.error('[gmail] Batch delete error:', error)
    return NextResponse.json({ error: 'Failed to delete emails' }, { status: 500 })
  }
})
