import { createClient } from '@/lib/supabase/server'
import { normalizeSenderStats } from '@/lib/sender-utils'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get sender statistics with counts and percentages
    const { data: senderStats, error: statsError } = await supabase
      .rpc('get_sender_statistics', { user_id: user.id })

    if (statsError) {
      console.error('Error fetching sender statistics:', statsError)
      
      // Fallback: manual query if RPC doesn't exist
      const { data: emails, error: emailsError } = await supabase
        .from('emails')
        .select('sender')
        .eq('user_id', user.id)

      if (emailsError) {
        return NextResponse.json({ error: 'Failed to fetch sender data' }, { status: 500 })
      }

      // Calculate statistics manually
      const senderCounts = emails.reduce((acc, email) => {
        acc[email.sender] = (acc[email.sender] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const senders = normalizeSenderStats(
        Object.entries(senderCounts).map(([sender, count]) => ({
          sender,
          count,
        }))
      )

      return NextResponse.json({ senders })
    }

    return NextResponse.json({
      senders: normalizeSenderStats(senderStats || []),
    })

  } catch (error) {
    console.error('Senders API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
