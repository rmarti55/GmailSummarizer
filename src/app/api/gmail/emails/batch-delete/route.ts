import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import { createGmailSyncContext, trashGmailMessage } from '@/lib/gmail-sync'

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

    const gmailContext = await createGmailSyncContext(supabase, user)

    if ('error' in gmailContext) {
      return NextResponse.json({ error: gmailContext.error }, { status: gmailContext.status })
    }

    const deletedIds: string[] = []
    const failedIds: string[] = []

    for (const email of emails) {
      try {
        await trashGmailMessage(gmailContext.gmail, email.gmail_id)

        const { error: deleteError } = await supabase
          .from('emails')
          .delete()
          .eq('id', email.id)
          .eq('user_id', user.id)

        if (deleteError) {
          console.error('[gmail] Failed to delete email from database:', deleteError)
          failedIds.push(email.id)
          continue
        }

        deletedIds.push(email.id)
      } catch (error) {
        console.error('[gmail] Failed to trash message in batch:', error)
        failedIds.push(email.id)
      }
    }

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
