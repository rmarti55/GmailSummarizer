import { google, type gmail_v1 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { GmailMessage } from '@/types'
import { EmailService } from '@/lib/email-service'
import { getValidGoogleAccessToken } from '@/lib/google-auth'
import {
  type SyncJob,
  failSyncJob,
  getSyncJob,
  startFullSyncJob,
  updateSyncJob,
} from '@/lib/sync-jobs'

export const FULL_SYNC_LIST_PAGE_SIZE = 100
export const FULL_SYNC_PROCESS_BATCH_SIZE = 50
export const GMAIL_FETCH_CONCURRENCY = 5
export const INCREMENTAL_MAX_RESULTS = 100

type Supabase = SupabaseClient

export interface GmailSyncContext {
  gmail: gmail_v1.Gmail
  userId: string
  supabase: Supabase
}

export interface IncrementalSyncResult {
  syncedCount: number
  message: string
}

export interface FullSyncChunkResult {
  job: SyncJob | null
  done: boolean
}

export async function createGmailSyncContext(
  supabase: Supabase,
  user: User
): Promise<GmailSyncContext | { error: string; status: number }> {
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = await getValidGoogleAccessToken(supabase, session, user)

  if (!accessToken) {
    return { error: 'No Google access token found', status: 400 }
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  return { gmail, userId: user.id, supabase }
}

export function buildIncrementalQuery(latestCreatedAt: string | null): string {
  if (!latestCreatedAt) {
    return 'in:inbox'
  }

  const lastSyncDate = new Date(latestCreatedAt)
  const gmailDateFormat = `${lastSyncDate.getFullYear()}/${String(lastSyncDate.getMonth() + 1).padStart(2, '0')}/${String(lastSyncDate.getDate()).padStart(2, '0')}`
  return `in:inbox after:${gmailDateFormat}`
}

export async function fetchMessagesByIds(
  gmail: gmail_v1.Gmail,
  messageIds: string[]
): Promise<GmailMessage[]> {
  const results: GmailMessage[] = []

  for (let i = 0; i < messageIds.length; i += GMAIL_FETCH_CONCURRENCY) {
    const batch = messageIds.slice(i, i + GMAIL_FETCH_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          const response = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'full',
          })
          return response.data as GmailMessage
        } catch (error) {
          console.error(`[gmail-sync] Failed to fetch message ${id}:`, error)
          return null
        }
      })
    )

    for (const message of batchResults) {
      if (message) results.push(message)
    }
  }

  return results
}

export async function runIncrementalSync(
  context: GmailSyncContext
): Promise<IncrementalSyncResult> {
  const { gmail, userId, supabase } = context

  const { data: latestEmail } = await supabase
    .from('emails')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const gmailQuery = buildIncrementalQuery(latestEmail?.created_at ?? null)

  const messagesResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: INCREMENTAL_MAX_RESULTS,
    q: gmailQuery,
  })

  const messageIds =
    messagesResponse.data.messages
      ?.map((message) => message.id)
      .filter((id): id is string => Boolean(id)) ?? []

  if (messageIds.length === 0) {
    return {
      syncedCount: 0,
      message: latestEmail?.created_at
        ? 'No new emails since last sync'
        : 'No emails found in Gmail',
    }
  }

  const gmailMessages = await fetchMessagesByIds(gmail, messageIds)
  const processedEmails = await EmailService.processGmailMessages(gmailMessages, userId)
  const saveResult = await EmailService.saveEmailsToDatabase(supabase, processedEmails)

  if (!saveResult.success) {
    throw new Error('Failed to save emails')
  }

  return {
    syncedCount: saveResult.data?.length ?? 0,
    message: latestEmail?.created_at
      ? `Synced ${saveResult.data?.length ?? 0} new emails`
      : `Initial sync: ${saveResult.data?.length ?? 0} emails loaded`,
  }
}

async function listNextPage(
  supabase: Supabase,
  gmail: gmail_v1.Gmail,
  job: SyncJob
): Promise<SyncJob | null> {
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: FULL_SYNC_LIST_PAGE_SIZE,
    q: 'in:inbox',
    pageToken: job.list_page_token ?? undefined,
  })

  const newIds =
    response.data.messages
      ?.map((message) => message.id)
      .filter((id): id is string => Boolean(id)) ?? []

  const messageIds = [...job.message_ids, ...newIds]
  const nextPageToken = response.data.nextPageToken ?? null
  const listingComplete = !nextPageToken

  return updateSyncJob(supabase, job.user_id, {
    message_ids: messageIds,
    list_page_token: nextPageToken,
    phase: listingComplete ? 'processing' : 'listing',
    total: listingComplete ? messageIds.length : job.total,
    current: listingComplete ? 0 : job.current,
  })
}

async function processNextBatch(
  supabase: Supabase,
  gmail: gmail_v1.Gmail,
  job: SyncJob
): Promise<SyncJob | null> {
  const batchIds = job.message_ids.slice(
    job.processed_offset,
    job.processed_offset + FULL_SYNC_PROCESS_BATCH_SIZE
  )

  if (batchIds.length === 0) {
    return updateSyncJob(supabase, job.user_id, {
      phase: 'cleanup',
      current: job.total,
    })
  }

  const gmailMessages = await fetchMessagesByIds(gmail, batchIds)
  const processedEmails = await EmailService.processGmailMessages(gmailMessages, job.user_id)
  const saveResult = await EmailService.saveEmailsToDatabase(supabase, processedEmails)

  if (!saveResult.success) {
    throw new Error('Failed to save emails during full sync')
  }

  const newOffset = job.processed_offset + batchIds.length
  const newCurrent = Math.min(newOffset, job.total)
  const processingComplete = newOffset >= job.message_ids.length

  return updateSyncJob(supabase, job.user_id, {
    processed_offset: newOffset,
    current: newCurrent,
    phase: processingComplete ? 'cleanup' : 'processing',
  })
}

async function runCleanupPhase(
  supabase: Supabase,
  job: SyncJob
): Promise<SyncJob | null> {
  const cleanupResult = await EmailService.cleanupStaleEmails(
    supabase,
    job.message_ids,
    job.user_id
  )

  if (!cleanupResult.success) {
    throw new Error('Failed to clean up stale emails')
  }

  return updateSyncJob(supabase, job.user_id, {
    status: 'completed',
    phase: 'done',
    current: job.total,
  })
}

export async function runFullSyncChunk(
  context: GmailSyncContext
): Promise<FullSyncChunkResult> {
  const { gmail, userId, supabase } = context

  let job = await getSyncJob(supabase, userId)

  if (!job || job.status === 'completed' || job.status === 'failed') {
    job = await startFullSyncJob(supabase, userId)
  }

  if (!job) {
    return { job: null, done: false }
  }

  if (job.status !== 'running') {
    return { job, done: job.status === 'completed' }
  }

  try {
    if (job.phase === 'listing') {
      job = await listNextPage(supabase, gmail, job)
    } else if (job.phase === 'processing') {
      job = await processNextBatch(supabase, gmail, job)
    } else if (job.phase === 'cleanup') {
      job = await runCleanupPhase(supabase, job)
    }

    const done = job?.status === 'completed' && job.phase === 'done'
    return { job, done: Boolean(done) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Full sync failed'
    job = await failSyncJob(supabase, userId, message)
    return { job, done: false }
  }
}
