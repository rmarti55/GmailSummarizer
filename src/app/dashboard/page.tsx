'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, RefreshCw, Sparkles, LogOut } from 'lucide-react'
import { AdaptiveSummary } from '@/components/AdaptiveSummary'
import { Email } from '@/types'

export default function Dashboard() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [summarizing, setSummarizing] = useState<string | null>(null)

  const fetchEmails = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/gmail')
      if (response.ok) {
        const data = await response.json()
        setEmails(data.emails || [])
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    }
    setLoading(false)
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
    fetchEmails()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Gmail Summarizer
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                onClick={fetchEmails} 
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button variant="ghost" size="sm" onClick={clearAllSummaries} className="mr-2">
                Clear Summaries
              </Button>
              
              <Button variant="ghost" size="sm" onClick={clearAllEmails} className="mr-2">
                Clear All Emails
              </Button>
              
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Your Inbox
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered summaries of your recent emails
          </p>
        </div>

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
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No emails found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Connect your Gmail account to see your emails here
                </p>
                <Button onClick={fetchEmails}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Email cards
            emails.map((email) => (
              <Card key={email.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
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
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {email.body_preview}
                  </p>
                  
                  {email.summary ? (
                    <AdaptiveSummary email={email} />
                  ) : (
                    <Button
                      onClick={() => summarizeEmail(email.id)}
                      disabled={summarizing === email.id}
                      variant="outline"
                      size="sm"
                    >
                      {summarizing === email.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Summarizing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Summarize
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
