'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/AppHeader'
import { ExpandableSenderCard } from '@/components/ExpandableSenderCard'
import { syncNewEmailsFromGmail } from '@/lib/client-gmail-sync'
import { deleteEmailFromGmail } from '@/lib/client-gmail-delete'
import { useSummarizeQueue } from '@/hooks/useSummarizeQueue'
import { Mail, BarChart3 } from 'lucide-react'
import { SenderStats, PaginationInfo, Email } from '@/types'

export default function SendersPage() {
  const [senders, setSenders] = useState<SenderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSender, setExpandedSender] = useState<string | null>(null)
  const [senderEmails, setSenderEmails] = useState<Record<string, Email[]>>({})
  const [senderPagination, setSenderPagination] = useState<Record<string, PaginationInfo>>({})
  const [senderLoading, setSenderLoading] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSummaryComplete = useCallback((emailId: string, summary: string) => {
    setSenderEmails((prev) => {
      const next: Record<string, Email[]> = {}
      for (const [sender, emails] of Object.entries(prev)) {
        next[sender] = emails.map((email) =>
          email.id === emailId ? { ...email, summary } : email
        )
      }
      return next
    })
  }, [])

  const { enqueueMissingSummaries, isSummarizing } = useSummarizeQueue(handleSummaryComplete)

  const handleRefresh = async () => {
    await syncNewEmailsFromGmail()
    fetchSenderStats()
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
        alert('All summaries cleared! Visit Dashboard to refresh and generate new summaries.')
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
        // Clear senders data too since it depends on emails
        setSenders([])
        alert('All emails cleared! Visit Dashboard to refresh and process emails.')
      }
    } catch (error) {
      console.error('Failed to clear emails:', error)
    }
  }

  const fetchSenderStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/senders')
      if (response.ok) {
        const data = await response.json()
        setSenders(data.senders || [])
      } else {
        console.error('Failed to fetch sender stats')
      }
    } catch (error) {
      console.error('Failed to fetch sender stats:', error)
    }
    setLoading(false)
  }

  const fetchSenderEmails = async (sender: string, page: number = 1) => {
    setSenderLoading(prev => ({ ...prev, [sender]: true }))
    try {
      const response = await fetch(`/api/senders/${encodeURIComponent(sender)}/emails?page=${page}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        const emails = data.emails || []
        setSenderEmails(prev => ({ ...prev, [sender]: emails }))
        setSenderPagination(prev => ({ ...prev, [sender]: data.pagination }))
        enqueueMissingSummaries(emails)
      } else {
        console.error('Failed to fetch sender emails')
      }
    } catch (error) {
      console.error('Failed to fetch sender emails:', error)
    }
    setSenderLoading(prev => ({ ...prev, [sender]: false }))
  }

  const handleToggleExpand = async (sender: string) => {
    if (expandedSender === sender) {
      // Collapse
      setExpandedSender(null)
    } else {
      // Expand
      setExpandedSender(sender)
      if (!senderEmails[sender]) {
        await fetchSenderEmails(sender, 1)
      }
    }
  }

  const handlePageChange = async (sender: string, page: number) => {
    await fetchSenderEmails(sender, page)
  }

  const handleDeleteEmail = async (emailId: string, senderName: string) => {
    if (!confirm('Move this email to Gmail Trash and remove it from the app?')) return

    setDeletingId(emailId)
    try {
      const success = await deleteEmailFromGmail(emailId)
      if (success) {
        setSenderEmails((prev) => ({
          ...prev,
          [senderName]: (prev[senderName] || []).filter((email) => email.id !== emailId),
        }))
        setSenderPagination((prev) => {
          const pagination = prev[senderName]
          if (!pagination) return prev
          return {
            ...prev,
            [senderName]: {
              ...pagination,
              total: Math.max(0, pagination.total - 1),
            },
          }
        })
        setSenders((prev) =>
          prev.map((sender) =>
            sender.sender === senderName
              ? { ...sender, count: Math.max(0, sender.count - 1) }
              : sender
          )
        )
      } else {
        alert('Failed to delete email. Please try again.')
      }
    } catch (error) {
      console.error('Failed to delete email:', error)
      alert('Failed to delete email. Please try again.')
    }
    setDeletingId(null)
  }

  useEffect(() => {
    fetchSenderStats()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onRefresh={handleRefresh}
        onClearSummaries={clearAllSummaries}
        onClearAllEmails={clearAllEmails}
        onLogout={handleLogout}
        loading={loading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">
              Email Senders Overview
            </h2>
          </div>
          <p className="text-muted-foreground">
            Ranked by email volume in your inbox
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : senders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No email data found
              </h3>
              <p className="text-muted-foreground">
                Visit the Dashboard to fetch emails first
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {senders.map((sender, index) => (
              <ExpandableSenderCard
                key={sender.sender}
                sender={sender}
                rank={index + 1}
                isExpanded={expandedSender === sender.sender}
                onToggleExpand={handleToggleExpand}
                emails={senderEmails[sender.sender] || []}
                pagination={senderPagination[sender.sender] || null}
                loading={senderLoading[sender.sender] || false}
                onPageChange={handlePageChange}
                onDeleteEmail={handleDeleteEmail}
                deletingId={deletingId}
                isSummarizing={isSummarizing}
              />
            ))}
          </div>
        )}

        {senders.length > 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            💡 Click any sender to see their emails with AI summaries
          </div>
        )}
      </main>
    </div>
  )
}
