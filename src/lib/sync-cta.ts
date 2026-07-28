import type { SyncJobStatus } from '@/lib/sync-jobs'

export type SyncCtaKind = 'syncing' | 'complete' | 'retry' | 'idle'

export interface SyncCtaInput {
  isRunning: boolean
  status?: SyncJobStatus | null
  justCompleted?: boolean
  error?: string | null
}

/**
 * Pure CTA policy for the stats-bar sync button.
 * Durable `completed` alone must never lock the button — only a local
 * `justCompleted` flash may show Sync Complete.
 */
export function resolveSyncCta(input: SyncCtaInput): SyncCtaKind {
  if (input.isRunning) return 'syncing'
  if (input.justCompleted) return 'complete'
  if (input.status === 'failed' || Boolean(input.error)) return 'retry'
  return 'idle'
}

/**
 * Mount/hydrate policy: resume only running jobs; keep failed for Retry;
 * ignore completed so durable rows cannot re-lock the CTA.
 */
export function shouldHydrateSyncProgress(progress: {
  isRunning: boolean
  status?: SyncJobStatus | null
  error?: string | null
}): 'resume' | 'failed' | 'ignore' {
  if (progress.isRunning) return 'resume'
  if (progress.status === 'failed' || Boolean(progress.error)) return 'failed'
  return 'ignore'
}
