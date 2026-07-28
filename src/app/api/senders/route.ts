import { createClient } from '@/lib/supabase/server'
import { backfillSenderKeysForUser, backfillSenderKindsForUser, countSendersByKind } from '@/lib/sender-backfill'
import { enrichSenderStats, normalizeSenderKey, normalizeSenderStats } from '@/lib/sender-utils'
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
    await backfillSenderKeysForUser(supabase, user.id)

    const { data: senderStats, error: statsError } = await supabase.rpc('get_sender_statistics', {
      user_id: user.id,
    })

    if (statsError) {
      console.error('Error fetching sender statistics:', statsError)

      const { data: emails, error: emailsError } = await supabase
        .from('emails')
        .select('sender, sender_key, from_email, from_domain, sender_kind')
        .eq('user_id', user.id)

      if (emailsError) {
        return NextResponse.json({ error: 'Failed to fetch sender data' }, { status: 500 })
      }

      const senderBuckets = new Map<
        string,
        {
          count: number
          kind?: string | null
          from_email?: string | null
          from_domain?: string | null
        }
      >()

      for (const email of emails ?? []) {
        const bucketKey = normalizeSenderKey(email.sender_key ?? email.sender)
        const bucket = senderBuckets.get(bucketKey) ?? {
          count: 0,
          kind: email.sender_kind,
          from_email: email.from_email,
          from_domain: email.from_domain,
        }
        bucket.count += 1
        bucket.kind = email.sender_kind ?? bucket.kind
        bucket.from_email = bucket.from_email ?? email.from_email
        bucket.from_domain = bucket.from_domain ?? email.from_domain
        senderBuckets.set(bucketKey, bucket)
      }

      const totalEmails = emails?.length ?? 0
      const senders = enrichSenderStats(
        normalizeSenderStats(
          Array.from(senderBuckets.entries()).map(([sender, bucket]) => ({
            sender,
            count: bucket.count,
            percentage:
              totalEmails > 0
                ? Math.round((bucket.count / totalEmails) * 100 * 10) / 10
                : 0,
            kind: bucket.kind,
          }))
        )
      )

      return NextResponse.json({
        senders,
        counts: countSendersByKind(senders),
      })
    }

    const senders = enrichSenderStats(normalizeSenderStats(senderStats || []))

    return NextResponse.json({
      senders,
      counts: countSendersByKind(senders),
    })
  } catch (error) {
    console.error('Senders API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
