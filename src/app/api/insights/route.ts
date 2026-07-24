import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get email patterns for analysis
    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('created_at, sender, email_type, urgency_level')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500) // Last 500 emails for pattern analysis

    if (emailsError) {
      return NextResponse.json({ error: 'Failed to fetch email data' }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ 
        analytics: {
          peakHour: null,
          peakDay: null,
          totalAnalyzed: 0,
          avgPerDay: 0,
          topSenders: [],
          emailTypes: {}
        }
      })
    }

    // Peak email hours analysis
    const hourCounts = emails.reduce((acc, email) => {
      const hour = new Date(email.created_at).getHours()
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    const peakHour = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)[0]
    const peakHourValue = peakHour ? Number(peakHour[0]) : null
    
    // Day of week patterns
    const dayCounts = emails.reduce((acc, email) => {
      const day = new Date(email.created_at).getDay()
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = dayNames[day]
      acc[dayName] = (acc[dayName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const peakDay = Object.entries(dayCounts)
      .sort(([,a], [,b]) => b - a)[0]

    // Top senders analysis
    const senderCounts = emails.reduce((acc, email) => {
      acc[email.sender] = (acc[email.sender] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topSenders = Object.entries(senderCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([sender, count]) => ({
        sender,
        count,
        percentage: Math.round((count / emails.length) * 100 * 10) / 10
      }))

    // Email type distribution
    const emailTypes = emails.reduce((acc, email) => {
      const type = email.email_type || 'unclassified'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const analytics = {
      peakHour: peakHourValue !== null
        ? `${peakHourValue > 12 ? peakHourValue - 12 : peakHourValue === 0 ? 12 : peakHourValue}:00 ${peakHourValue >= 12 ? 'PM' : 'AM'}`
        : null,
      peakDay: peakDay ? peakDay[0] : null,
      totalAnalyzed: emails.length,
      avgPerDay: Math.round(emails.length / 30), // Rough 30-day average
      topSenders,
      emailTypes
    }

    return NextResponse.json({ analytics })

  } catch (error) {
    console.error('Insights API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
