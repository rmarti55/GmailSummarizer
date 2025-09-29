import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Mail, RefreshCw, ExternalLink } from 'lucide-react'
import { AdaptiveSummary } from '@/components/AdaptiveSummary'
import { Email } from '@/types'

interface EmailListContainerProps {
  emails: Email[]
  loading: boolean
  onSummarizeEmail: (emailId: string) => void
  isProcessing: boolean
}

export function EmailListContainer({ 
  emails, 
  loading, 
  onSummarizeEmail,
  isProcessing 
}: EmailListContainerProps) {
  // Format email text into readable paragraphs
  const formatEmailText = (text: string): string => {
    if (!text) return ''
    
    return text
      .split(/\. (?=[A-Z])/) // Split at sentence boundaries
      .reduce((acc: string[][], sentence: string, i: number) => {
        if (i % 2 === 0) acc.push([sentence])
        else acc[acc.length - 1].push(sentence)
        return acc
      }, [])
      .map(paragraph => paragraph.join('. ') + '.')
      .join('\n\n')
  }

  // Auto-summarize emails that don't have summaries
  useEffect(() => {
    emails.forEach((email: Email) => {
      if (!email.summary && !isProcessing) {
        onSummarizeEmail(email.id)
      }
    })
  }, [emails, onSummarizeEmail, isProcessing])

  if (loading) {
    // Loading skeletons
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (emails.length === 0) {
    // Empty state
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No emails found
          </h3>
          <p className="text-muted-foreground mb-4">
            Connect your Gmail account to see your emails here
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Email cards
  return (
    <div className="space-y-4">
      {emails.map((email) => (
        <Card key={email.id} className="hover:shadow-md transition-shadow gap-0">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-foreground">
                    {email.sender}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {new Date(email.created_at).toLocaleDateString()}
                  </Badge>
                </div>
                <CardTitle className="text-base leading-6">
                  {email.subject}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {/* AI Summary First - Main Content */}
            <div className="mb-4">
              {email.summary ? (
                <AdaptiveSummary email={email} />
              ) : (
                <div className="bg-muted rounded-lg p-4 border">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Generating summary...</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Original Email Content - Secondary/Collapsible */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center">
                <span>Read full email</span>
                <svg className="w-4 h-4 ml-1 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </summary>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted rounded-lg p-3 border">
                {formatEmailText(email.body_preview)}
              </div>
            </details>
            
            <div className="mt-4">
              <Button
                onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_id}`, '_blank')}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Gmail
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
