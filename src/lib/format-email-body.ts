const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201D',
  ldquo: '\u201C',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
}

function decodeHtmlEntitiesOnce(text: string): string {
  return text
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => {
      const decoded = NAMED_HTML_ENTITIES[name.toLowerCase()]
      return decoded ?? match
    })
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    )
}

/**
 * Decode HTML entities, including double-encoded values like You&amp;#39;re.
 * Safe to call on already-clean text.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return ''

  let prev = text
  let out = text

  do {
    prev = out
    out = decodeHtmlEntitiesOnce(out)
  } while (out !== prev)

  return out
}

/**
 * Split stored email body text into display blocks.
 * Handles multi-line bodies and legacy single-line flattened content.
 */
export function splitEmailBodyIntoBlocks(text: string): string[] {
  if (!text?.trim()) return []

  const normalized = decodeHtmlEntities(text).replace(/\r\n/g, '\n').trim()

  let blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[^\S\n]+/g, ' ').trim())
    .filter(Boolean)

  if (blocks.length === 1 && blocks[0].includes('\n')) {
    blocks = blocks[0]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  // Legacy fallback: recover breaks in flattened marketing/newsletter text
  if (blocks.length === 1 && blocks[0].length > 120 && !blocks[0].includes('\n')) {
    blocks = blocks[0]
      .replace(/([a-z0-9])([A-Z])/g, '$1\n$2')
      .replace(/([.!?])\s*(?=[A-Z])/g, '$1\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  return blocks
}

export function isLikelyListLine(line: string): boolean {
  return /^[\s•\-\*]|^\d+[.)]\s/.test(line)
}
