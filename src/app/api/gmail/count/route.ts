import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '0', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // If requesting emails with pagination
    if (limit > 0) {
      const { data: emails, error: emailsError } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (emailsError) {
        console.error('Error fetching emails:', emailsError)
        return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
      }

      return NextResponse.json({ emails: emails || [] })
    }

    // Original count functionality
    const { count, error: countError } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error counting emails:', countError)
      return NextResponse.json({ error: 'Failed to count emails' }, { status: 500 })
    }

    // Get last sync time (from most recent email)
    const { data: lastEmail, error: lastEmailError } = await supabase
      .from('emails')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastEmailError && lastEmailError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error getting last email:', lastEmailError)
    }

    return NextResponse.json({ 
      totalEmails: count || 0,
      lastSyncTime: lastEmail?.created_at || null
    })

  } catch (error) {
    console.error('Email count API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
