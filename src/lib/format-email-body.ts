/**
 * Split stored email body text into display blocks.
 * Handles multi-line bodies and legacy single-line flattened content.
 */
export function splitEmailBodyIntoBlocks(text: string): string[] {
  if (!text?.trim()) return []

  const normalized = text.replace(/\r\n/g, '\n').trim()

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
