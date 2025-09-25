import React from 'react'
import { Email } from '../types'

interface AdaptiveSummaryProps {
  email: Email
}

export function AdaptiveSummary({ email }: AdaptiveSummaryProps) {
  if (!email.summary) return null

  // Format the summary for better readability
  const formatSummary = (summary: string) => {
    // Split into paragraphs and preserve line breaks
    const paragraphs = summary.split('\n\n').filter(p => p.trim())
    
    return paragraphs.map((paragraph, index) => {
      // Handle bullet points
      if (paragraph.includes('•') || paragraph.includes('*')) {
        const lines = paragraph.split('\n')
        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lineIndex) => (
              <div key={lineIndex} className="text-sm">
                {line.trim()}
              </div>
            ))}
          </div>
        )
      }
      
      // Regular paragraphs
      return (
        <p key={index} className="text-sm mb-2 last:mb-0">
          {paragraph.trim()}
        </p>
      )
    })
  }

  return (
    <div className="text-gray-700 dark:text-gray-300">
      {formatSummary(email.summary)}
    </div>
  )
}
