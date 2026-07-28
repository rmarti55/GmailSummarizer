import { createClient } from '@/lib/supabase/server'
import { backfillSenderKindsForUser, countSendersByKind } from '@/lib/sender-backfill'
import { classifyStoredSenderRow, normalizeSenderStats } from '@/lib/sender-utils'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await backfillSenderKindsForUser(supabase, user.id)

    const { data: senderStats, error: statsError } = await supabase.rpc('get_sender_statistics', {
      user_id: user.id,
    })

    if (statsError) {
      console.error('Error fetching sender statistics:', statsError)

      const { data: emails, error: emailsError } = await supabase
        .from('emails')
        .select('sender, from_email, from_domain, sender_kind')
        .eq('user_id', user.id)

      if (emailsError) {
        return NextResponse.json({ error: 'Failed to fetch sender data' }, { status: 500 })
      }

      const senderBuckets = new Map<
        string,
        { count: number; kindCounts: Map<'person' | 'organization' | 'unknown', number> }
      >()

      for (const email of emails ?? []) {
        const sender = email.sender
        const classified = classifyStoredSenderRow({
          sender,
          from_email: email.from_email,
          from_domain: email.from_domain,
        })
        const kind = email.sender_kind ?? classified.senderKind
        const bucket = senderBuckets.get(sender) ?? {
          count: 0,
          kindCounts: new Map<'person' | 'organization' | 'unknown', number>(),
        }
        bucket.count += 1
        bucket.kindCounts.set(kind, (bucket.kindCounts.get(kind) ?? 0) + 1)
        senderBuckets.set(sender, bucket)
      }

      const totalEmails = emails?.length ?? 0
      const senders = normalizeSenderStats(
        Array.from(senderBuckets.entries()).map(([sender, bucket]) => {
          let winner: 'person' | 'organization' | 'unknown' = 'unknown'
          let winnerCount = -1
          for (const kind of ['person', 'organization', 'unknown'] as const) {
            const count = bucket.kindCounts.get(kind) ?? 0
            if (count > winnerCount) {
              winner = kind
              winnerCount = count
            }
          }

          return {
            sender,
            count: bucket.count,
            percentage:
              totalEmails > 0
                ? Math.round((bucket.count / totalEmails) * 100 * 10) / 10
                : 0,
            kind: winner,
          }
        })
      )

      return NextResponse.json({
        senders,
        counts: countSendersByKind(senders),
      })
    }

    const senders = normalizeSenderStats(senderStats || [])

    return NextResponse.json({
      senders,
      counts: countSendersByKind(senders),
    })
  } catch (error) {
    console.error('Senders API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
