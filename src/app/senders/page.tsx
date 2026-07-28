'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/AppHeader'
import { ExpandableSenderCard } from '@/components/ExpandableSenderCard'
import { EmailDetailSheet } from '@/components/EmailDetailSheet'
import { syncNewEmailsFromGmail } from '@/lib/client-gmail-sync'
import { deleteEmailFromGmail, deleteEmailsFromGmail } from '@/lib/client-gmail-delete'
import { useSummarizeQueue } from '@/hooks/useSummarizeQueue'
import { Mail, BarChart3 } from 'lucide-react'
import { SenderStats, PaginationInfo, Email } from '@/types'
import { type PageSize } from '@/components/PageSizeSelect'

function pageAfterDelete(pagination: PaginationInfo | undefined, deletedCount: number): number {
  if (!pagination) return 1
  const newTotal = Math.max(0, pagination.total - deletedCount)
  const totalPages = Math.max(1, Math.ceil(newTotal / pagination.limit))
  return Math.min(pagination.page, totalPages)
}

export default function SendersPage() {
  const [senders, setSenders] = useState<SenderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSender, setExpandedSender] = useState<string | null>(null)
  const [senderEmails, setSenderEmails] = useState<Record<string, Email[]>>({})
  const [senderPagination, setSenderPagination] = useState<Record<string, PaginationInfo>>({})
  const [senderLoading, setSenderLoading] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [detailEmailId, setDetailEmailId] = useState<string | null>(null)
  const [detailSender, setDetailSender] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState<PageSize>(10)

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

  const { enqueueSummary, isSummarizing } = useSummarizeQueue(handleSummaryComplete)

  const detailEmail =
    detailEmailId && detailSender
      ? (senderEmails[detailSender] || []).find((email) => email.id === detailEmailId) ?? null
      : null

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
    if (!confirm('Clear all existing summaries? They will be regenerated when you open an email.'))
      return

    try {
      const response = await fetch('/api/clear-summaries', { method: 'POST' })
      if (response.ok) {
        setSenderEmails((prev) => {
          const next: Record<string, Email[]> = {}
          for (const [sender, emails] of Object.entries(prev)) {
            next[sender] = emails.map((email) => ({ ...email, summary: null }))
          }
          return next
        })
        alert('All summaries cleared! Open an email to generate a new summary.')
      }
    } catch (error) {
      console.error('Failed to clear summaries:', error)
    }
  }

  const clearAllEmails = async () => {
    if (
      !confirm(
        'Clear all cached emails? They will be re-processed with clean formatting on next refresh.'
      )
    )
      return

    try {
      const response = await fetch('/api/clear-emails', { method: 'POST' })
      if (response.ok) {
        setSenders([])
        setSenderEmails({})
        setDetailEmailId(null)
        setDetailSender(null)
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

  const fetchSenderEmails = async (sender: string, page: number = 1, limit: number = pageSize) => {
    setSenderLoading((prev) => ({ ...prev, [sender]: true }))
    try {
      const response = await fetch(
        `/api/senders/${encodeURIComponent(sender)}/emails?page=${page}&limit=${limit}`
      )
      if (response.ok) {
        const data = await response.json()
        const emails = data.emails || []
        const pagination = data.pagination as PaginationInfo | undefined
        setSenderEmails((prev) => ({ ...prev, [sender]: emails }))
        if (pagination) {
          setSenderPagination((prev) => ({ ...prev, [sender]: pagination }))
          setSenders((prev) =>
            prev.map((entry) =>
              entry.sender === sender ? { ...entry, count: pagination.total } : entry
            )
          )
        }
      } else {
        console.error('Failed to fetch sender emails')
      }
    } catch (error) {
      console.error('Failed to fetch sender emails:', error)
    }
    setSenderLoading((prev) => ({ ...prev, [sender]: false }))
  }

  const handleToggleExpand = async (sender: string) => {
    if (expandedSender === sender) {
      setExpandedSender(null)
    } else {
      setExpandedSender(sender)
      const cachedEmails = senderEmails[sender]
      const senderStats = senders.find((entry) => entry.sender === sender)
      const needsFetch =
        !cachedEmails || (cachedEmails.length === 0 && (senderStats?.count ?? 0) > 0)
      if (needsFetch) {
        await fetchSenderEmails(sender, 1)
      }
    }
  }

  const handlePageChange = async (sender: string, page: number) => {
    await fetchSenderEmails(sender, page, pageSize)
  }

  const handlePageSizeChange = async (sender: string, nextPageSize: PageSize) => {
    setPageSize(nextPageSize)
    setSenderEmails((prev) => {
      const next = { ...prev }
      delete next[sender]
      return next
    })
    setSenderPagination((prev) => {
      const next = { ...prev }
      delete next[sender]
      return next
    })
    await fetchSenderEmails(sender, 1, nextPageSize)
  }

  const afterSenderEmailsDeleted = async (emailIds: string[], senderName: string) => {
    const idSet = new Set(emailIds)
    if (detailEmailId && idSet.has(detailEmailId)) {
      setDetailEmailId(null)
      setDetailSender(null)
    }

    const pagination = senderPagination[senderName]
    const nextPage = pageAfterDelete(pagination, emailIds.length)
    await fetchSenderEmails(senderName, nextPage, pageSize)
  }

  const handleDeleteEmail = async (emailId: string, senderName: string) => {
    if (!confirm('Move this email to Gmail Trash and remove it from the app?')) return

    setDeletingId(emailId)
    try {
      const success = await deleteEmailFromGmail(emailId)
      if (success) {
        await afterSenderEmailsDeleted([emailId], senderName)
      } else {
        alert('Failed to delete email. Please try again.')
      }
    } catch (error) {
      console.error('Failed to delete email:', error)
      alert('Failed to delete email. Please try again.')
    }
    setDeletingId(null)
  }

  const handleBulkDelete = async (emailIds: string[], senderName: string) => {
    if (emailIds.length === 0) return
    if (
      !confirm(
        `Move ${emailIds.length} email${emailIds.length === 1 ? '' : 's'} to Gmail Trash and remove from the app?`
      )
    ) {
      return
    }

    setBulkDeleting(true)
    try {
      const result = await deleteEmailsFromGmail(emailIds)
      if (result && result.deletedIds.length > 0) {
        await afterSenderEmailsDeleted(result.deletedIds, senderName)
        if (result.failedIds.length > 0) {
          alert(`Deleted ${result.deletedIds.length}, but ${result.failedIds.length} failed.`)
        }
      } else {
        alert(result?.error ?? 'Failed to delete emails. Please try again.')
      }
    } catch (error) {
      console.error('Failed to bulk delete emails:', error)
      alert('Failed to delete emails. Please try again.')
    }
    setBulkDeleting(false)
  }

  const handleOpenEmail = (email: Email, senderName: string) => {
    setDetailEmailId(email.id)
    setDetailSender(senderName)
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
            <h2 className="text-2xl font-bold text-foreground">Email Senders Overview</h2>
          </div>
          <p className="text-muted-foreground">
            Ranked by email volume — open an email to read its summary and full message
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
              <h3 className="text-lg font-medium text-foreground mb-2">No email data found</h3>
              <p className="text-muted-foreground">Visit the Dashboard to fetch emails first</p>
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
                onPageSizeChange={handlePageSizeChange}
                pageSize={pageSize}
                onDeleteEmail={handleDeleteEmail}
                onBulkDelete={handleBulkDelete}
                onOpenEmail={(email) => handleOpenEmail(email, sender.sender)}
                deletingId={deletingId}
                bulkDeleting={bulkDeleting}
              />
            ))}
          </div>
        )}

        {senders.length > 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            Click any sender, then open an email to read its summary and full message
          </div>
        )}
      </main>

      <EmailDetailSheet
        email={detailEmail}
        open={detailEmailId !== null && detailEmail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailEmailId(null)
            setDetailSender(null)
          }
        }}
        isSummarizing={detailEmail ? isSummarizing(detailEmail.id) : false}
        onRequestSummary={enqueueSummary}
        onDelete={(emailId) => {
          if (detailSender) {
            void handleDeleteEmail(emailId, detailSender)
          }
        }}
        deleting={detailEmail ? deletingId === detailEmail.id : false}
      />
    </div>
  )
}
