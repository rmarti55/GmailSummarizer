import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fetchSenderEmailsPage } from '../src/lib/sender-emails-query'
import { normalizeSenderKey } from '../src/lib/sender-utils'

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

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient(url, key)

  const { data: uidRow, error: uidError } = await supabase.from('emails').select('user_id').limit(1)
  if (uidError || !uidRow?.[0]?.user_id) {
    throw new Error('Could not resolve user_id from emails table')
  }
  const userId = uidRow[0].user_id

  const cases = [
    { sender: "Levi's", minTotal: 7 },
    { sender: 'AT&T Online Services', minTotal: 8 },
    { sender: 'Mayowa Tomori', minTotal: 35 },
  ]

  let failed = false

  for (const testCase of cases) {
    const result = await fetchSenderEmailsPage(supabase, userId, testCase.sender, 1, 10)
    const ok = result.pagination.total >= testCase.minTotal
    console.log(
      ok ? 'PASS' : 'FAIL',
      testCase.sender,
      `total=${result.pagination.total} (min ${testCase.minTotal})`
    )
    if (!ok) failed = true
  }

  const senderKey = normalizeSenderKey("Levi's")
  const { count: keyCount, error: keyError } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('sender_key', senderKey)

  if (keyError) {
    console.log('WARN sender_key column not queryable yet:', keyError.message)
  } else {
    const ok = (keyCount ?? 0) >= 7
    console.log(ok ? 'PASS' : 'FAIL', 'sender_key Levi\'s', `total=${keyCount ?? 0}`)
    if (!ok) failed = true
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
