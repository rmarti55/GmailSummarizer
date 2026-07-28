import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuthHandler } from '@/lib/auth-middleware'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite'

export const POST = withAuthHandler(async ({ user, supabase }, request: NextRequest) => {
  try {
    if (process.env.DISABLE_SUMMARIZATION === 'true') {
      return NextResponse.json(
        { error: 'Summarization is temporarily disabled' },
        { status: 503 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { emailId } = body

    if (!emailId) {
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 })
    }

    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', user.id)
      .single()

    if (emailError) {
      console.error('Database error when fetching email:', emailError)
      return NextResponse.json({ error: 'Database error', details: emailError }, { status: 500 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    if (email.summary) {
      return NextResponse.json({ summary: email.summary })
    }

    const model = process.env.SUMMARIZE_MODEL || DEFAULT_MODEL
    let summary: string

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Gmail Summarizer',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: `One simple sentence summary:

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 80,
        }),
      })

      const completion = await response.json()

      if (!response.ok) {
        console.error('OpenRouter API error:', completion)
        return NextResponse.json(
          { error: 'AI service error', details: completion },
          { status: 500 }
        )
      }

      summary = completion.choices?.[0]?.message?.content?.trim() || ''

      if (!summary) {
        console.error('OpenRouter returned empty summary')
        return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
      }
    } catch (aiError) {
      console.error('OpenRouter API error:', aiError)
      return NextResponse.json({ error: 'AI service error', details: String(aiError) }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from('emails')
      .update({ summary })
      .eq('id', emailId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to save summary:', updateError)
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Summarization error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
})
