/**
 * Verify Google OAuth env configuration and print Production-mode checklist.
 *
 * Usage: npm run verify:google-oauth
 */

import { readFileSync } from 'fs'

function loadEnvLocal() {
  try {
    const env = readFileSync('.env.local', 'utf8')
    for (const line of env.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = rawValue.trim()
      }
    }
  } catch {
    // .env.local is optional when vars are already exported
  }
}

loadEnvLocal()

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim()
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim()

function pass(message: string) {
  console.log(`✓ ${message}`)
}

function fail(message: string) {
  console.error(`✗ ${message}`)
}

function warn(message: string) {
  console.warn(`! ${message}`)
}

function main() {
  console.log('Google OAuth verification\n')

  let ok = true

  if (!CLIENT_ID) {
    fail('GOOGLE_CLIENT_ID is missing')
    ok = false
  } else if (!/\.apps\.googleusercontent\.com$/.test(CLIENT_ID)) {
    warn('GOOGLE_CLIENT_ID does not look like a Google OAuth client ID')
  } else {
    pass(`GOOGLE_CLIENT_ID is set (${CLIENT_ID.slice(0, 12)}…)`)
  }

  if (!CLIENT_SECRET) {
    fail('GOOGLE_CLIENT_SECRET is missing')
    ok = false
  } else if (!CLIENT_SECRET.startsWith('GOCSPX-')) {
    warn('GOOGLE_CLIENT_SECRET does not look like a Google client secret (expected GOCSPX- prefix)')
  } else {
    pass('GOOGLE_CLIENT_SECRET is set')
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    fail('SUPABASE_SERVICE_ROLE_KEY is missing — refresh tokens cannot be stored in gmail_credentials')
    ok = false
  } else {
    pass('SUPABASE_SERVICE_ROLE_KEY is set')
  }

  console.log('\nManual checks (Google Cloud Console):')
  console.log('1. APIs & Services → OAuth consent screen → Publishing status must be "In production"')
  console.log('   Testing mode expires refresh tokens after ~7 days and causes disconnects.')
  console.log('2. Credentials → OAuth 2.0 Client IDs → Web client must match GOOGLE_CLIENT_ID above')
  console.log('3. Same client ID/secret must be configured in Supabase Auth → Providers → Google')
  console.log('4. Same client ID/secret must be set on Vercel (production environment)')
  console.log('5. Authorized redirect URIs must include your Supabase callback URL')

  if (!ok) {
    console.error('\nFix the failed checks above, then re-run: npm run verify:google-oauth')
    process.exit(1)
  }

  console.log('\nEnv checks passed. Complete the manual Google Cloud Console steps if not done yet.')
}

main()
