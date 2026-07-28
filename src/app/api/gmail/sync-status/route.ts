import { NextResponse } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import { getSyncJob, idleSyncJob, toSyncProgress } from '@/lib/sync-jobs'

export const GET = withAuthHandler(async ({ user, supabase }) => {
  try {
    const job = await getSyncJob(supabase, user.id)

    // One-shot: return completed progress, then idle so durable rows cannot
    // permanently lock the UI after a successful sync.
    if (job?.status === 'completed') {
      const progress = toSyncProgress(job)
      await idleSyncJob(supabase, user.id)
      return NextResponse.json(progress)
    }

    return NextResponse.json(toSyncProgress(job))
  } catch (error) {
    console.error('[gmail] Sync status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
