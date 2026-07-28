export type SenderKind = 'person' | 'organization' | 'unknown'

const UNKNOWN_SENDER = 'Unknown sender'

export interface SenderClassificationInput {
  displayName: string
  email?: string | null
  domain?: string | null
}

function stripRfc5322Quotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }
  return trimmed
}

const AUTOMATED_LOCAL_PARTS = [
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'donotreply',
  'notifications',
  'notification',
  'alerts',
  'alert',
  'mailer-daemon',
  'postmaster',
  'bounce',
  'auto-receipt',
  'billpay',
  'billnotif',
]

const ROLE_LOCAL_PREFIXES = [
  'support',
  'billing',
  'service',
  'info',
  'team',
  'news',
  'newsletter',
  'help',
  'customerservice',
  'customer.service',
  'notice',
  'notices',
  'updates',
  'update',
  'security',
  'accounts',
  'account',
  'payroll',
  'care',
  'sales',
  'marketing',
  'feedback',
  'receipts',
  'orders',
  'shipping',
  'returns',
  'merchant',
  'careers',
  'jobs',
  'hr',
]

const ORG_NAME_PATTERNS = [
  /\binc\.?\b/i,
  /\bllc\.?\b/i,
  /\bltd\.?\b/i,
  /\bcorp\.?\b/i,
  /\bcorporation\b/i,
  /\bcompany\b/i,
  /\bdepartment\b/i,
  /\boffice\b/i,
  /\bservices\b/i,
  /\bcustomer service\b/i,
  /\bsupport\b/i,
  /\bteam\b/i,
  /\bnotifications?\b/i,
  /\bportal\b/i,
  /\bcity of\b/i,
  /\bcounty\b/i,
  /\bstate of\b/i,
  /\bu\.s\. department\b/i,
  /\bdepartment of\b/i,
  /\bpublic records\b/i,
  /\bagendas?\s*&\s*minutes\b/i,
  /\bmetropolitan\b/i,
  /\binsurance\b/i,
  /\bbank\b/i,
  /\bfinancial\b/i,
  /\bcredit\b/i,
  /\brewards\b/i,
  /\bsettlement administrator\b/i,
  /\bonline services\b/i,
  /\baccount management\b/i,
  /\bprotect advantage\b/i,
  /\bworkspace team\b/i,
  /\bdeveloper\b/i,
  /\brenewals\b/i,
  /\balerts\b/i,
  /\bvia google groups\b/i,
  /\bvia google sheets\b/i,
  /\bvia google docs\b/i,
  /\bvia google drive\b/i,
  /\bvia google chat\b/i,
  /\bvia google meet\b/i,
  /\bvia google forms\b/i,
  /\bvia dropbox\b/i,
  /\bvia testflight\b/i,
  /\bvia shopify\b/i,
  /\bvia actionnetwork\b/i,
  /\bvia calendly\b/i,
  /\bvia zoom\b/i,
  /\bvia adobe\b/i,
  /\bvia docusign\b/i,
  /\bvia intuit\b/i,
  /\bvia rally\b/i,
  /\bvia meal train\b/i,
  /\bvia todoist\b/i,
  /\bmail delivery subsystem\b/i,
  /\bdo not reply\b/i,
  /®|™/,
]

const VIA_SUFFIX_PATTERN = /\s*\(via .+\)$/i

function normalizeText(value: string): string {
  return stripRfc5322Quotes(value).trim()
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null
  return trimmed.slice(atIndex + 1)
}

function isBareEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getLocalPart(email: string): string {
  const atIndex = email.indexOf('@')
  return atIndex > 0 ? email.slice(0, atIndex).toLowerCase() : email.toLowerCase()
}

function hasAutomatedLocalPart(email: string): boolean {
  const local = getLocalPart(email)
  return AUTOMATED_LOCAL_PARTS.some(
    (part) => local === part || local.startsWith(`${part}.`) || local.startsWith(`${part}+`)
  )
}

function hasRoleLocalPart(email: string): boolean {
  const local = getLocalPart(email)
  return ROLE_LOCAL_PREFIXES.some(
    (prefix) =>
      local === prefix ||
      local.startsWith(`${prefix}.`) ||
      local.startsWith(`${prefix}+`) ||
      local.startsWith(`${prefix}-`)
  )
}

