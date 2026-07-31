import {
  classifySenderKind,
  classifySenderKindFromStored,
  extractEmailDomain,
  resolveMajoritySenderKind,
  type SenderKind,
} from './sender-classifier'

export const UNKNOWN_SENDER = 'Unknown sender'

export type { SenderKind }

export interface ParsedSender {
  displayName: string
  email: string | null
  domain: string | null
  senderKind: SenderKind
}

export interface SenderStatsEntry {
  sender: string
  count: number
  percentage: number
  kind: SenderKind
}

/** Remove a single RFC5322 quoted-string wrapper and unescape doubled quotes. */
export function stripRfc5322Quotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }
  return trimmed
}

/** Escape a value for PostgREST eq/or filters (always double-quoted). */
export function escapePostgrestEqValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** Build a PostgREST or-filter matching sender against exact stored values. */
export function buildSenderEqOrFilter(senderValues: string[]): string {
  const unique = Array.from(new Set(senderValues))
  return unique.map((value) => `sender.eq.${escapePostgrestEqValue(value)}`).join(',')
}

/** Parse a Gmail From header into structured sender metadata. */
export function parseSenderFromHeaderDetailed(fromHeader: string): ParsedSender {
  const trimmed = fromHeader.trim()
  if (!trimmed || trimmed === 'Unknown') {
    const unknown: ParsedSender = {
      displayName: UNKNOWN_SENDER,
      email: null,
      domain: null,
      senderKind: 'unknown',
    }
    return unknown
  }

  let displayName = stripRfc5322Quotes(trimmed)
  let email: string | null = null

  if (trimmed.includes('<')) {
    displayName = stripRfc5322Quotes(trimmed.split('<')[0].trim())
    const emailMatch = trimmed.match(/<([^>]+)>/)
    email = emailMatch?.[1]?.trim().toLowerCase() ?? null

    if (!displayName && email) {
      displayName = email
    } else if (!displayName && !email) {
      displayName = UNKNOWN_SENDER
    }
  } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    email = stripRfc5322Quotes(trimmed).toLowerCase()
    displayName = email
  }

  const domain = extractEmailDomain(email)
  const senderKind = classifySenderKind({
    displayName,
    email,
    domain,
  })

  return {
    displayName,
    email,
    domain,
    senderKind,
  }
}

/** Parse a Gmail From header into a display-safe sender name. */
export function parseSenderFromHeader(fromHeader: string): string {
  return parseSenderFromHeaderDetailed(fromHeader).displayName
}

/** Canonical sender identity used for stats grouping and expand queries. */
export function normalizeSenderKey(sender: string | null | undefined): string {
  const trimmed = stripRfc5322Quotes((sender ?? '').trim()).replace(/[\u2018\u2019]/g, "'")
  return trimmed || UNKNOWN_SENDER
}

/** Map blank or whitespace-only stored senders to a display label. */
export function normalizeSenderForDisplay(sender: string | null | undefined): string {
  return normalizeSenderKey(sender)
}

/** DB values to match when querying emails for a display sender. */
export function getSenderQueryValues(displaySender: string): string[] {
  const normalized = normalizeSenderForDisplay(displaySender)
  if (normalized === UNKNOWN_SENDER) {
    return ['', UNKNOWN_SENDER]
  }

  const values = new Set<string>()
  values.add(normalized)
  // Legacy rows may still store RFC5322-quoted display names.
  values.add(`"${normalized}"`)
  return Array.from(values)
}

function normalizeSenderKind(kind: string | null | undefined): SenderKind {
  if (kind === 'person' || kind === 'organization' || kind === 'unknown') {
    return kind
  }
  return 'unknown'
}

/** Merge empty-string buckets into Unknown sender and recompute percentages. */
export function normalizeSenderStats(
  senders: Array<{ sender: string; count: number; percentage?: number; kind?: string | null }>
): SenderStatsEntry[] {
  const merged = new Map<string, { count: number; kindCounts: Map<SenderKind, number> }>()

  for (const entry of senders) {
    const key = normalizeSenderForDisplay(entry.sender)
    const existing = merged.get(key) ?? { count: 0, kindCounts: new Map<SenderKind, number>() }
    existing.count += entry.count
    const kind = normalizeSenderKind(entry.kind)
    existing.kindCounts.set(kind, (existing.kindCounts.get(kind) ?? 0) + entry.count)
    merged.set(key, existing)
  }

  const totalEmails = Array.from(merged.values()).reduce((sum, entry) => sum + entry.count, 0)

  return Array.from(merged.entries())
    .map(([sender, entry]) => ({
      sender,
      count: entry.count,
      percentage:
        totalEmails > 0 ? Math.round((entry.count / totalEmails) * 100 * 10) / 10 : 0,
      kind: resolveMajoritySenderKind(entry.kindCounts),
    }))
    .sort((a, b) => b.count - a.count || a.sender.localeCompare(b.sender))
}

/** Recompute percentages in place without changing list order. */
export function updateSenderPercentages(
  senders: SenderStatsEntry[],
  totalEmails: number
): SenderStatsEntry[] {
  return senders.map((entry) => ({
    ...entry,
    percentage:
      totalEmails > 0 ? Math.round((entry.count / totalEmails) * 100 * 10) / 10 : 0,
  }))
}

export function classifyStoredSenderRow(input: {
  sender: string
  from_email?: string | null
  from_domain?: string | null
}): Pick<ParsedSender, 'email' | 'domain' | 'senderKind'> {
  const displayName = normalizeSenderForDisplay(input.sender)
  const parsedEmail = input.from_email?.trim().toLowerCase() ?? null
  const email =
    parsedEmail ??
    (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(displayName) ? displayName : null)
  const domain = input.from_domain?.trim().toLowerCase() ?? extractEmailDomain(email)
  const senderKind = classifySenderKindFromStored(displayName, email, domain)

  return {
    email,
    domain,
    senderKind,
  }
}

/** Use DB kind when confident; otherwise classify from the stored display name. */
export function enrichSenderKind(
  sender: string,
  kind?: string | null,
  fromEmail?: string | null,
  fromDomain?: string | null
): SenderKind {
  const dbKind = normalizeSenderKind(kind)
  if (dbKind === 'person' || dbKind === 'organization') {
    return dbKind
  }

  return classifyStoredSenderRow({
    sender,
    from_email: fromEmail,
    from_domain: fromDomain,
  }).senderKind
}

/** Apply read-time classification so filters work even when DB kind is missing. */
export function enrichSenderStats(
  senders: SenderStatsEntry[],
  options?: {
    fromEmailBySender?: Map<string, string | null>
    fromDomainBySender?: Map<string, string | null>
  }
): SenderStatsEntry[] {
  return senders.map((entry) => ({
    ...entry,
    kind: enrichSenderKind(
      entry.sender,
      entry.kind,
      options?.fromEmailBySender?.get(entry.sender),
      options?.fromDomainBySender?.get(entry.sender)
    ),
  }))
}
