import type { SupabaseClient } from '@supabase/supabase-js'

export type SyncJobStatus = 'idle' | 'running' | 'completed' | 'failed'
export type SyncJobPhase = 'idle' | 'listing' | 'processing' | 'cleanup' | 'done'
export type SyncJobMode = 'full' | 'incremental'

export interface SyncJob {
  id: string
  user_id: string
  status: SyncJobStatus
  mode: SyncJobMode
  current: number
  total: number
  phase: SyncJobPhase
  list_page_token: string | null
  message_ids: string[]
  processed_offset: number
  error: string | null
  created_at: string
  updated_at: string
}

export interface SyncProgress {
  current: number
  total: number
  isRunning: boolean
  phase?: SyncJobPhase
  error?: string | null
}

type Supabase = SupabaseClient

function parseMessageIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string')
}

function mapRow(row: Record<string, unknown>): SyncJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as SyncJobStatus,
    mode: row.mode as SyncJobMode,
    current: row.current as number,
    total: row.total as number,
    phase: row.phase as SyncJobPhase,
    list_page_token: (row.list_page_token as string | null) ?? null,
    message_ids: parseMessageIds(row.message_ids),
    processed_offset: row.processed_offset as number,
    error: (row.error as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export function toSyncProgress(job: SyncJob | null): SyncProgress {
  if (!job) {
    return { current: 0, total: 0, isRunning: false }
  }

  return {
    current: job.current,
    total: job.total,
    isRunning: job.status === 'running',
    phase: job.phase,
    error: job.error,
  }
}

export async function getSyncJob(
  supabase: Supabase,
  userId: string
): Promise<SyncJob | null> {
  const { data, error } = await supabase
    .from('email_sync_jobs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[sync-jobs] Failed to fetch job:', error.message)
    return null
  }

  return data ? mapRow(data) : null
}

export async function isSyncRunning(
  supabase: Supabase,
  userId: string
): Promise<boolean> {
  const job = await getSyncJob(supabase, userId)
  return job?.status === 'running'
}

export async function startFullSyncJob(
  supabase: Supabase,
  userId: string
): Promise<SyncJob | null> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('email_sync_jobs')
    .upsert(
      {
        user_id: userId,
        status: 'running',
        mode: 'full',
        current: 0,
        total: 0,
        phase: 'listing',
        list_page_token: null,
        message_ids: [],
        processed_offset: 0,
        error: null,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single()

  if (error) {
    console.error('[sync-jobs] Failed to start job:', error.message)
    return null
  }

  return mapRow(data)
}

export async function updateSyncJob(
  supabase: Supabase,
  userId: string,
  updates: Partial<
    Pick<
      SyncJob,
      | 'status'
      | 'current'
      | 'total'
      | 'phase'
      | 'list_page_token'
      | 'message_ids'
      | 'processed_offset'
      | 'error'
    >
  >
): Promise<SyncJob | null> {
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('email_sync_jobs')
    .update(payload)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    console.error('[sync-jobs] Failed to update job:', error.message)
    return null
  }

  return mapRow(data)
}

export async function failSyncJob(
  supabase: Supabase,
  userId: string,
  errorMessage: string
): Promise<SyncJob | null> {
  return updateSyncJob(supabase, userId, {
    status: 'failed',
    error: errorMessage,
  })
}
