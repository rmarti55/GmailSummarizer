import { createClient } from '@/lib/supabase/server'
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
      let query = supabase.from('emails').select('*').eq('user_id', user.id)

      if (sender) {
        query = query.eq('sender', sender)
      }

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

    let countQuery = supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (sender) {
      countQuery = countQuery.eq('sender', sender)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting emails:', countError)
      return NextResponse.json({ error: 'Failed to count emails' }, { status: 500 })
    }

    // Prefer durable sync job timestamp over newest email date so
    // "Last synced" reflects when sync actually ran.
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
        lastEmailQuery = lastEmailQuery.eq('sender', sender)
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
