import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

export interface AuthenticatedRequest {
  user: User
  supabase: ReturnType<typeof createClient>
}

export interface AuthMiddlewareResult {
  success: boolean
  user?: User
  supabase?: ReturnType<typeof createClient>
  response?: NextResponse
}

/**
 * Authentication middleware for API routes
 * Checks if user is authenticated and returns user data or error response
 */
export async function withAuth(): Promise<AuthMiddlewareResult> {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return {
        success: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    return {
      success: true,
      user,
      supabase
    }
  } catch (error) {
    console.error('Auth middleware error:', error)
    return {
      success: false,
      response: NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
    }
  }
}

/**
 * Higher-order function that wraps API route handlers with authentication
 * Usage: export const GET = withAuthHandler(async ({ user, supabase }) => { ... })
 */
export function withAuthHandler(
  handler: (context: AuthenticatedRequest, ...args: unknown[]) => Promise<NextResponse> | NextResponse
) {
  return async (...args: unknown[]): Promise<NextResponse> => {
    const authResult = await withAuth()
    
    if (!authResult.success) {
      return authResult.response!
    }

    // Call the original handler with authenticated context and original args
    return handler({
      user: authResult.user!,
      supabase: authResult.supabase!
    }, ...args)
  }
}

/**
 * Utility function for manual auth checking in API routes
 * Returns authenticated user and supabase client or throws error response
 */
export async function requireAuth(): Promise<AuthenticatedRequest> {
  const authResult = await withAuth()
  
  if (!authResult.success) {
    throw authResult.response!
  }

  return {
    user: authResult.user!,
    supabase: authResult.supabase!
  }
}
