'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/AppHeader'
import { ExpandableSenderCard } from '@/components/ExpandableSenderCard'
import { EmailDetailSheet } from '@/components/EmailDetailSheet'
import { syncNewEmailsFromGmail } from '@/lib/client-gmail-sync'
import { deleteEmailFromGmail, deleteEmailsFromGmail } from '@/lib/client-gmail-delete'
import { normalizeSenderForDisplay, updateSenderPercentages } from '@/lib/sender-utils'
import {
  fetchWithRetry,
  type SenderExpandErrorKind,
} from '@/lib/sender-expand-fetch'
import { useSummarizeQueue } from '@/hooks/useSummarizeQueue'
import { Mail, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SenderStats, PaginationInfo, Email } from '@/types'
import { type PageSize } from '@/components/PageSizeSelect'

type SenderFilter = 'all' | 'person' | 'organization'

const SENDER_FILTERS: Array<{ id: SenderFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'person', label: 'People' },
  { id: 'organization', label: 'Organizations' },
]

const SENDER_EXIT_MS = 220

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
  const [senderFetchError, setSenderFetchError] = useState<
    Record<string, SenderExpandErrorKind | null>
  >({})
  const senderFetchGeneration = useRef<Record<string, number>>({})
  const [exitingSenders, setExitingSenders] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<string | null>(null)
  const [detailEmailId, setDetailEmailId] = useState<string | null>(null)
  const [detailSender, setDetailSender] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState<PageSize>(100)
  const [totalEmailCount, setTotalEmailCount] = useState(0)
  const [senderFilter, setSenderFilter] = useState<SenderFilter>('all')
  const [senderCounts, setSenderCounts] = useState({
    all: 0,
    person: 0,
    organization: 0,
    unknown: 0,
  })

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
    await Promise.all([fetchSenderStats(), fetchEmailCount()])
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
        setTotalEmailCount(0)
        setDetailEmailId(null)
        setDetailSender(null)
        alert('All emails cleared! Visit Dashboard to refresh and process emails.')
      }
    } catch (error) {
      console.error('Failed to clear emails:', error)
    }
  }

  const fetchSenderStats = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }

    try {
      const response = await fetch('/api/senders')
      if (response.ok) {
        const data = await response.json()
        const nextSenders = (data.senders || []) as SenderStats[]
        setSenders(nextSenders)
        setSenderCounts(
          data.counts ?? {
            all: nextSenders.length,
            person: nextSenders.filter((entry) => entry.kind === 'person').length,
            organization: nextSenders.filter((entry) => entry.kind === 'organization').length,
            unknown: nextSenders.filter((entry) => entry.kind === 'unknown').length,
          }
        )
        return nextSenders
      }

      console.error('Failed to fetch sender stats')
    } catch (error) {
      console.error('Failed to fetch sender stats:', error)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }

    return null
  }

  const fetchEmailCount = async (): Promise<number | null> => {
    try {
      const response = await fetch('/api/gmail/count')
      if (response.ok) {
        const data = await response.json()
        const total = data.totalEmails as number
        setTotalEmailCount(total)
        return total
      }
    } catch (error) {
      console.error('Failed to fetch email count:', error)
    }

    return null
  }

  const fetchSenderEmails = async (
    sender: string,
    page: number = 1,
    limit: number = pageSize,
    options?: { expectedCount?: number }
  ) => {
    const senderKey = normalizeSenderForDisplay(sender)
    const expectedCount =
      options?.expectedCount ?? senders.find((entry) => entry.sender === senderKey)?.count ?? 0
    const requestId = (senderFetchGeneration.current[senderKey] ?? 0) + 1
    senderFetchGeneration.current[senderKey] = requestId
    const isStale = () => senderFetchGeneration.current[senderKey] !== requestId

    setSenderLoading((prev) => ({ ...prev, [senderKey]: true }))
    setSenderFetchError((prev) => ({ ...prev, [senderKey]: null }))
    try {
      const response = await fetchWithRetry(
        `/api/senders/emails?sender=${encodeURIComponent(senderKey)}&page=${page}&limit=${limit}`
      )
      if (isStale()) return

      if (response.ok) {
        const data = await response.json()
        if (isStale()) return

        const emails = data.emails || []
        const pagination = data.pagination as PaginationInfo | undefined
        const total = pagination?.total ?? 0
        const fetchMismatch = expectedCount > 0 && total === 0

        if (!fetchMismatch) {
          setSenderEmails((prev) => ({ ...prev, [senderKey]: emails }))
        }

        if (pagination) {
          setSenderPagination((prev) => ({ ...prev, [senderKey]: pagination }))
          if (total > 0) {
            setSenders((prev) =>
              prev.map((entry) =>
                entry.sender === senderKey ? { ...entry, count: total } : entry
              )
            )
          }
        }

        if (fetchMismatch) {
          setSenderFetchError((prev) => ({ ...prev, [senderKey]: 'mismatch' }))
        }
      } else {
        console.error('Failed to fetch sender emails', response.status)
        setSenderFetchError((prev) => ({ ...prev, [senderKey]: 'http' }))
      }
    } catch (error) {
      if (isStale()) return
      console.error('Failed to fetch sender emails:', error)
      setSenderFetchError((prev) => ({ ...prev, [senderKey]: 'network' }))
    } finally {
      if (!isStale()) {
        setSenderLoading((prev) => ({ ...prev, [senderKey]: false }))
      }
    }
  }

  const handleToggleExpand = async (sender: string) => {
    if (exitingSenders.has(sender)) return

    if (expandedSender === sender) {
      setExpandedSender(null)
    } else {
      setExpandedSender(sender)
      const cachedEmails = senderEmails[sender]
      const senderStats = senders.find((entry) => entry.sender === sender)
      const hadFetchError = Boolean(senderFetchError[sender])
      const needsFetch =
        hadFetchError ||
        !cachedEmails ||
        (cachedEmails.length === 0 && (senderStats?.count ?? 0) > 0)
      if (needsFetch) {
        await fetchSenderEmails(sender, 1)
      }
    }
  }

  const handleRetrySenderEmails = async (sender: string) => {
    await fetchSenderEmails(sender, 1)
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

  const removeSenderFromState = (senderKey: string, options?: { totalEmails?: number }) => {
    setSenders((prev) => {
      const filtered = prev.filter((entry) => entry.sender !== senderKey)
      return options?.totalEmails !== undefined
        ? updateSenderPercentages(filtered, options.totalEmails)
        : filtered
    })
    setExpandedSender((current) => (current === senderKey ? null : current))
    setSenderEmails((prev) => {
      const next = { ...prev }
      delete next[senderKey]
      return next
    })
    setSenderPagination((prev) => {
      const next = { ...prev }
      delete next[senderKey]
      return next
    })
    setSenderFetchError((prev) => {
      const next = { ...prev }
      delete next[senderKey]
      return next
    })
    setExitingSenders((prev) => {
      const next = new Set(prev)
      next.delete(senderKey)
      return next
    })
  }

  const decrementSenderCounts = (kind: SenderStats['kind']) => {
    setSenderCounts((prev) => ({
      all: Math.max(0, prev.all - 1),
      person: kind === 'person' ? Math.max(0, prev.person - 1) : prev.person,
      organization:
        kind === 'organization' ? Math.max(0, prev.organization - 1) : prev.organization,
      unknown: kind === 'unknown' ? Math.max(0, prev.unknown - 1) : prev.unknown,
    }))
  }

  const afterSenderEmailsDeleted = async (emailIds: string[], senderName: string) => {
    const senderKey = normalizeSenderForDisplay(senderName)
    const idSet = new Set(emailIds)
    if (detailEmailId && idSet.has(detailEmailId)) {
      setDetailEmailId(null)
      setDetailSender(null)
    }

    const pagination = senderPagination[senderKey]
    const localEmails = senderEmails[senderKey] || []
    const totalBefore = pagination?.total ?? localEmails.length
    const remaining = Math.max(0, totalBefore - emailIds.length)

    if (remaining === 0) {
      setSenderEmails((prev) => ({ ...prev, [senderKey]: [] }))
      setSenderFetchError((prev) => ({ ...prev, [senderKey]: false }))
      setExitingSenders((prev) => new Set(prev).add(senderKey))

      const removedSender = senders.find((entry) => entry.sender === senderKey)
      const newTotal = await fetchEmailCount()

      window.setTimeout(() => {
        removeSenderFromState(senderKey, {
          totalEmails: newTotal ?? Math.max(0, totalEmailCount - emailIds.length),
        })
        if (removedSender) {
          decrementSenderCounts(removedSender.kind)
        }
      }, SENDER_EXIT_MS)
      return
    }

    setSenderEmails((prev) => ({
      ...prev,
      [senderKey]: (prev[senderKey] || []).filter((email) => !idSet.has(email.id)),
    }))
    if (pagination) {
      const totalPages = Math.max(1, Math.ceil(remaining / pagination.limit))
      const nextPage = Math.min(pagination.page, totalPages)
      setSenderPagination((prev) => ({
        ...prev,
        [senderKey]: {
          ...pagination,
          total: remaining,
          totalPages,
          page: nextPage,
          hasNext: nextPage < totalPages,
          hasPrev: nextPage > 1,
        },
      }))
    }

    const nextPage = pageAfterDelete(pagination, emailIds.length)
    await fetchSenderEmails(senderKey, nextPage, pageSize, { expectedCount: remaining })

    const newTotal = await fetchEmailCount()
    const totalForPercentages =
      newTotal ?? Math.max(0, totalEmailCount - emailIds.length)
    setSenders((prev) =>
      updateSenderPercentages(
        prev.map((entry) =>
          entry.sender === senderKey ? { ...entry, count: remaining } : entry
        ),
        totalForPercentages
      )
    )
  }

  const handleDeleteEmail = async (emailId: string, senderName: string) => {
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

    setBulkDeleting(true)
    setBulkDeleteProgress(`Moving ${emailIds.length} email${emailIds.length === 1 ? '' : 's'} to trash...`)
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
    } finally {
      setBulkDeleting(false)
      setBulkDeleteProgress(null)
    }
  }

  const handleOpenEmail = (email: Email, senderName: string) => {
    setDetailEmailId(email.id)
    setDetailSender(senderName)
  }

  useEffect(() => {
    void Promise.all([fetchSenderStats(), fetchEmailCount()])
  }, [])

  const filteredSenders =
    senderFilter === 'all'
      ? senders
      : senders.filter((sender) => sender.kind === senderFilter)

  const getFilterCount = (filter: SenderFilter) => {
    if (filter === 'all') return senderCounts.all
    return senderCounts[filter]
  }

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Ranked by email volume — open an email to read its summary and full message
            </p>
            {totalEmailCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {totalEmailCount.toLocaleString()} total emails
              </p>
            )}
          </div>
        </div>

        {!loading && senders.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {SENDER_FILTERS.map((filter) => (
              <Button
                key={filter.id}
                type="button"
                variant={senderFilter === filter.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSenderFilter(filter.id)}
              >
                {filter.label}
                <span className="ml-2 text-xs opacity-80">{getFilterCount(filter.id)}</span>
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="rounded-lg py-0 gap-0 shadow-none">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-5 w-20 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSenders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {senders.length === 0 ? 'No email data found' : 'No senders in this category'}
              </h3>
              <p className="text-muted-foreground">
                {senders.length === 0
                  ? 'Visit the Dashboard to fetch emails first'
                  : 'Try another filter to see more senders'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {filteredSenders.map((sender, index) => (
              <ExpandableSenderCard
                key={sender.sender}
                sender={sender}
                rank={index + 1}
                isExpanded={expandedSender === sender.sender}
                onToggleExpand={handleToggleExpand}
                emails={senderEmails[sender.sender] || []}
                pagination={senderPagination[sender.sender] || null}
                loading={senderLoading[sender.sender] || false}
                fetchErrorKind={senderFetchError[sender.sender] ?? null}
                onRetry={handleRetrySenderEmails}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSize={pageSize}
                onDeleteEmail={handleDeleteEmail}
                onBulkDelete={handleBulkDelete}
                onOpenEmail={(email) => handleOpenEmail(email, sender.sender)}
                deletingId={deletingId}
                bulkDeleting={bulkDeleting}
                bulkDeleteProgress={bulkDeleting ? bulkDeleteProgress : null}
                isExiting={exitingSenders.has(sender.sender)}
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
