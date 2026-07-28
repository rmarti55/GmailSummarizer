import { clampPageSize } from '@/lib/page-size'
import {
  getSenderQueryValues,
  normalizeSenderForDisplay,
  normalizeSenderKey,
} from '@/lib/sender-utils'
import type { SupabaseClient } from '@supabase/supabase-js'

type Supabase = SupabaseClient

interface EmailRow {
  id: string
  created_at: string
  [key: string]: unknown
}

interface PaginationResult {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

function buildPagination(page: number, limit: number, total: number): PaginationResult {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

function isMissingSenderKeyColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return error.code === '42703' || message.includes('sender_key')
}

async function countBySenderEq(
  supabase: Supabase,
  userId: string,
  sender: string
): Promise<number> {
  const { count, error } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('sender', sender)

  if (error) {
    throw error
  }

  return count ?? 0
}

async function resolveSenderVariants(
  supabase: Supabase,
  userId: string,
  senderKey: string
): Promise<Array<{ variant: string; count: number }>> {
  const hits: Array<{ variant: string; count: number }> = []

  for (const variant of getSenderQueryValues(senderKey)) {
    const count = await countBySenderEq(supabase, userId, variant)
    if (count > 0) {
      hits.push({ variant, count })
    }
  }

  return hits
}

async function fetchEmailsForVariant(
  supabase: Supabase,
  userId: string,
  variant: string,
  page: number,
  limit: number,
  total: number
) {
  const offset = (page - 1) * limit
  const { data: emails, error } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('sender', variant)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  return {
    emails: emails || [],
    pagination: buildPagination(page, limit, total),
  }
}

async function fetchBySenderVariants(
  supabase: Supabase,
  userId: string,
  displaySender: string,
  page: number,
  limit: number
) {
  const senderKey = normalizeSenderKey(displaySender)
  const hits = await resolveSenderVariants(supabase, userId, senderKey)
  const total = hits.reduce((sum, hit) => sum + hit.count, 0)

  if (total === 0) {
    return {
      emails: [],
      pagination: buildPagination(page, limit, 0),
    }
  }

  if (hits.length === 1) {
    return fetchEmailsForVariant(supabase, userId, hits[0].variant, page, limit, total)
  }

  const merged: EmailRow[] = []
  for (const hit of hits) {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .eq('sender', hit.variant)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    merged.push(...((data as EmailRow[] | null) ?? []))
  }

  merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const offset = (page - 1) * limit
  return {
    emails: merged.slice(offset, offset + limit),
    pagination: buildPagination(page, limit, total),
  }
}

async function fetchBySenderKey(
  supabase: Supabase,
  userId: string,
  senderKey: string,
  page: number,
  limit: number
) {
  const { count: totalCount, error: countError } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('sender_key', senderKey)

  if (countError) {
    throw countError
  }

  const total = totalCount ?? 0
  const offset = (page - 1) * limit
  const { data: emails, error: emailsError } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('sender_key', senderKey)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (emailsError) {
    throw emailsError
  }

  return {
    emails: emails || [],
    pagination: buildPagination(page, limit, total),
  }
}

export async function countEmailsForDisplaySender(
  supabase: Supabase,
  userId: string,
  displaySender: string
): Promise<number> {
  const senderKey = normalizeSenderKey(normalizeSenderForDisplay(displaySender))

  const { count: keyCount, error: keyError } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('sender_key', senderKey)

  if (!keyError) {
    if ((keyCount ?? 0) > 0) {
      return keyCount ?? 0
    }

    const hits = await resolveSenderVariants(supabase, userId, senderKey)
    return hits.reduce((sum, hit) => sum + hit.count, 0)
  }

  if (isMissingSenderKeyColumn(keyError)) {
    const hits = await resolveSenderVariants(supabase, userId, senderKey)
    return hits.reduce((sum, hit) => sum + hit.count, 0)
  }

  throw keyError
}

export async function fetchSenderEmailsPage(
  supabase: Supabase,
  userId: string,
  displaySender: string,
  page: number,
  limit: number
) {
  const senderKey = normalizeSenderKey(normalizeSenderForDisplay(displaySender))

  const { count: keyCount, error: keyCountError } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('sender_key', senderKey)

  if (!keyCountError) {
    if ((keyCount ?? 0) > 0) {
      return fetchBySenderKey(supabase, userId, senderKey, page, limit)
    }

    const variantHits = await resolveSenderVariants(supabase, userId, senderKey)
    if (variantHits.length === 0) {
      return {
        emails: [],
        pagination: buildPagination(page, limit, 0),
      }
    }

    return fetchBySenderVariants(supabase, userId, displaySender, page, limit)
  }

  if (isMissingSenderKeyColumn(keyCountError)) {
    return fetchBySenderVariants(supabase, userId, displaySender, page, limit)
  }

  throw keyCountError
}

export function parseSenderEmailsRequest(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = clampPageSize(parseInt(searchParams.get('limit') || '100', 10))
  const sender = searchParams.get('sender') ?? ''

  return { page, limit, sender }
}
