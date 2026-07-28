import { clampPageSize } from '@/lib/page-size'
import { getSenderQueryValues } from '@/lib/sender-utils'
import type { SupabaseClient } from '@supabase/supabase-js'

type Supabase = SupabaseClient

export async function fetchSenderEmailsPage(
  supabase: Supabase,
  userId: string,
  displaySender: string,
  page: number,
  limit: number
) {
  const senderValues = getSenderQueryValues(displaySender)
  const offset = (page - 1) * limit

  const { count: totalCount, error: countError } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('sender', senderValues)

  if (countError) {
    throw countError
  }

  const { data: emails, error: emailsError } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .in('sender', senderValues)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

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
  const limit = clampPageSize(parseInt(searchParams.get('limit') || '10', 10))
  const sender = searchParams.get('sender') ?? ''

  return { page, limit, sender }
}