function hasOrgNamePattern(name: string): boolean {
  return ORG_NAME_PATTERNS.some((pattern) => pattern.test(name))
}

function isAllCapsOrgName(name: string): boolean {
  const letters = name.replace(/[^A-Za-z]/g, '')
  if (letters.length < 4) return false
  const uppercaseRatio = (name.match(/[A-Z]/g)?.length ?? 0) / letters.length
  return uppercaseRatio > 0.85 && !looksLikeLastFirstName(name)
}

function looksLikeLastFirstName(name: string): boolean {
  return /^[A-Za-z][A-Za-z.'-]+,\s+[A-Za-z]/.test(name)
}

function looksLikePersonName(name: string): boolean {
  const cleaned = normalizeText(name).replace(VIA_SUFFIX_PATTERN, '').trim()
  if (!cleaned || cleaned === UNKNOWN_SENDER) return false
  if (hasOrgNamePattern(cleaned) || isAllCapsOrgName(cleaned)) return false
  if (isBareEmail(cleaned)) return false

  if (looksLikeLastFirstName(cleaned)) {
    return true
  }

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 4) {
    return false
  }

  const nameLike = words.every(
    (word) =>
      /^[A-Za-z][A-Za-z.'-]*$/.test(word) ||
      /^[A-Z]+\.$/.test(word) ||
      /^[A-Z][a-z]+(?:'[A-Za-z]+)?$/.test(word)
  )

  return nameLike
}

function isOrganizationSignal(input: SenderClassificationInput): boolean {
  const displayName = normalizeText(input.displayName)
  const email = input.email?.trim().toLowerCase() ?? (isBareEmail(displayName) ? displayName : '')
  const domain = input.domain?.trim().toLowerCase() ?? extractEmailDomain(email)

  if (displayName === UNKNOWN_SENDER) {
    return false
  }

  if (email) {
    if (hasAutomatedLocalPart(email) || hasRoleLocalPart(email)) {
      return true
    }
  }

  if (hasOrgNamePattern(displayName) || isAllCapsOrgName(displayName)) {
    return true
  }

  if (isBareEmail(displayName)) {
    return true
  }

  if (VIA_SUFFIX_PATTERN.test(displayName)) {
    return true
  }

  if (domain) {
    const marketingDomains = ['mail.', 'email.', 'e.', 'm.', 'notify.', 'transactional.']
    if (marketingDomains.some((prefix) => domain.startsWith(prefix))) {
      return true
    }
  }

  return false
}

export function classifySenderKind(input: SenderClassificationInput): SenderKind {
  const displayName = normalizeText(input.displayName)
  const email =
    input.email?.trim().toLowerCase() ??
    (isBareEmail(displayName) ? displayName : null)
  const domain = input.domain?.trim().toLowerCase() ?? extractEmailDomain(email)

  if (!displayName || displayName === UNKNOWN_SENDER) {
    return 'unknown'
  }

  if (isOrganizationSignal({ displayName, email, domain })) {
    return 'organization'
  }

  if (looksLikePersonName(displayName)) {
    return 'person'
  }

  return 'unknown'
}

export function classifySenderKindFromStored(
  sender: string,
  fromEmail?: string | null,
  fromDomain?: string | null
): SenderKind {
  const displayName = normalizeText(sender)
  const email = fromEmail?.trim().toLowerCase() ?? (isBareEmail(displayName) ? displayName : null)
  const domain = fromDomain?.trim().toLowerCase() ?? extractEmailDomain(email)

  return classifySenderKind({
    displayName,
    email,
    domain,
  })
}

export function resolveMajoritySenderKind(
  kindCounts: Map<SenderKind, number>
): SenderKind {
  let winner: SenderKind = 'unknown'
  let winnerCount = -1

  for (const kind of ['person', 'organization', 'unknown'] as const) {
    const count = kindCounts.get(kind) ?? 0
    if (count > winnerCount) {
      winner = kind
      winnerCount = count
    }
  }

  return winner
}
