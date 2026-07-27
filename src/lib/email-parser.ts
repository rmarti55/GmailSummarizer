import * as cheerio from 'cheerio'
import { decodeHtmlEntities } from './format-email-body'

const BLOCK_SELECTORS =
  'p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, hr, section, article, header, footer, td, th, pre'

export class EmailContentParser {
  /**
   * Insert line breaks before block elements so .text() preserves structure.
   */
  private static insertBlockBreaks($: cheerio.CheerioAPI): void {
    $('br').replaceWith('\n')

    $(BLOCK_SELECTORS).each((_, element) => {
      const el = $(element)
      el.prepend('\n')
      el.append('\n')
    })
  }

  /**
   * Normalize whitespace while preserving paragraph breaks.
   */
  private static normalizeStructuredText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  /**
   * Extract clean, readable text from email HTML content
   * Handles malformed HTML, Microsoft Office markup, and nested structures
   */
  static extractCleanText(htmlContent: string): string {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return ''
    }

    try {
      const $ = cheerio.load(htmlContent, {
        xml: { xmlMode: false },
      })

      $('script, style, noscript').remove()
      $('[class*="mso-"], [style*="mso-"]').remove()

      this.insertBlockBreaks($)

      const rawText = $('body').length > 0 ? $('body').text() : $.text()
      return this.normalizeStructuredText(rawText)
    } catch (error) {
      console.warn('Failed to parse HTML content with cheerio:', error)
      return this.fallbackTextExtraction(htmlContent)
    }
  }

  /**
   * Fallback text extraction for when cheerio fails
   */
  private static fallbackTextExtraction(htmlContent: string): string {
    const withBreaks = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article|header|footer|td|th|pre)>/gi, '\n\n')
      .replace(/<[^>]*>/g, ' ')

    return this.normalizeStructuredText(withBreaks)
  }

  /**
   * Extract core message content, removing reply chains and signatures
   */
  static extractCoreMessage(text: string): string {
    if (!text) return ''

    const fromLinePattern = /^\s*From:\s/m
    const match = text.search(fromLinePattern)

    let coreMessage = text
    if (match !== -1) {
      coreMessage = text.substring(0, match)
    }

    coreMessage = coreMessage
      .replace(/--\s*$/m, '')
      .replace(/^>+\s*/gm, '')
      .replace(/\s*>+\s*/g, ' ')

    return this.normalizeStructuredText(coreMessage)
  }

  /**
   * Clean and format message content for display
   */
  static formatForDisplay(text: string): string {
    if (!text) return ''

    const cleaned = text.replace(/<?\b(?:https?:\/\/|www\.)[^\s<>]+>?/gi, '[link]')

    const paragraphs = cleaned
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map((p) => p.replace(/[^\S\n]+/g, ' ').trim())
      .filter((p) => p.length > 0)

    return paragraphs.join('\n\n')
  }

  /**
   * Complete email content processing pipeline
   */
  static processEmailContent(htmlContent: string): string {
    const cleanText = this.extractCleanText(htmlContent)
    const coreMessage = this.extractCoreMessage(cleanText)
    const formattedText = this.formatForDisplay(coreMessage)

    return decodeHtmlEntities(formattedText)
  }
}
