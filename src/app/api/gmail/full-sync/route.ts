import { NextResponse } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import {
  createGmailSyncContext,
  runFullSyncChunk,
} from '@/lib/gmail-sync'
import { failSyncJob, getSyncJob, toSyncProgress } from '@/lib/sync-jobs'

export const maxDuration = 60

export const POST = withAuthHandler(async ({ user, supabase }) => {
  try {
    const context = await createGmailSyncContext(supabase, user)

    if ('error' in context) {
      const job = await getSyncJob(supabase, user.id)
      if (job?.status === 'running') {
        await failSyncJob(supabase, user.id, context.error)
      }
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const { job, done } = await runFullSyncChunk(context)

    return NextResponse.json({
      message: done ? 'Full sync complete' : 'Full sync in progress',
      status: done ? 'completed' : job?.status === 'failed' ? 'failed' : 'running',
      progress: toSyncProgress(job),
    })
  } catch (error) {
    console.error('[gmail] Full sync API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to process full sync'
    const job = await getSyncJob(supabase, user.id)
    if (job?.status === 'running') {
      await failSyncJob(supabase, user.id, message)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
