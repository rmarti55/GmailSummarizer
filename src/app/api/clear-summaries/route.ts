import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Clear all summaries for this user - just clear the summary field
    const { error } = await supabase
      .from('emails')
      .update({ summary: null })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error clearing summaries:', error)
      return NextResponse.json({ error: 'Failed to clear summaries', details: error }, { status: 500 })
    }

    return NextResponse.json({ message: 'All summaries cleared successfully' })

  } catch (error) {
    console.error('Clear summaries error:', error)
    return NextResponse.json({ error: 'Failed to clear summaries', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
