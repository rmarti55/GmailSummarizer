import { clampPageSize } from '@/lib/page-size'
import { buildSenderEqOrFilter, getSenderQueryValues } from '@/lib/sender-utils'
import type { SupabaseClient } from '@supabase/supabase-js'

type Supabase = SupabaseClient

function applySenderFilter<T extends { or: (filters: string) => T }>(
  query: T,
  senderValues: string[]
): T {
  return query.or(buildSenderEqOrFilter(senderValues))
}

export async function fetchSenderEmailsPage(
  supabase: Supabase,
  userId: string,
  displaySender: string,
  page: number,
  limit: number
) {
  const senderValues = getSenderQueryValues(displaySender)
  const offset = (page - 1) * limit

  const { count: totalCount, error: countError } = await applySenderFilter(
    supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    senderValues
  )

  if (countError) {
    throw countError
  }

  const { data: emails, error: emailsError } = await applySenderFilter(
    supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    senderValues
  )

  if (emailsError) {
    throw emailsError
  }

  const totalPages = Math.ceil((totalCount || 0) / limit)

  return {
    emails: emails || [],
    pagination: {
      page,
      limit,
      total: totalCount || 0,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

export function parseSenderEmailsRequest(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = clampPageSize(parseInt(searchParams.get('limit') || '100', 10))
  const sender = searchParams.get('sender') ?? ''

  return { page, limit, sender }
}
