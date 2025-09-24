// Email Classification System
// Automatically categorizes emails and applies appropriate summarization templates

export enum EmailType {
  CRITICAL_ACTION = 'critical_action',
  QUICK_ACTION = 'quick_action', 
  FYI_UPDATE = 'fyi_update',
  COMMERCIAL = 'commercial',
  COMPLEX_CONTENT = 'complex_content'
}

export interface EmailClassification {
  type: EmailType
  confidence: number
  urgencyLevel: 'high' | 'medium' | 'low'
  actionRequired: boolean
  estimatedReadTime: number // in seconds
}

interface EmailData {
  sender: string
  subject: string
  body_preview: string
}

export class EmailClassifier {
  // Critical action indicators
  private static readonly CRITICAL_INDICATORS = [
    'security', 'urgent', 'immediate', 'action required', 'expires today',
    'suspended', 'locked', 'verification required', 'confirm now',
    'deadline', 'overdue', 'final notice', 'emergency', 'alert'
  ]

  // Quick action indicators  
  private static readonly QUICK_ACTION_INDICATORS = [
    'confirm', 'approve', 'review', 'please respond', 'rsvp',
    'click here', 'activate', 'verify', 'accept invitation'
  ]

  // FYI/notification indicators
  private static readonly FYI_INDICATORS = [
    'update', 'report', 'newsletter', 'digest', 'summary',
    'notification', 'reminder', 'weekly', 'monthly', 'progress'
  ]

  // Commercial indicators
  private static readonly COMMERCIAL_INDICATORS = [
    'sale', 'discount', 'offer', 'deal', 'promotion', 'coupon',
    'limited time', '% off', 'free shipping', 'buy now', 'shop'
  ]

  // Trusted sender domains for security/tech notifications
  private static readonly TRUSTED_DOMAINS = [
    'github.com', 'google.com', 'microsoft.com', 'apple.com',
    'amazon.com', 'paypal.com', 'stripe.com', 'slack.com',
    'dropbox.com', 'atlassian.com', 'salesforce.com'
  ]

  public static classify(email: EmailData): EmailClassification {
    const text = `${email.subject} ${email.body_preview}`.toLowerCase()
    const senderDomain = this.extractDomain(email.sender)
    
    // Check for critical actions first (highest priority)
    if (this.containsAny(text, this.CRITICAL_INDICATORS) || 
        (this.TRUSTED_DOMAINS.includes(senderDomain) && this.containsSecurityKeywords(text))) {
      return {
        type: EmailType.CRITICAL_ACTION,
        confidence: 0.9,
        urgencyLevel: 'high',
        actionRequired: true,
        estimatedReadTime: 30
      }
    }

    // Check for quick actions
    if (this.containsAny(text, this.QUICK_ACTION_INDICATORS)) {
      return {
        type: EmailType.QUICK_ACTION,
        confidence: 0.8,
        urgencyLevel: 'medium', 
        actionRequired: true,
        estimatedReadTime: 15
      }
    }

    // Check for commercial emails
    if (this.containsAny(text, this.COMMERCIAL_INDICATORS) || this.isCommercialSender(email.sender)) {
      return {
        type: EmailType.COMMERCIAL,
        confidence: 0.7,
        urgencyLevel: 'low',
        actionRequired: false,
        estimatedReadTime: 10
      }
    }

    // Check for FYI/updates
    if (this.containsAny(text, this.FYI_INDICATORS) || this.isNotificationSender(email.sender)) {
      return {
        type: EmailType.FYI_UPDATE,
        confidence: 0.8,
        urgencyLevel: 'low',
        actionRequired: false,
        estimatedReadTime: 20
      }
    }

    // Default to complex content for long emails or unknown patterns
    const isLongContent = email.body_preview.length > 500
    return {
      type: isLongContent ? EmailType.COMPLEX_CONTENT : EmailType.FYI_UPDATE,
      confidence: 0.6,
      urgencyLevel: 'medium',
      actionRequired: false,
      estimatedReadTime: isLongContent ? 60 : 20
    }
  }

  private static containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword))
  }

  private static containsSecurityKeywords(text: string): boolean {
    const securityKeywords = ['two-factor', '2fa', 'password', 'login', 'authentication', 'account']
    return this.containsAny(text, securityKeywords)
  }

  private static extractDomain(email: string): string {
    const match = email.match(/@([^>]+)/)
    return match ? match[1].toLowerCase() : ''
  }

  private static isCommercialSender(sender: string): boolean {
    const commercialKeywords = ['noreply', 'marketing', 'promo', 'deals', 'offers']
    return commercialKeywords.some(keyword => sender.toLowerCase().includes(keyword))
  }

  private static isNotificationSender(sender: string): boolean {
    const notificationKeywords = ['notification', 'updates', 'digest', 'report', 'fitbit', 'strava']
    return notificationKeywords.some(keyword => sender.toLowerCase().includes(keyword))
  }
}
