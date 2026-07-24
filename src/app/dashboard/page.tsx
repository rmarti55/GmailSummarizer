'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, RefreshCw, Sparkles, LogOut, ExternalLink } from 'lucide-react'
import { AdaptiveSummary } from '@/components/AdaptiveSummary'
import { AppHeader } from '@/components/AppHeader'
import { PaginationControls } from '@/components/PaginationControls'
import { Email } from '@/types'

export default function Dashboard() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [summarizing, setSummarizing] = useState<string | null>(null)
  const [totalEmailCount, setTotalEmailCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const EMAILS_PER_PAGE = 20

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

  const fetchEmailCount = async () => {
    try {
      const response = await fetch('/api/gmail/count')
      if (response.ok) {
        const data = await response.json()
        setTotalEmailCount(data.totalEmails)
      }
    } catch (error) {
      console.error('Failed to fetch email count:', error)
    }
  }

  const fetchEmails = async (page: number = 1) => {
    setLoading(true)

    try {
      const offset = (page - 1) * EMAILS_PER_PAGE
      const response = await fetch(`/api/gmail/count?limit=${EMAILS_PER_PAGE}&offset=${offset}`)
      if (response.ok) {
        const data = await response.json()
        const newEmails = data.emails || []
        
        setEmails(newEmails)
        
        // Make sure total count is set correctly - fix stale count bug
        if (totalEmailCount === 0 || newEmails.length > totalEmailCount) {
          fetchEmailCount()
        }
        
        // Auto-summarize emails that don't have summaries
        newEmails.forEach((email: Email) => {
          if (!email.summary) {
            summarizeEmail(email.id)
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    }
    
    setLoading(false)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchEmails(page)
  }

  const handleFullSync = () => {
    // The full sync will be handled by the EmailStatsBar component
    // We just need to refresh the count and emails after sync
    setTimeout(() => {
      fetchEmailCount()
      fetchEmails()
    }, 1000)
  }

  const summarizeEmail = async (emailId: string) => {
    setSummarizing(emailId)
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId })
      })
      
      if (response.ok) {
        const data = await response.json()
        setEmails(prev => prev.map(email => 
          email.id === emailId ? { ...email, summary: data.summary } : email
        ))
      }
    } catch (error) {
      console.error('Failed to summarize:', error)
    }
    setSummarizing(null)
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' })
      if (response.ok) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const clearAllSummaries = async () => {
    if (!confirm('Clear all existing summaries? They will be regenerated with the new adaptive system.')) return
    
    try {
      const response = await fetch('/api/clear-summaries', { method: 'POST' })
      if (response.ok) {
        // Refresh emails to show cleared summaries
        fetchEmails()
        alert('All summaries cleared! Click "Summarize" to generate new adaptive summaries.')
      }
    } catch (error) {
      console.error('Failed to clear summaries:', error)
    }
  }

  const clearAllEmails = async () => {
    if (!confirm('Clear all cached emails? They will be re-processed with clean formatting on next refresh.')) return
    
    try {
      const response = await fetch('/api/clear-emails', { method: 'POST' })
      if (response.ok) {
        // Clear emails from UI immediately
        setEmails([])
        alert('All emails cleared! Click "Refresh" to fetch and process emails with clean formatting.')
      }
    } catch (error) {
      console.error('Failed to clear emails:', error)
    }
  }

  useEffect(() => {
    fetchEmailCount()
    fetchEmails()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onRefresh={() => fetchEmails()}
        onClearSummaries={clearAllSummaries}
        onClearAllEmails={clearAllEmails}
        onLogout={handleLogout}
        onFullSync={handleFullSync}
        loading={loading}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Top Pagination Controls */}
        {!loading && emails.length > 0 && totalEmailCount > EMAILS_PER_PAGE && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(totalEmailCount / EMAILS_PER_PAGE)}
            totalCount={totalEmailCount}
            itemsPerPage={EMAILS_PER_PAGE}
            onPageChange={handlePageChange}
          />
        )}

        {/* Email List */}
        <div className="space-y-4">
          {loading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
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
            ))
          ) : emails.length === 0 ? (
            // Empty state
            <Card>
              <CardContent className="p-12 text-center">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No emails found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Connect your Gmail account to see your emails here
                </p>
                <Button onClick={() => fetchEmails()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Email cards
            emails.map((email) => (
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
            ))
          )}
          
          {/* Bottom Pagination Controls */}
          {!loading && emails.length > 0 && totalEmailCount > EMAILS_PER_PAGE && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.ceil(totalEmailCount / EMAILS_PER_PAGE)}
              totalCount={totalEmailCount}
              itemsPerPage={EMAILS_PER_PAGE}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </main>
    </div>
  )
}
