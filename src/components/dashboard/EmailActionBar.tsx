import React from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface EmailActionBarProps {
  onRefresh: () => void
  onClearSummaries: () => void
  onClearAllEmails: () => void
  isProcessing: boolean
}

export function EmailActionBar({ 
  onRefresh, 
  onClearSummaries, 
  onClearAllEmails, 
  isProcessing 
}: EmailActionBarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={isProcessing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          onClick={onClearSummaries}
          variant="outline"
          size="sm"
          disabled={isProcessing}
        >
          Clear Summaries
        </Button>
        <Button
          onClick={onClearAllEmails}
          variant="outline"
          size="sm"
          disabled={isProcessing}
        >
          Clear All Emails
        </Button>
      </div>
    </div>
  )
}
