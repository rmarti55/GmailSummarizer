import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete all emails for this user
    const { error: deleteError } = await supabase
      .from('emails')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error clearing emails:', deleteError)
      return NextResponse.json({ error: 'Failed to clear emails' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'All emails cleared successfully' 
    })

  } catch (error) {
    console.error('Error in clear-emails endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
