import { NextResponse } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import {
  createGmailSyncContext,
  runIncrementalSync,
} from '@/lib/gmail-sync'

export const GET = withAuthHandler(async ({ user, supabase }) => {
  try {
    const context = await createGmailSyncContext(supabase, user)

    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const result = await runIncrementalSync(context)

    return NextResponse.json({
      syncedCount: result.syncedCount,
      message: result.message,
    })
  } catch (error) {
    console.error('[gmail] Incremental sync error:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
})
