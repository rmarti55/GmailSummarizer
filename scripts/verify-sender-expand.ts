/**
 * DB identity verification only — calls fetchSenderEmailsPage against Supabase
 * with the service role. Does NOT prove browser expand / network resilience.
 */
import { readFileSync } from 'fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchSenderEmailsPage } from '../src/lib/sender-emails-query'
import { getSenderQueryValues, normalizeSenderKey } from '../src/lib/sender-utils'

function loadEnv() {
  const envPath = '.env.local'
  const env = readFileSync(envPath, 'utf8')
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()
  if (!url || !key) {
    throw new Error('Missing Supabase credentials in .env.local')
  }
  return { url, key }
}

async function resolveUserIdForSender(
  supabase: SupabaseClient,
  sender: string
): Promise<string | null> {
  const senderKey = normalizeSenderKey(sender)

  const { data: byKey } = await supabase
    .from('emails')
    .select('user_id')
    .eq('sender_key', senderKey)
    .limit(1)

  if (byKey?.[0]?.user_id) {
    return byKey[0].user_id as string
  }

  for (const variant of getSenderQueryValues(sender)) {
    const { data } = await supabase.from('emails').select('user_id').eq('sender', variant).limit(1)
    if (data?.[0]?.user_id) {
      return data[0].user_id as string
    }
  }

  return null
}

async function main() {
  const { url, key } = loadEnv()
  const supabase: SupabaseClient = createClient(url, key)

  const cases = [
    { sender: "Levi's", minTotal: 1 },
    { sender: 'AT&T Online Services', minTotal: 1 },
    { sender: 'Mayowa Tomori', minTotal: 1 },
    { sender: "Info Sweet Maria's Customer Service", minTotal: 5 },
  ]

  let failed = false
  let checked = 0

  for (const testCase of cases) {
    const userId = await resolveUserIdForSender(supabase, testCase.sender)
    if (!userId) {
      console.log('SKIP', testCase.sender, '(no rows in DB)')
      continue
    }

    checked += 1
    const result = await fetchSenderEmailsPage(supabase, userId, testCase.sender, 1, 10)
    const ok = result.pagination.total >= testCase.minTotal
    console.log(
      ok ? 'PASS' : 'FAIL',
      testCase.sender,
      `total=${result.pagination.total} (min ${testCase.minTotal})`
    )
    if (!ok) failed = true
  }

  const sweetKey = normalizeSenderKey("Info Sweet Maria's Customer Service")
  const sweetUserId = await resolveUserIdForSender(supabase, "Info Sweet Maria's Customer Service")
  if (sweetUserId) {
    const { count: keyCount, error: keyError } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', sweetUserId)
      .eq('sender_key', sweetKey)

    if (keyError) {
      console.log('WARN sender_key column not queryable yet:', keyError.message)
    } else {
      checked += 1
      const ok = (keyCount ?? 0) >= 5
      console.log(
        ok ? 'PASS' : 'FAIL',
        "sender_key Info Sweet Maria's Customer Service",
        `total=${keyCount ?? 0}`
      )
      if (!ok) failed = true
    }
  }

  if (checked === 0) {
    process.exitCode = 1
    console.error('\nSender expand verification failed: no senders found in DB')
    return
  }

  if (failed) {
    process.exitCode = 1
    console.error('\nSender expand verification failed')
    return
  }

  console.log('\nSender expand verification passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
