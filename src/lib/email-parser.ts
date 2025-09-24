import * as cheerio from 'cheerio'

export class EmailContentParser {
  
  /**
   * Extract clean, readable text from email HTML content
   * Handles malformed HTML, Microsoft Office markup, and nested structures
   */
  static extractCleanText(htmlContent: string): string {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return ''
    }

    try {
      // Load HTML with cheerio - handles malformed tags gracefully
      const $ = cheerio.load(htmlContent, {
        // Use htmlparser2 for better malformed HTML handling
        xml: { xmlMode: false },
        // Decode HTML entities properly
        decodeEntities: true
      })

      // Remove script, style, and noscript blocks entirely
      $('script, style, noscript').remove()
      
      // Remove Microsoft Office XML namespaces and conditional comments
      $('[class*="mso-"], [style*="mso-"]').remove()
      
      // Extract clean text from body, fallback to entire document
      let cleanText = $('body').length > 0 ? $('body').text() : $.text()
      
      // Clean up whitespace and formatting
      cleanText = cleanText
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/\n\s*\n/g, '\n')  // Remove excessive line breaks
        .trim()

      return cleanText
    } catch (error) {
      console.warn('Failed to parse HTML content with cheerio:', error)
      // Fallback to basic text extraction
      return this.fallbackTextExtraction(htmlContent)
    }
  }

  /**
   * Fallback text extraction for when cheerio fails
   */
  private static fallbackTextExtraction(htmlContent: string): string {
    return htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Strip remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Extract core message content, removing reply chains and signatures
   */
  static extractCoreMessage(text: string): string {
    if (!text) return ''

    // Split at common reply markers and take only the first part
    const replyMarkers = [
      /On .+? wrote:/i,
      /From:.+?Sent:/i,
      /-----Original Message-----/i,
      /----- Forwarded Message -----/i,
      /\d{1,2}\/\d{1,2}\/\d{4}.+?wrote:/i,
      /________________________________/i // Outlook separator
    ]
    
    let coreMessage = text
    for (const marker of replyMarkers) {
      const match = coreMessage.search(marker)
      if (match !== -1) {
        coreMessage = coreMessage.substring(0, match)
        break
      }
    }
    
    // Remove email signatures (common patterns)
    coreMessage = coreMessage
      .replace(/--\s*$/m, '') // Standard signature separator
      .replace(/^>+\s*/gm, '') // Remove reply arrows
      .replace(/\s*>+\s*/g, ' ') // Remove inline reply arrows
    
    return coreMessage.trim()
  }

  /**
   * Clean and format message content for display
   */
  static formatForDisplay(text: string): string {
    if (!text) return ''

    // Remove URLs for cleaner display
    let cleaned = text.replace(/<?\b(?:https?:\/\/|www\.)[^\s<>]+>?/gi, '[link]')
    
    // Split into paragraphs and preserve structure
    const paragraphs = cleaned
      .split(/\n\s*\n|\r\n\s*\r\n/) // Split on double line breaks
      .map(p => p.replace(/\s+/g, ' ').trim()) // Clean whitespace within paragraphs
      .filter(p => p.length > 0) // Remove empty paragraphs

    // Intelligent truncation - take first 2-3 paragraphs or ~200 words
    let result = ''
    let wordCount = 0
    const maxWords = 200
    let truncated = false
    
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ')
      if (wordCount + words.length > maxWords && result.length > 0) {
        truncated = true
        break
      }
      result += paragraph + '\n\n'
      wordCount += words.length
    }
    
    // Add ellipsis if truncated
    if (truncated) {
      result = result.trim() + '...'
    }
    
    return result.trim()
  }

  /**
   * Complete email content processing pipeline
   */
  static processEmailContent(htmlContent: string): string {
    // Step 1: Extract clean text from HTML
    const cleanText = this.extractCleanText(htmlContent)
    
    // Step 2: Remove reply chains and signatures  
    const coreMessage = this.extractCoreMessage(cleanText)
    
    // Step 3: Format for display
    const formattedText = this.formatForDisplay(coreMessage)
    
    return formattedText
  }
}
