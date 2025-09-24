import { createClient } from '../../../../lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { EmailClassifier } from '../../../lib/email-classifier'
import { SummaryTemplateEngine } from '../../../lib/summary-templates'

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

    // Classify email type and generate adaptive summary
    console.log('🔍 Classifying email type...')
    const classification = EmailClassifier.classify({
      sender: email.sender,
      subject: email.subject,
      body_preview: email.body_preview
    })
    
    console.log('📊 Email classified as:', classification.type, 'with confidence:', classification.confidence)
    
    // Get appropriate template based on classification
    const template = SummaryTemplateEngine.getTemplate(classification, {
      sender: email.sender,
      subject: email.subject,
      body_preview: email.body_preview
    })

    console.log('🤖 Generating adaptive AI summary...')
    let rawSummary: string
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: template.prompt,
          },
        ],
        model: 'openai/gpt-oss-120b',
        temperature: template.temperature,
        max_tokens: template.maxTokens,
      })

      rawSummary = completion.choices[0]?.message?.content?.trim() || ''

      if (!rawSummary) {
        console.error('❌ Groq returned empty summary')
        return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
      }

      console.log('✅ Generated raw summary:', rawSummary.substring(0, 100) + '...')
    } catch (groqError) {
      console.error('❌ Groq API error:', groqError)
      return NextResponse.json({ error: 'AI service error', details: groqError }, { status: 500 })
    }

    // Format summary with post-processing
    const summary = SummaryTemplateEngine.formatSummary(rawSummary, classification)

    // Update email with summary and classification data
    const { error: updateError } = await supabase
      .from('emails')
      .update({ 
        summary,
        email_type: classification.type,
        urgency_level: classification.urgencyLevel,
        action_required: classification.actionRequired,
        classification_confidence: classification.confidence,
        estimated_read_time: classification.estimatedReadTime
      })
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



