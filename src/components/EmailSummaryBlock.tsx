'use client'

import { RefreshCw } from 'lucide-react'
import { AdaptiveSummary } from '@/components/AdaptiveSummary'
import { Email } from '@/types'

interface EmailSummaryBlockProps {
  email: Email
  isSummarizing: boolean
  compact?: boolean
}

export function EmailSummaryBlock({
  email,
  isSummarizing,
  compact = false,
}: EmailSummaryBlockProps) {
  const padding = compact ? 'p-3' : 'p-4'

  if (email.summary) {
    return <AdaptiveSummary email={email} />
  }

  if (isSummarizing) {
    return (
      <div className={`bg-muted rounded-lg ${padding} border`}>
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Generating summary...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-muted rounded-lg ${padding} border`}>
      <span className="text-sm text-muted-foreground">No summary</span>
    </div>
  )
}
