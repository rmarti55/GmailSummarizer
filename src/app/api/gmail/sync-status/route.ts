import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getSyncProgress, setSyncProgress } from '@/lib/sync-progress'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const progress = getSyncProgress(user.id)
    
    return NextResponse.json(progress)

  } catch (error) {
    console.error('Sync status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { current, total, isRunning } = body
    
    // Use authenticated user ID
    setSyncProgress(user.id, { current, total, isRunning })
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Sync status update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
