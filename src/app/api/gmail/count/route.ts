import { createClient } from '@/lib/supabase/server'
import { countEmailsForDisplaySender, fetchSenderEmailsPage } from '@/lib/sender-emails-query'
import { normalizeSenderForDisplay } from '@/lib/sender-utils'
import { NextResponse } from 'next/server'

function parseSortParams(searchParams: URLSearchParams) {
  const sort = searchParams.get('sort') === 'sender' ? 'sender' : 'date'
  const orderParam = searchParams.get('order')
  const order =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : sort === 'date' ? 'desc' : 'asc'
  return { sort, order }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '0', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const sender = searchParams.get('sender')
    const { sort, order } = parseSortParams(searchParams)

    if (limit > 0) {
      if (sender) {
        const page = Math.floor(offset / limit) + 1
        const result = await fetchSenderEmailsPage(
          supabase,
          user.id,
          normalizeSenderForDisplay(sender),
          page,
          limit
        )

        let emails = result.emails
        if (sort === 'sender') {
          emails = [...emails].sort((a, b) => {
            const cmp = (a.sender || '').localeCompare(b.sender || '')
            return order === 'asc' ? cmp : -cmp
          })
        } else if (order === 'asc') {
          emails = [...emails].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        }

        return NextResponse.json({ emails })
      }

      let query = supabase.from('emails').select('*').eq('user_id', user.id)

      if (sort === 'sender') {
        query = query
          .order('sender', { ascending: order === 'asc' })
          .order('created_at', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: order === 'asc' })
      }

      const { data: emails, error: emailsError } = await query.range(offset, offset + limit - 1)

      if (emailsError) {
        console.error('Error fetching emails:', emailsError)
        return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
      }

      return NextResponse.json({ emails: emails || [] })
    }

    let count: number | null
    if (sender) {
      count = await countEmailsForDisplaySender(
        supabase,
        user.id,
        normalizeSenderForDisplay(sender)
      )
    } else {
      const { count: totalCount, error: countError } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) {
        console.error('Error counting emails:', countError)
        return NextResponse.json({ error: 'Failed to count emails' }, { status: 500 })
      }

      count = totalCount
    }

    const { data: syncJob, error: syncJobError } = await supabase
      .from('email_sync_jobs')
      .select('updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (syncJobError) {
      console.error('Error getting sync job timestamp:', syncJobError)
    }

    let lastSyncTime: string | null = syncJob?.updated_at ?? null

    if (!lastSyncTime) {
      let lastEmailQuery = supabase
        .from('emails')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (sender) {
        const senderKey = normalizeSenderForDisplay(sender)
        const { count: keyCount, error: keyError } = await supabase
          .from('emails')
          .select('created_at', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('sender_key', senderKey)

        if (!keyError && (keyCount ?? 0) > 0) {
          lastEmailQuery = supabase
            .from('emails')
            .select('created_at')
            .eq('user_id', user.id)
            .eq('sender_key', senderKey)
            .order('created_at', { ascending: false })
            .limit(1)
        }
      }

      const { data: lastEmail, error: lastEmailError } = await lastEmailQuery.single()

      if (lastEmailError && lastEmailError.code !== 'PGRST116') {
        console.error('Error getting last email:', lastEmailError)
      }

      lastSyncTime = lastEmail?.created_at || null
    }

    return NextResponse.json({
      totalEmails: count || 0,
      lastSyncTime,
    })
  } catch (error) {
    console.error('Email count API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
