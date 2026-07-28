export const UNKNOWN_SENDER = 'Unknown sender'

export interface SenderStatsEntry {
  sender: string
  count: number
  percentage: number
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

/** Parse a Gmail From header into a display-safe sender name. */
export function parseSenderFromHeader(fromHeader: string): string {
  const trimmed = fromHeader.trim()
  if (!trimmed || trimmed === 'Unknown') {
    return UNKNOWN_SENDER
  }

  if (trimmed.includes('<')) {
    const displayName = stripRfc5322Quotes(trimmed.split('<')[0].trim())
    const emailMatch = trimmed.match(/<([^>]+)>/)
    const email = emailMatch?.[1]?.trim()

    if (displayName) {
      return displayName
    }
    if (email) {
      return email
    }
    return UNKNOWN_SENDER
  }

  return stripRfc5322Quotes(trimmed)
}

/** Map blank or whitespace-only stored senders to a display label. */
export function normalizeSenderForDisplay(sender: string | null | undefined): string {
  const trimmed = stripRfc5322Quotes((sender ?? '').trim())
  return trimmed || UNKNOWN_SENDER
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

/** Merge empty-string buckets into Unknown sender and recompute percentages. */
export function normalizeSenderStats(
  senders: Array<{ sender: string; count: number; percentage?: number }>
): SenderStatsEntry[] {
  const merged = new Map<string, number>()

  for (const entry of senders) {
    const key = normalizeSenderForDisplay(entry.sender)
    merged.set(key, (merged.get(key) ?? 0) + entry.count)
  }

  const totalEmails = Array.from(merged.values()).reduce((sum, count) => sum + count, 0)

  return Array.from(merged.entries())
    .map(([sender, count]) => ({
      sender,
      count,
      percentage:
        totalEmails > 0 ? Math.round((count / totalEmails) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}
