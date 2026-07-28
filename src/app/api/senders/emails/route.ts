import { createClient } from '@/lib/supabase/server'
import {
  fetchSenderEmailsPage,
  parseSenderEmailsRequest,
} from '@/lib/sender-emails-query'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { page, limit, sender } = parseSenderEmailsRequest(searchParams)

    const result = await fetchSenderEmailsPage(supabase, user.id, sender, page, limit)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Sender emails API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
