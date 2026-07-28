import { google, type gmail_v1 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { GmailMessage } from '@/types'
import { EmailService } from '@/lib/email-service'
import { resolveGoogleAccessToken } from '@/lib/google-auth'
import {
  type SyncJob,
  failSyncJob,
  getStoredHistoryId,
  getSyncJob,
  startFullSyncJob,
  updateHistoryId,
  updateSyncJob,
} from '@/lib/sync-jobs'

export const FULL_SYNC_LIST_PAGE_SIZE = 100
export const FULL_SYNC_PROCESS_BATCH_SIZE = 50
export const GMAIL_FETCH_CONCURRENCY = 10
export const INCREMENTAL_MAX_RESULTS = 100
export const FULL_SYNC_CHUNK_TIME_BUDGET_MS = 9000
export const FULL_SYNC_MAX_STEPS_PER_CHUNK = 5
const GMAIL_FETCH_MAX_RETRIES = 3

type Supabase = SupabaseClient

export interface GmailSyncContext {
  gmail: gmail_v1.Gmail
  userId: string
  supabase: Supabase
}

export interface IncrementalSyncResult {
  syncedCount: number
  prunedCount: number
  message: string
}

export interface FullSyncChunkResult {
  job: SyncJob | null
  done: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableGmailError(error: unknown): boolean {
  const err = error as { code?: number; response?: { status?: number } }
  const status = err?.response?.status ?? err?.code
  return status === 429 || (status !== undefined && status >= 500)
}

function isHistoryIdExpiredError(error: unknown): boolean {
  const err = error as { code?: number; response?: { status?: number } }
  return err?.code === 404 || err?.response?.status === 404
}

export async function createGmailSyncContext(
  supabase: Supabase,
  user: User
): Promise<GmailSyncContext | { error: string; status: number }> {
  const { data: { session } } = await supabase.auth.getSession()
  const tokenResult = await resolveGoogleAccessToken(supabase, session, user)

  if (!tokenResult.ok) {
    return { error: tokenResult.error, status: 400 }
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: tokenResult.accessToken })
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

async function fetchMessageWithRetry(
  gmail: gmail_v1.Gmail,
  id: string
): Promise<GmailMessage | null> {
  for (let attempt = 0; attempt <= GMAIL_FETCH_MAX_RETRIES; attempt++) {
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      })
      return response.data as GmailMessage
    } catch (error) {
      if (attempt < GMAIL_FETCH_MAX_RETRIES && isRetryableGmailError(error)) {
        const delay = Math.min(1000 * 2 ** attempt, 8000)
        await sleep(delay)
        continue
      }

      console.error(`[gmail-sync] Failed to fetch message ${id}:`, error)
      return null
    }
  }

  return null
}

export async function fetchMessagesByIds(
  gmail: gmail_v1.Gmail,
  messageIds: string[]
): Promise<GmailMessage[]> {
  const results: GmailMessage[] = []

  for (let i = 0; i < messageIds.length; i += GMAIL_FETCH_CONCURRENCY) {
    const batch = messageIds.slice(i, i + GMAIL_FETCH_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((id) => fetchMessageWithRetry(gmail, id))
    )

    for (const message of batchResults) {
      if (message) results.push(message)
    }
  }

  return results
}

export async function listAllInboxMessageIds(
  gmail: gmail_v1.Gmail,
  pageSize = FULL_SYNC_LIST_PAGE_SIZE
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined

  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: pageSize,
      q: 'in:inbox',
      pageToken,
    })

    const pageIds =
      response.data.messages
        ?.map((message) => message.id)
        .filter((id): id is string => Boolean(id)) ?? []

    ids.push(...pageIds)
    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return ids
}

async function fetchCurrentHistoryId(gmail: gmail_v1.Gmail): Promise<string | null> {
  const response = await gmail.users.getProfile({ userId: 'me' })
  return response.data.historyId ?? null
}

async function persistHistoryId(
  supabase: Supabase,
  userId: string,
  historyId: string | null | undefined
): Promise<void> {
  if (!historyId) {
    return
  }

  await updateHistoryId(supabase, userId, historyId)
}

async function pruneStaleInboxEmails(context: GmailSyncContext): Promise<number> {
  const { gmail, userId, supabase } = context
  const inboxIds = await listAllInboxMessageIds(gmail)
  const cleanupResult = await EmailService.cleanupStaleEmails(
    supabase,
    inboxIds,
    userId
  )

  if (!cleanupResult.success) {
    throw new Error('Failed to clean up stale emails')
  }

  const historyId = await fetchCurrentHistoryId(gmail)
  await persistHistoryId(supabase, userId, historyId)

  return cleanupResult.deletedCount ?? 0
}

