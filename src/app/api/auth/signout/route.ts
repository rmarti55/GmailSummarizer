import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'

export const POST = withAuthHandler(async ({ supabase }) => {
  // User is guaranteed to be authenticated by middleware
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
})



