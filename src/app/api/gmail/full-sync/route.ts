import { NextResponse } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import {
  createGmailSyncContext,
  runFullSyncChunk,
} from '@/lib/gmail-sync'
import { toSyncProgress } from '@/lib/sync-jobs'

export const maxDuration = 60

export const POST = withAuthHandler(async ({ user, supabase }) => {
  try {
    const context = await createGmailSyncContext(supabase, user)

    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const { job, done } = await runFullSyncChunk(context)

    return NextResponse.json({
      message: done ? 'Full sync complete' : 'Full sync in progress',
      status: done ? 'completed' : 'running',
      progress: toSyncProgress(job),
    })
  } catch (error) {
    console.error('[gmail] Full sync API error:', error)
    return NextResponse.json({ error: 'Failed to process full sync' }, { status: 500 })
  }
})
