import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyStoredSenderRow } from '@/lib/sender-utils'

const BACKFILL_BATCH_SIZE = 250

export async function backfillSenderKindsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  let updatedCount = 0

  while (true) {
    const { data, error } = await supabase
      .from('emails')
      .select('id, sender, from_email, from_domain, sender_kind')
      .eq('user_id', userId)
      .is('sender_kind', null)
      .limit(BACKFILL_BATCH_SIZE)

    if (error) {
      console.error('[sender-backfill] Failed to fetch rows:', error)
      break
    }

    if (!data?.length) {
      break
    }

    const updates = data.map((row) => {
      const classified = classifyStoredSenderRow({
        sender: row.sender,
        from_email: row.from_email,
        from_domain: row.from_domain,
      })

      return {
        id: row.id,
        sender_kind: classified.senderKind,
        from_email: row.from_email ?? classified.email,
        from_domain: row.from_domain ?? classified.domain,
      }
    })

    const updateResults = await Promise.all(
      updates.map((update) =>
        supabase
          .from('emails')
          .update({
            sender_kind: update.sender_kind,
            from_email: update.from_email,
            from_domain: update.from_domain,
          })
          .eq('id', update.id)
          .eq('user_id', userId)
      )
    )

    const failedUpdate = updateResults.find((result) => result.error)
    if (failedUpdate?.error) {
      console.error('[sender-backfill] Failed to update rows:', failedUpdate.error)
      break
    }

    updatedCount += updates.length
    if (data.length < BACKFILL_BATCH_SIZE) {
      break
    }
  }

  return updatedCount
}

export function countSendersByKind(
  senders: Array<{ kind: 'person' | 'organization' | 'unknown' }>
) {
  return senders.reduce(
    (counts, sender) => {
      counts.all += 1
      counts[sender.kind] += 1
      return counts
    },
    { all: 0, person: 0, organization: 0, unknown: 0 }
  )
}
