export const UNKNOWN_SENDER = 'Unknown sender'

export interface SenderStatsEntry {
  sender: string
  count: number
  percentage: number
}

/** Parse a Gmail From header into a display-safe sender name. */
export function parseSenderFromHeader(fromHeader: string): string {
  const trimmed = fromHeader.trim()
  if (!trimmed || trimmed === 'Unknown') {
    return UNKNOWN_SENDER
  }

  if (trimmed.includes('<')) {
    const displayName = trimmed.split('<')[0].trim()
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

  return trimmed
}

/** Map blank or whitespace-only stored senders to a display label. */
export function normalizeSenderForDisplay(sender: string | null | undefined): string {
  const trimmed = (sender ?? '').trim()
  return trimmed || UNKNOWN_SENDER
}

/** DB values to match when querying emails for a display sender. */
export function getSenderQueryValues(displaySender: string): string[] {
  const normalized = normalizeSenderForDisplay(displaySender)
  if (normalized === UNKNOWN_SENDER) {
    return ['', UNKNOWN_SENDER]
  }
  return [normalized]
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
