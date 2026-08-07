import { NextResponse } from 'next/server'

/**
 * Weekly Vercel Cron: one REST read so free-tier Supabase does not
 * hard-pause after 7 days of inactivity. No sync, no writes.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase env is not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/emails?select=id&limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json(
        { ok: false, status: res.status, detail: detail.slice(0, 200) },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'keepalive failed'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
