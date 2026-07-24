import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import { createGmailSyncContext, trashGmailMessage } from '@/lib/gmail-sync'

export const DELETE = withAuthHandler(async (
  { user, supabase },
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 })
    }

    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('id, gmail_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (emailError || !email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    const gmailContext = await createGmailSyncContext(supabase, user)

    if ('error' in gmailContext) {
      return NextResponse.json({ error: gmailContext.error }, { status: gmailContext.status })
    }

    try {
      await trashGmailMessage(gmailContext.gmail, email.gmail_id)
    } catch (error) {
      console.error('[gmail] Failed to trash message:', error)
      return NextResponse.json({ error: 'Failed to trash email in Gmail' }, { status: 502 })
    }

    const { error: deleteError } = await supabase
      .from('emails')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[gmail] Failed to delete email from database:', deleteError)
      return NextResponse.json({ error: 'Failed to remove email from cache' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[gmail] Delete email error:', error)
    return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 })
  }
})
