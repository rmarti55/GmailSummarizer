import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '24h'

    // Calculate time range based on period
    const now = new Date()
    let startTime: Date
    
    switch (period) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Fetch emails for the specified period
    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })

    if (emailsError) {
      console.error('Error fetching emails:', emailsError)
      return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        period,
        totalEmails: 0,
        actionItems: [],
        themes: [],
        patterns: [],
        comparison: {
          volumeChange: 0,
          newSenders: 0
        }
      })
    }

    // Fetch comparison data (same period, offset by the period length)
    const comparisonStartTime = new Date(startTime.getTime() - (now.getTime() - startTime.getTime()))
    const comparisonEndTime = startTime
    
    const { data: comparisonEmails } = await supabase
      .from('emails')
      .select('sender, created_at')
      .eq('user_id', user.id)
      .gte('created_at', comparisonStartTime.toISOString())
      .lt('created_at', comparisonEndTime.toISOString())

    // Analyze action items (emails that likely need responses)
    const actionItems = emails
      .filter(email => {
        const subject = email.subject?.toLowerCase() || ''
        const body = email.body_preview?.toLowerCase() || ''
        const sender = email.sender?.toLowerCase() || ''
        
        // Action indicators
        const actionKeywords = [
          'urgent', 'asap', 'deadline', 'respond', 'reply', 'confirm', 'approve',
          'review', 'feedback', 'meeting', 'call', 'schedule', 'action required',
          'please', 'need', 'request', 'important', 'follow up', 'question'
        ]
        
        // Skip automated/newsletter emails
        const skipKeywords = [
          'no-reply', 'noreply', 'notification', 'alert', 'newsletter', 
          'unsubscribe', 'automated', 'system', 'support@'
        ]
        
        const hasActionKeywords = actionKeywords.some(keyword => 
          subject.includes(keyword) || body.includes(keyword)
        )
        
        const isAutomated = skipKeywords.some(keyword => 
          sender.includes(keyword) || subject.includes(keyword)
        )
        
        return hasActionKeywords && !isAutomated && !email.read
      })
      .slice(0, 10) // Limit to top 10 action items
      .map(email => ({
        id: email.id,
        subject: email.subject || 'No subject',
        sender: email.sender || 'Unknown sender',
        urgency: determineUrgency(email),
        timeAgo: getTimeAgo(new Date(email.created_at)),
        reason: getActionReason(email)
      }))

    // Analyze themes/categories
    const themeAnalysis = analyzeThemes(emails)
    
    // Analyze patterns and changes
    const patterns = analyzePatterns(emails, comparisonEmails || [])
    
    // Calculate comparison metrics
    const volumeChange = comparisonEmails ? 
      Math.round(((emails.length - comparisonEmails.length) / Math.max(comparisonEmails.length, 1)) * 100) : 0
    
    const currentSenders = new Set(emails.map(e => e.sender))
    const previousSenders = new Set((comparisonEmails || []).map(e => e.sender))
    const newSenders = [...currentSenders].filter(sender => !previousSenders.has(sender)).length

    return NextResponse.json({
      period,
      totalEmails: emails.length,
      actionItems,
      themes: themeAnalysis,
      patterns,
      comparison: {
        volumeChange,
        newSenders
      }
    })

  } catch (error) {
    console.error('Intelligence API error:', error)
    return NextResponse.json({ error: 'Failed to generate intelligence' }, { status: 500 })
  }
}

function determineUrgency(email: any): 'high' | 'medium' | 'low' {
  const subject = email.subject?.toLowerCase() || ''
  const body = email.body_preview?.toLowerCase() || ''
  
  const highUrgencyKeywords = ['urgent', 'asap', 'emergency', 'critical', 'deadline today']
  const mediumUrgencyKeywords = ['important', 'deadline', 'meeting', 'confirm', 'approve']
  
  if (highUrgencyKeywords.some(keyword => subject.includes(keyword) || body.includes(keyword))) {
    return 'high'
  }
  
  if (mediumUrgencyKeywords.some(keyword => subject.includes(keyword) || body.includes(keyword))) {
    return 'medium'
  }
  
  return 'low'
}

