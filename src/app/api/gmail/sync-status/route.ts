import { NextResponse } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'
import { getSyncJob, toSyncProgress } from '@/lib/sync-jobs'

export const GET = withAuthHandler(async ({ user, supabase }) => {
  try {
    const job = await getSyncJob(supabase, user.id)
    return NextResponse.json(toSyncProgress(job))
  } catch (error) {
    console.error('[gmail] Sync status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
