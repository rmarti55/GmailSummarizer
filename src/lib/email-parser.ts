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
        xml: { xmlMode: false },
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

    // Simple, reliable approach: Split at "From:" line which marks reply chain start
    // This works consistently across Gmail, Outlook, Apple Mail, etc.
    const fromLinePattern = /^\s*From:\s/m
    const match = text.search(fromLinePattern)
    
    let coreMessage = text
    if (match !== -1) {
      // Found reply chain marker - keep only content before it
      coreMessage = text.substring(0, match)
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
    const cleaned = text.replace(/<?\b(?:https?:\/\/|www\.)[^\s<>]+>?/gi, '[link]')
    
    // Simple paragraph splitting - keep existing line breaks if they exist
    const paragraphs = cleaned
      .split(/\n\s*\n|\r\n\s*\r\n/) // Split on double line breaks
      .map(p => p.replace(/\s+/g, ' ').trim()) // Clean whitespace within paragraphs
      .filter(p => p.length > 0) // Remove empty paragraphs

    // Return as single line for consistent database storage
    return paragraphs.join(' ')
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