interface HistoryChanges {
  addedIds: string[]
  removedIds: string[]
  latestHistoryId: string | null
}

async function fetchHistoryChanges(
  gmail: gmail_v1.Gmail,
  startHistoryId: string
): Promise<HistoryChanges> {
  const addedIds = new Set<string>()
  const removedIds = new Set<string>()
  let latestHistoryId: string | null = null
  let pageToken: string | undefined

  do {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      pageToken,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
    })

    for (const record of response.data.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.id) {
          addedIds.add(added.message.id)
        }
      }

      for (const deleted of record.messagesDeleted ?? []) {
        if (deleted.message?.id) {
          removedIds.add(deleted.message.id)
        }
      }

      for (const labelAdded of record.labelsAdded ?? []) {
        if (labelAdded.labelIds?.includes('INBOX') && labelAdded.message?.id) {
          addedIds.add(labelAdded.message.id)
        }
      }

      for (const labelRemoved of record.labelsRemoved ?? []) {
        if (labelRemoved.labelIds?.includes('INBOX') && labelRemoved.message?.id) {
          removedIds.add(labelRemoved.message.id)
        }
      }
    }

    latestHistoryId = response.data.historyId ?? latestHistoryId
    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  for (const removedId of removedIds) {
    addedIds.delete(removedId)
  }

  return {
    addedIds: [...addedIds],
    removedIds: [...removedIds],
    latestHistoryId,
  }
}

async function runFallbackIncrementalSync(
  context: GmailSyncContext,
  latestCreatedAt: string | null
): Promise<IncrementalSyncResult> {
  const { gmail, userId, supabase } = context
  const gmailQuery = buildIncrementalQuery(latestCreatedAt)
  const messageIds: string[] = []
  let pageToken: string | undefined

  do {
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: INCREMENTAL_MAX_RESULTS,
      q: gmailQuery,
      pageToken,
    })

    const pageIds =
      messagesResponse.data.messages
        ?.map((message) => message.id)
        .filter((id): id is string => Boolean(id)) ?? []

    messageIds.push(...pageIds)
    pageToken = messagesResponse.data.nextPageToken ?? undefined
  } while (pageToken)

  if (messageIds.length === 0) {
    const prunedCount = await pruneStaleInboxEmails(context)

    return {
      syncedCount: 0,
      prunedCount,
      message: latestCreatedAt
        ? prunedCount > 0
          ? `No new emails; removed ${prunedCount} that left inbox`
          : 'No new emails since last sync'
        : 'No emails found in Gmail',
    }
  }

  const uniqueIds = [...new Set(messageIds)]
  const existingIds = await EmailService.getExistingGmailIds(supabase, uniqueIds, userId)
  const idsToFetch = uniqueIds.filter((id) => !existingIds.has(id))

  const gmailMessages =
    idsToFetch.length > 0 ? await fetchMessagesByIds(gmail, idsToFetch) : []
  const processedEmails = await EmailService.processGmailMessages(gmailMessages, userId)
  const saveResult = await EmailService.saveEmailsToDatabase(supabase, processedEmails)

  if (!saveResult.success) {
    throw new Error('Failed to save emails')
  }

  const syncedCount = saveResult.data?.length ?? 0
  const prunedCount = await pruneStaleInboxEmails(context)

  return {
    syncedCount,
    prunedCount,
    message: latestCreatedAt
      ? prunedCount > 0
        ? `Synced ${syncedCount} new emails; removed ${prunedCount} that left inbox`
        : `Synced ${syncedCount} new emails`
      : `Initial sync: ${syncedCount} emails loaded`,
  }
}

async function runHistoryBasedIncrementalSync(
  context: GmailSyncContext,
  startHistoryId: string
): Promise<IncrementalSyncResult> {
  const { gmail, userId, supabase } = context

  const { addedIds, removedIds, latestHistoryId } = await fetchHistoryChanges(
    gmail,
    startHistoryId
  )

  let prunedCount = 0
  if (removedIds.length > 0) {
    const deleteResult = await EmailService.deleteEmailsByGmailIds(
      supabase,
      removedIds,
      userId
    )

    if (!deleteResult.success) {
      throw new Error('Failed to remove emails that left inbox')
    }

    prunedCount = deleteResult.deletedCount ?? 0
  }

  let syncedCount = 0
  if (addedIds.length > 0) {
    const existingIds = await EmailService.getExistingGmailIds(supabase, addedIds, userId)
    const idsToFetch = addedIds.filter((id) => !existingIds.has(id))

    if (idsToFetch.length > 0) {
      const gmailMessages = await fetchMessagesByIds(gmail, idsToFetch)
      const processedEmails = await EmailService.processGmailMessages(gmailMessages, userId)
      const saveResult = await EmailService.saveEmailsToDatabase(supabase, processedEmails)

      if (!saveResult.success) {
        throw new Error('Failed to save emails')
      }

      syncedCount = saveResult.data?.length ?? 0
    }
  }

  const historyIdToStore = latestHistoryId ?? (await fetchCurrentHistoryId(gmail))
  await persistHistoryId(supabase, userId, historyIdToStore)

  if (syncedCount === 0 && prunedCount === 0) {
    return {
      syncedCount: 0,
      prunedCount: 0,
      message: 'No new emails since last sync',
    }
  }

  if (syncedCount > 0 && prunedCount > 0) {
    return {
      syncedCount,
      prunedCount,
      message: `Synced ${syncedCount} new emails; removed ${prunedCount} that left inbox`,
    }
  }

  if (syncedCount > 0) {
    return {
      syncedCount,
      prunedCount: 0,
      message: `Synced ${syncedCount} new emails`,
    }
  }

  return {
    syncedCount: 0,
    prunedCount,
    message: `Removed ${prunedCount} emails that left inbox`,
  }
}

