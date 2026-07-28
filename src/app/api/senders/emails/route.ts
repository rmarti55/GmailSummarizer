import { createClient } from '@/lib/supabase/server'
import {
  fetchSenderEmailsPage,
  parseSenderEmailsRequest,
} from '@/lib/sender-emails-query'
import { normalizeSenderForDisplay, normalizeSenderKey } from '@/lib/sender-utils'
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
    const senderKey = normalizeSenderKey(normalizeSenderForDisplay(sender))

    const result = await fetchSenderEmailsPage(supabase, user.id, sender, page, limit)

    console.info(
      `[sender-emails] user=${user.id} input=${JSON.stringify(sender)} key=${JSON.stringify(senderKey)} total=${result.pagination.total}`
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Sender emails API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
