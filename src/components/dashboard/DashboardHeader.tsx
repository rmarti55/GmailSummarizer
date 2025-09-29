import React from 'react'

interface DashboardHeaderProps {
  totalEmailCount: number
}

export function DashboardHeader({ totalEmailCount }: DashboardHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Your Inbox
      </h2>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          AI-powered summaries of your recent emails
        </p>
        {totalEmailCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {totalEmailCount.toLocaleString()} total emails
          </p>
        )}
      </div>
    </div>
  )
}