function getActionReason(email: any): string {
  const subject = email.subject?.toLowerCase() || ''
  const body = email.body_preview?.toLowerCase() || ''
  
  if (subject.includes('meeting') || body.includes('meeting')) {
    return 'Meeting coordination required'
  }
  if (subject.includes('deadline') || body.includes('deadline')) {
    return 'Has deadline mentioned'
  }
  if (subject.includes('urgent') || body.includes('urgent')) {
    return 'Marked as urgent'
  }
  if (subject.includes('confirm') || body.includes('confirm')) {
    return 'Confirmation requested'
  }
  if (subject.includes('review') || body.includes('review')) {
    return 'Review requested'
  }
  
  return 'Likely requires response'
}

function analyzeThemes(emails: any[]) {
  const themes: { [key: string]: { count: number; description: string } } = {}
  
  emails.forEach(email => {
    const subject = email.subject?.toLowerCase() || ''
    const body = email.body_preview?.toLowerCase() || ''
    const sender = email.sender?.toLowerCase() || ''
    
    // Categorize emails
    if (sender.includes('no-reply') || sender.includes('noreply') || subject.includes('newsletter')) {
      themes['Newsletters & Notifications'] = themes['Newsletters & Notifications'] || { count: 0, description: 'Automated updates and newsletters' }
      themes['Newsletters & Notifications'].count++
    } else if (subject.includes('meeting') || subject.includes('calendar') || body.includes('meeting')) {
      themes['Meetings & Events'] = themes['Meetings & Events'] || { count: 0, description: 'Meeting invites and scheduling' }
      themes['Meetings & Events'].count++
    } else if (subject.includes('project') || subject.includes('task') || subject.includes('deadline')) {
      themes['Work & Projects'] = themes['Work & Projects'] || { count: 0, description: 'Project updates and work tasks' }
      themes['Work & Projects'].count++
    } else if (sender.includes('support') || subject.includes('alert') || subject.includes('notification')) {
      themes['System & Support'] = themes['System & Support'] || { count: 0, description: 'System alerts and support messages' }
      themes['System & Support'].count++
    } else if (subject.includes('invoice') || subject.includes('payment') || subject.includes('billing')) {
      themes['Financial'] = themes['Financial'] || { count: 0, description: 'Invoices and financial communications' }
      themes['Financial'].count++
    } else {
      themes['Personal & Other'] = themes['Personal & Other'] || { count: 0, description: 'Personal communications and miscellaneous' }
      themes['Personal & Other'].count++
    }
  })
  
  const totalEmails = emails.length
  return Object.entries(themes)
    .map(([name, data]) => ({
      name,
      count: data.count,
      percentage: Math.round((data.count / totalEmails) * 100),
      description: data.description
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6) // Top 6 themes
}

function analyzePatterns(currentEmails: any[], previousEmails: any[]) {
  const patterns = []
  
  // Volume patterns
  if (currentEmails.length > previousEmails.length * 1.3) {
    patterns.push({
      type: 'volume',
      description: 'Significantly higher email volume than usual',
      change: 'increase',
      percentage: Math.round(((currentEmails.length - previousEmails.length) / Math.max(previousEmails.length, 1)) * 100)
    })
  }
  
  // Sender patterns
  const currentSenderCounts: { [key: string]: number } = {}
  const previousSenderCounts: { [key: string]: number } = {}
  
  currentEmails.forEach(email => {
    const sender = email.sender || 'Unknown'
    currentSenderCounts[sender] = (currentSenderCounts[sender] || 0) + 1
  })
  
  previousEmails.forEach(email => {
    const sender = email.sender || 'Unknown'
    previousSenderCounts[sender] = (previousSenderCounts[sender] || 0) + 1
  })
  
  // Find senders with unusual activity
  Object.entries(currentSenderCounts).forEach(([sender, count]) => {
    const previousCount = previousSenderCounts[sender] || 0
    if (count > previousCount * 2 && count > 2) {
      patterns.push({
        type: 'sender',
        description: `${sender.split('@')[0]} sent ${count} emails (usually ${previousCount})`,
        change: 'increase'
      })
    }
  })
  
  return patterns.slice(0, 5) // Limit to top 5 patterns
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInMinutes < 1440) { // 24 hours
    return `${Math.floor(diffInMinutes / 60)}h ago`
  } else {
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }
}
