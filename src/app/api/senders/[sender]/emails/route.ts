import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { sender: string } }
) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = (page - 1) * limit

    // Decode the sender parameter (in case it contains special characters)
    const senderEmail = decodeURIComponent(params.sender)

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('sender', senderEmail)

    if (countError) {
      console.error('Error counting emails:', countError)
      return NextResponse.json({ error: 'Failed to count emails' }, { status: 500 })
    }

    // Get paginated emails for this sender
    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)
      .eq('sender', senderEmail)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (emailsError) {
      console.error('Error fetching sender emails:', emailsError)
      return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
    }

    const totalPages = Math.ceil((totalCount || 0) / limit)

    return NextResponse.json({
      emails: emails || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Sender emails API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
