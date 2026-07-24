'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, ChevronDown, Mail, ExternalLink, Trash2 } from 'lucide-react'
import { EmailSummaryBlock } from '@/components/EmailSummaryBlock'
import { Email } from '@/types'

interface SenderStats {
  sender: string
  count: number
  percentage: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface ExpandableSenderCardProps {
  sender: SenderStats
  rank: number
  isExpanded: boolean
  onToggleExpand: (sender: string) => void
  emails: Email[]
  pagination: PaginationInfo | null
  loading: boolean
  onPageChange: (sender: string, page: number) => void
  onDeleteEmail: (emailId: string, senderName: string) => void
  deletingId: string | null
  isSummarizing: (emailId: string) => boolean
}

export function ExpandableSenderCard({
  sender,
  rank,
  isExpanded,
  onToggleExpand,
  emails,
  pagination,
  loading,
  onPageChange,
  onDeleteEmail,
  deletingId,
  isSummarizing,
}: ExpandableSenderCardProps) {
  
  // Format email text into readable paragraphs (reused from Dashboard)
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

  return (
    <Card className="overflow-hidden transition-all duration-300 ease-in-out hover:shadow-md">
      {/* Sender Header - Always Visible */}
      <div 
        className="flex items-center justify-between py-4 px-6 cursor-pointer hover:bg-accent transition-colors"
        onClick={() => onToggleExpand(sender.sender)}
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-full font-semibold text-sm">
            {rank}
          </div>
          <div>
            <p className="font-medium text-foreground">
              {sender.sender}
            </p>
            <p className="text-sm text-muted-foreground">
              {sender.percentage}% of total emails
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="text-sm">
            {sender.count} emails
          </Badge>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
          )}
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <Separator />
          <CardContent className="p-6 pt-4">
            {loading ? (
              // Loading state
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : emails.length === 0 ? (
              // Empty state
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No emails found
                </h3>
                <p className="text-muted-foreground">
                  No emails from this sender in your current data
                </p>
              </div>
            ) : (
              <>
                {/* Email List */}
                <div className="space-y-4">
                  {emails.map((email) => (
                    <Card key={email.id} className="bg-muted/50">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Email Header */}
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary" className="text-xs">
                                  {new Date(email.created_at).toLocaleDateString()}
                                </Badge>
                              </div>
                              <h4 className="text-base font-medium leading-6 text-foreground">
                                {email.subject}
                              </h4>
                            </div>
                          </div>
                          
                          {/* AI Summary */}
                          <div>
                            <EmailSummaryBlock
                              email={email}
                              isSummarizing={isSummarizing(email.id)}
                              compact
                            />
                          </div>
                          
                          {/* Original Email Content - Collapsible */}
                          <details className="group">
                            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center">
                              <span>Read full email</span>
                              <svg className="w-4 h-4 ml-1 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </summary>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-background rounded-lg p-3 border mt-2">
                              {formatEmailText(email.body_preview)}
                            </div>
                          </details>
                          
                          {/* Gmail Link */}
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_id}`, '_blank')}
                              variant="outline"
                              size="sm"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View in Gmail
                            </Button>
                            <Button
                              onClick={() => onDeleteEmail(email.id, sender.sender)}
                              variant="outline"
                              size="sm"
                              disabled={deletingId === email.id}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {deletingId === email.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 mt-6">
                    <Separator className="absolute left-0 right-0 -mt-4" />
                    <div className="text-sm text-muted-foreground">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} emails
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.hasPrev}
                        onClick={() => onPageChange(sender.sender, pagination.page - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.hasNext}
                        onClick={() => onPageChange(sender.sender, pagination.page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </div>
      )}
    </Card>
  )
}
