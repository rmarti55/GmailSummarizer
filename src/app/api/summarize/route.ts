import { createClient } from '../../../../lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(request: NextRequest) {
  console.log('🚀 SUMMARIZE API CALLED - REQUEST RECEIVED')
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('📨 Summarize request body:', body)
    const { emailId } = body
    
    if (!emailId) {
      console.error('❌ No emailId provided in request')
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 })
    }

    console.log('🔍 Looking for email with ID:', emailId)
    console.log('👤 User ID:', user.id)

    // Get email from database
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', user.id)
      .single()

    if (emailError) {
      console.error('❌ Database error when fetching email:', emailError)
      console.error('❌ Error details:', JSON.stringify(emailError, null, 2))
      return NextResponse.json({ error: 'Database error', details: emailError }, { status: 500 })
    }

    if (!email) {
      console.error('❌ Email not found with ID:', emailId)
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    console.log('✅ Found email:', { id: email.id, subject: email.subject, hasSummary: !!email.summary })

    // Skip if already has summary
    if (email.summary) {
      return NextResponse.json({ summary: email.summary })
    }

    // Generate summary using Groq
    console.log('🤖 Generating AI summary...')
    const prompt = `Analyze this email and provide a clear, actionable summary. Focus on:
- Key action items or requests
- Important deadlines or dates
- Main decisions or information
- Next steps required

From: ${email.sender}
Subject: ${email.subject}
Content: ${email.body_preview}

Provide a concise 2-3 sentence summary highlighting the most important points:`

    let summary: string
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'openai/gpt-oss-120b',
        temperature: 0.1,
        max_tokens: 400,
      })

      summary = completion.choices[0]?.message?.content?.trim() || ''

      if (!summary) {
        console.error('❌ Groq returned empty summary')
        return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
      }

      console.log('✅ Generated summary:', summary.substring(0, 100) + '...')
    } catch (groqError) {
      console.error('❌ Groq API error:', groqError)
      return NextResponse.json({ error: 'AI service error', details: groqError }, { status: 500 })
    }

    // Update email with summary
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
}



