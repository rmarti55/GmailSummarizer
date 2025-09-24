// Adaptive Summary Templates
// Generates context-aware summaries based on email classification

import { EmailType, EmailClassification } from './email-classifier'

export interface SummaryTemplate {
  prompt: string
  maxTokens: number
  temperature: number
  format: 'structured' | 'conversational' | 'minimal'
}

export class SummaryTemplateEngine {
  
  public static getTemplate(classification: EmailClassification, email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    switch (classification.type) {
      case EmailType.CRITICAL_ACTION:
        return this.getCriticalActionTemplate(email)
      
      case EmailType.QUICK_ACTION:
        return this.getQuickActionTemplate(email)
      
      case EmailType.FYI_UPDATE:
        return this.getFYITemplate(email)
      
      case EmailType.COMMERCIAL:
        return this.getCommercialTemplate(email)
      
      case EmailType.COMPLEX_CONTENT:
        return this.getComplexContentTemplate(email)
      
      default:
        return this.getDefaultTemplate(email)
    }
  }

  private static getCriticalActionTemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return {
      prompt: `🚨 URGENT EMAIL ANALYSIS - This appears to be a critical security or time-sensitive email that requires immediate attention.

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Provide a summary using this EXACT format:

🚨 **Urgent Action Needed**
[One clear sentence explaining what happened]

✅ **Do this now:**
1. [First action step]
2. [Second action step if needed]
3. [Third action step if needed]

⏰ **Why it matters:** [One sentence about consequences if ignored]

Keep it simple, direct, and actionable. No fluff or extra formatting.`,
      maxTokens: 200,
      temperature: 0.1,
      format: 'structured'
    }
  }

  private static getQuickActionTemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return {
      prompt: `⚡ QUICK ACTION EMAIL - This email needs a simple response or action.

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Provide a summary using this EXACT format:

⚡ **Quick Action Needed**
[One sentence explaining what they want]

💡 **What to do:** [Simple, clear action needed]

⏰ **Timeline:** [When to respond, if mentioned]

Keep it conversational and easy to scan.`,
      maxTokens: 150,
      temperature: 0.2,
      format: 'conversational'
    }
  }

  private static getFYITemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return {
      prompt: `📬 FYI EMAIL - This is an update, notification, or informational email.

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Provide a summary using this EXACT format:

📬 **Quick Update**
[One sentence summary of the main information]

💡 **Key points:**
• [Most important point]
• [Second important point if needed]

No action required unless specifically mentioned.`,
      maxTokens: 120,
      temperature: 0.3,
      format: 'minimal'
    }
  }

  private static getCommercialTemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return {
      prompt: `🛍️ COMMERCIAL EMAIL - This is a promotional, sales, or marketing email.

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Provide a summary using this EXACT format:

🛍️ **Promotion from ${email.sender.split('@')[0] || 'Company'}**
[One sentence about the offer]

🏷️ **The deal:** [What's being offered]

⏰ **Expires:** [When, if mentioned, otherwise "Not specified"]

Keep it brief and factual.`,
      maxTokens: 100,
      temperature: 0.2,
      format: 'minimal'
    }
  }

  private static getComplexContentTemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return {
      prompt: `📋 COMPLEX EMAIL - This email contains detailed information that needs to be simplified.

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Provide a summary using this EXACT format:

📋 **Key Points**
• [Most important takeaway]
• [Second most important point]
• [Third point if needed]

🎯 **Bottom Line:** [One sentence main message]

🔗 **Need details?** Check the full email for specifics.

Focus on making complex information digestible and scannable.`,
      maxTokens: 180,
      temperature: 0.2,
      format: 'structured'
    }
  }

  private static getDefaultTemplate(email: { sender: string, subject: string, body_preview: string }): SummaryTemplate {
    return {
      prompt: `📧 EMAIL SUMMARY - Provide a clear, helpful summary of this email.

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Create a natural, conversational summary that:
- Explains the main point in one sentence
- Mentions any actions needed
- Includes important details like deadlines
- Uses simple, clear language

Format it as a brief paragraph, not bullet points.`,
      maxTokens: 150,
      temperature: 0.3,
      format: 'conversational'
    }
  }

  // Post-processing to ensure consistent formatting and fallback handling
  public static formatSummary(rawSummary: string, classification: EmailClassification): string {
    // Handle empty or invalid summaries with graceful fallback
    if (!rawSummary || rawSummary.trim().length === 0) {
      return this.getFailsafeSummary(classification.type)
    }

    // Remove any HTML tags that might have been generated
    let cleanSummary = rawSummary.replace(/<[^>]*>/g, '')
    
    // Ensure proper line breaks instead of <br> tags
    cleanSummary = cleanSummary.replace(/<br\s*\/?>/gi, '\n')
    
    // Clean up extra whitespace and normalize formatting
    cleanSummary = cleanSummary.replace(/\n\s*\n/g, '\n\n').trim()
    
    // Handle malformed summaries that don't follow template
    if (cleanSummary.length < 10 || !this.validateSummaryStructure(cleanSummary, classification.type)) {
      console.warn('Generated summary appears malformed, applying fallback formatting')
      return this.repairSummaryStructure(cleanSummary, classification.type)
    }
    
    // Add urgency indicator for critical emails if missing
    if (classification.type === EmailType.CRITICAL_ACTION && !cleanSummary.includes('🚨')) {
      cleanSummary = '🚨 ' + cleanSummary
    }
    
    return cleanSummary
  }

  // Failsafe summary for when AI generation fails completely
  private static getFailsafeSummary(emailType: EmailType): string {
    switch (emailType) {
      case EmailType.CRITICAL_ACTION:
        return '🚨 **Action Required**\nThis email appears to need immediate attention. Please review the full email for important details and next steps.'
      
      case EmailType.QUICK_ACTION:
        return '⚡ **Response Needed**\nThis email appears to require a response or action from you. Please check the full email for details.'
      
      case EmailType.COMMERCIAL:
        return '🛍️ **Promotional Email**\nThis appears to be a marketing or promotional email with offers or deals.'
      
      case EmailType.FYI_UPDATE:
        return '📬 **Information Update**\nThis email contains updates or information for your awareness.'
      
      case EmailType.COMPLEX_CONTENT:
        return '📋 **Detailed Content**\nThis email contains detailed information that may require careful review.'
      
      default:
        return '📧 **Email Summary**\nPlease review this email for important information and any actions needed.'
    }
  }

  // Validate that summary follows expected structure for its type
  private static validateSummaryStructure(summary: string, emailType: EmailType): boolean {
    const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(summary)
    const hasStructure = summary.includes('**') || summary.includes('•') || summary.includes('\n')
    
    // Different validation rules based on email type
    switch (emailType) {
      case EmailType.CRITICAL_ACTION:
        return hasEmoji && (summary.includes('🚨') || summary.includes('Urgent')) && summary.length > 20
      
      case EmailType.QUICK_ACTION:
        return hasEmoji && summary.length > 15
      
      default:
        return hasEmoji && hasStructure && summary.length > 10
    }
  }

  // Repair malformed summaries by adding basic structure
  private static repairSummaryStructure(summary: string, emailType: EmailType): string {
    // Clean up the summary and add basic structure
    const cleanText = summary.replace(/[*_]/g, '').trim()
    
    switch (emailType) {
      case EmailType.CRITICAL_ACTION:
        return `🚨 **Urgent Action Needed**\n${cleanText}\n\n✅ **Next step:** Review the full email for specific actions required.`
      
      case EmailType.QUICK_ACTION:
        return `⚡ **Action Needed**\n${cleanText}\n\n💡 **What to do:** Check the full email for details.`
      
      case EmailType.COMMERCIAL:
        return `🛍️ **Promotion**\n${cleanText}`
      
      case EmailType.FYI_UPDATE:
        return `📬 **Update**\n${cleanText}`
      
      case EmailType.COMPLEX_CONTENT:
        return `📋 **Summary**\n${cleanText}\n\n🔗 **Need details?** Review the full email for complete information.`
      
      default:
        return `📧 **Summary**\n${cleanText}`
    }
  }
}