export async function runIncrementalSync(
  context: GmailSyncContext
): Promise<IncrementalSyncResult> {
  const { gmail, userId, supabase } = context

  const storedHistoryId = await getStoredHistoryId(supabase, userId)

  if (storedHistoryId) {
    try {
      return await runHistoryBasedIncrementalSync(context, storedHistoryId)
    } catch (error) {
      if (!isHistoryIdExpiredError(error)) {
        throw error
      }

      console.warn('[gmail-sync] History ID expired, falling back to full incremental sync')
    }
  }

  const { data: latestEmail } = await supabase
    .from('emails')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const result = await runFallbackIncrementalSync(context, latestEmail?.created_at ?? null)

  const historyId = await fetchCurrentHistoryId(gmail)
  await persistHistoryId(supabase, userId, historyId)

  return result
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

  const existingIds = await EmailService.getExistingGmailIds(
    supabase,
    batchIds,
    job.user_id
  )
  const idsToFetch = batchIds.filter((id) => !existingIds.has(id))

  if (idsToFetch.length > 0) {
    const gmailMessages = await fetchMessagesByIds(gmail, idsToFetch)
    const processedEmails = await EmailService.processGmailMessages(
      gmailMessages,
      job.user_id
    )
    const saveResult = await EmailService.saveEmailsToDatabase(supabase, processedEmails)

    if (!saveResult.success) {
      throw new Error('Failed to save emails during full sync')
    }
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
  gmail: gmail_v1.Gmail,
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

  const historyId = await fetchCurrentHistoryId(gmail)
  await persistHistoryId(supabase, job.user_id, historyId)

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

  const startTime = Date.now()
  let steps = 0

  try {
    while (
      job &&
      job.status === 'running' &&
      steps < FULL_SYNC_MAX_STEPS_PER_CHUNK &&
      Date.now() - startTime < FULL_SYNC_CHUNK_TIME_BUDGET_MS
    ) {
      if (job.phase === 'listing') {
        job = await listNextPage(supabase, gmail, job)
      } else if (job.phase === 'processing') {
        job = await processNextBatch(supabase, gmail, job)
      } else if (job.phase === 'cleanup') {
        job = await runCleanupPhase(supabase, gmail, job)
        break
      } else {
        break
      }

      steps++

      if (!job || job.status !== 'running' || job.phase === 'done') {
        break
      }
    }

    const done = job?.status === 'completed' && job.phase === 'done'
    return { job, done: Boolean(done) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Full sync failed'
    job = await failSyncJob(supabase, userId, message)
    return { job, done: false }
  }
}

function isGmailNotFoundError(error: unknown): boolean {
  const err = error as { code?: number; response?: { status?: number } }
  return err?.code === 404 || err?.response?.status === 404
}

export async function trashGmailMessage(
  gmail: gmail_v1.Gmail,
  gmailId: string
): Promise<void> {
  try {
    await gmail.users.messages.trash({
      userId: 'me',
      id: gmailId,
    })
  } catch (error) {
    if (isGmailNotFoundError(error)) {
      return
    }
    throw error
  }
}

export async function trashGmailMessagesBatch(
  gmail: gmail_v1.Gmail,
  gmailIds: string[]
): Promise<void> {
  if (gmailIds.length === 0) {
    return
  }

  for (let attempt = 0; attempt <= GMAIL_FETCH_MAX_RETRIES; attempt++) {
    try {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: gmailIds,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX'],
        },
      })
      return
    } catch (error) {
      if (attempt < GMAIL_FETCH_MAX_RETRIES && isRetryableGmailError(error)) {
        const delay = Math.min(1000 * 2 ** attempt, 8000)
        await sleep(delay)
        continue
      }
      throw error
    }
  }
}
