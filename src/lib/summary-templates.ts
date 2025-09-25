// Simple Email Summary Templates
// Generates clean, readable summaries without classification complexity

export interface SummaryTemplate {
  prompt: string
  maxTokens: number
  temperature: number
}

export class SummaryTemplateEngine {
  
  public static getTemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return this.getCleanTemplate(email)
  }

  private static getCleanTemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return {
      prompt: `Summarize this email in 2-3 clear sentences. Focus on what the sender wants or is telling you. Be conversational and helpful.

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Write a natural summary that explains:
- What this email is about
- Any actions needed (if any)
- Important details like dates or deadlines

Keep it simple and readable - no emojis, no formatting, just clear text.`,
      maxTokens: 120,
      temperature: 0.2
    }
  }

  // Simple post-processing - just clean up the text
  public static formatSummary(rawSummary: string): string {
    if (!rawSummary || rawSummary.trim().length === 0) {
      return 'Unable to generate summary. Please check the full email.'
    }

    // Remove HTML tags and clean up formatting
    let cleanSummary = rawSummary.replace(/<[^>]*>/g, '')
    cleanSummary = cleanSummary.replace(/<br\s*\/?>/gi, '\n')
    cleanSummary = cleanSummary.replace(/\n\s*\n/g, '\n\n').trim()
    
    return cleanSummary
  }
}
