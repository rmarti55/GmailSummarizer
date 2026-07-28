'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, RefreshCw, X } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { PaginationControls } from '@/components/PaginationControls'
import { EmailListRow } from '@/components/EmailListRow'
import { EmailDetailSheet } from '@/components/EmailDetailSheet'
import { EmailBulkActionBar } from '@/components/EmailBulkActionBar'
import { type PageSize } from '@/components/PageSizeSelect'
import { syncNewEmailsFromGmail } from '@/lib/client-gmail-sync'
import { deleteEmailFromGmail, deleteEmailsFromGmail } from '@/lib/client-gmail-delete'
import { useSummarizeQueue } from '@/hooks/useSummarizeQueue'
import { applyEmailSelectionChange, type SelectChangeOptions } from '@/lib/email-selection'
import { Email } from '@/types'

type InboxSort = 'newest' | 'oldest' | 'sender-asc' | 'sender-desc'

function buildListQueryParams(
  page: number,
  pageSize: number,
  senderFilter: string | null,
  sortMode: InboxSort
) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  })

  if (senderFilter) {
    params.set('sender', senderFilter)
  }

  if (sortMode === 'sender-asc') {
    params.set('sort', 'sender')
    params.set('order', 'asc')
  } else if (sortMode === 'sender-desc') {
    params.set('sort', 'sender')
    params.set('order', 'desc')
  } else if (sortMode === 'oldest') {
    params.set('sort', 'date')
    params.set('order', 'asc')
  } else {
    params.set('sort', 'date')
    params.set('order', 'desc')
  }

  return params
}

function buildCountQueryParams(senderFilter: string | null) {
  const params = new URLSearchParams()
  if (senderFilter) {
    params.set('sender', senderFilter)
  }
  return params
}

function pageAfterDelete(
  currentPage: number,
  pageSize: number,
  totalCount: number,
  deletedCount: number
): number {
  const newTotal = Math.max(0, totalCount - deletedCount)
  const totalPages = Math.max(1, Math.ceil(newTotal / pageSize))
  return Math.min(currentPage, totalPages)
}

export default function Dashboard() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [totalEmailCount, setTotalEmailCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [senderFilter, setSenderFilter] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<InboxSort>('newest')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectionAnchorRef = useRef<string | null>(null)
  const [detailEmailId, setDetailEmailId] = useState<string | null>(null)

  const handleSummaryComplete = useCallback((emailId: string, summary: string) => {
    setEmails((prev) =>
      prev.map((email) => (email.id === emailId ? { ...email, summary } : email))
    )
  }, [])

  const { enqueueSummary, isSummarizing } = useSummarizeQueue(handleSummaryComplete)

  const detailEmail = detailEmailId
    ? emails.find((email) => email.id === detailEmailId) ?? null
    : null

  const fetchEmailCount = async (filter: string | null = senderFilter) => {
    try {
      const params = buildCountQueryParams(filter)
      const query = params.toString()
      const response = await fetch(query ? `/api/gmail/count?${query}` : '/api/gmail/count')
      if (response.ok) {
        const data = await response.json()
        setTotalEmailCount(data.totalEmails)
      }
    } catch (error) {
      console.error('Failed to fetch email count:', error)
    }
  }

  const fetchEmails = async (
    page: number = 1,
    silent = false,
    options?: {
      filter?: string | null
      size?: PageSize
      sort?: InboxSort
    }
  ) => {
    if (!silent) setLoading(true)

    const activeFilter = options?.filter !== undefined ? options.filter : senderFilter
    const activeSize = options?.size ?? pageSize
    const activeSort = options?.sort ?? sortMode

    try {
      const params = buildListQueryParams(page, activeSize, activeFilter, activeSort)
      const response = await fetch(`/api/gmail/count?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        const newEmails = data.emails || []

        setEmails(newEmails)
        await fetchEmailCount(activeFilter)
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    }

    if (!silent) setLoading(false)
  }

  const resetListView = () => {
    setSelectedIds(new Set())
    selectionAnchorRef.current = null
    setDetailEmailId(null)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    selectionAnchorRef.current = null
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    resetListView()
    fetchEmails(page)
  }

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size)
    setCurrentPage(1)
    resetListView()
    fetchEmails(1, false, { size })
  }

  const handleSortChange = (nextSort: InboxSort) => {
    setSortMode(nextSort)
    setCurrentPage(1)
    resetListView()
    fetchEmails(1, false, { sort: nextSort })
  }

  const handleSenderFilter = (sender: string) => {
    setSenderFilter(sender)
    setCurrentPage(1)
    resetListView()
    fetchEmails(1, false, { filter: sender })
  }

  const clearSenderFilter = () => {
    setSenderFilter(null)
    setCurrentPage(1)
    resetListView()
    fetchEmails(1, false, { filter: null })
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await syncNewEmailsFromGmail()
      await fetchEmailCount()
      await fetchEmails(currentPage, true)
    } catch (error) {
      console.error('Failed to refresh:', error)
    }
    setLoading(false)
  }

  const handleFullSync = (silent = false) => {
    fetchEmailCount()
    fetchEmails(currentPage, silent)
  }

  const afterEmailsDeleted = async (deletedIds: string[]) => {
    const idSet = new Set(deletedIds)
    if (detailEmailId && idSet.has(detailEmailId)) {
      setDetailEmailId(null)
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of deletedIds) next.delete(id)
      return next
    })

    const nextPage = pageAfterDelete(currentPage, pageSize, totalEmailCount, deletedIds.length)
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage)
    }
    await fetchEmails(nextPage, true)
  }

  const handleDeleteEmail = async (emailId: string) => {
    setDeletingId(emailId)
    try {
      const success = await deleteEmailFromGmail(emailId)
      if (success) {
        await afterEmailsDeleted([emailId])
      } else {
        alert('Failed to delete email. Please try again.')
      }
    } catch (error) {
      console.error('Failed to delete email:', error)
      alert('Failed to delete email. Please try again.')
    }
    setDeletingId(null)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBulkDeleting(true)
    setBulkDeleteProgress(`Moving ${ids.length} email${ids.length === 1 ? '' : 's'} to trash...`)
    try {
      const result = await deleteEmailsFromGmail(ids)
      if (result && result.deletedIds.length > 0) {
        await afterEmailsDeleted(result.deletedIds)
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

  const handleSelectChange = (
    emailId: string,
    selected: boolean,
    options?: SelectChangeOptions
  ) => {
    const emailIdsInView = emails.map((email) => email.id)
    setSelectedIds((prev) => {
      const result = applyEmailSelectionChange(
        prev,
        selectionAnchorRef.current,
        emailIdsInView,
        emailId,
        selected,
        options
      )
      selectionAnchorRef.current = result.anchorId
      return result.selectedIds
    })
  }

  const handleSelectAllInView = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(emails.map((email) => email.id)))
    } else {
      clearSelection()
    }
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
        setEmails((prev) => prev.map((email) => ({ ...email, summary: null })))
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
        setEmails([])
        clearSelection()
        setDetailEmailId(null)
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

  const allSelected = emails.length > 0 && selectedIds.size === emails.length
  const totalPages = Math.max(1, Math.ceil(totalEmailCount / pageSize))
  const showPagination = !loading && totalEmailCount > 0

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onRefresh={handleRefresh}
        onClearSummaries={clearAllSummaries}
        onClearAllEmails={clearAllEmails}
        onLogout={handleLogout}
        onFullSync={handleFullSync}
        loading={loading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Your Inbox</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Open an email to read its summary and full message
            </p>
            {totalEmailCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {totalEmailCount.toLocaleString()} total emails
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="inbox-sort" className="text-sm text-muted-foreground shrink-0">
                Sort
              </label>
              <select
                id="inbox-sort"
                value={sortMode}
                onChange={(event) => handleSortChange(event.target.value as InboxSort)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Sort inbox"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="sender-asc">Sender A–Z</option>
                <option value="sender-desc">Sender Z–A</option>
              </select>
            </div>

            {senderFilter && (
              <Badge variant="secondary" className="gap-1 pr-1">
                From: {senderFilter}
                <button
                  type="button"
                  onClick={clearSenderFilter}
                  className="ml-1 rounded-sm p-0.5 hover:bg-accent"
                  aria-label="Clear sender filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>

        {showPagination && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalEmailCount}
            itemsPerPage={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-md border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {senderFilter ? `No emails from ${senderFilter}` : 'No emails found'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {senderFilter
                    ? 'Try clearing the sender filter or refresh your inbox.'
                    : 'Connect your Gmail account to see your emails here'}
                </p>
                {senderFilter ? (
                  <Button onClick={clearSenderFilter} variant="outline">
                    Clear sender filter
                  </Button>
                ) : (
                  <Button onClick={handleRefresh}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <EmailBulkActionBar
                selectedCount={selectedIds.size}
                totalInView={emails.length}
                allSelected={allSelected}
                onSelectAllInView={handleSelectAllInView}
                onClearSelection={clearSelection}
                onBulkDelete={handleBulkDelete}
                deleting={bulkDeleting}
                deleteProgress={bulkDeleteProgress ?? undefined}
              />

              <div className="rounded-md border overflow-hidden">
                {emails.map((email) => (
                  <EmailListRow
                    key={email.id}
                    email={email}
                    selected={selectedIds.has(email.id)}
                    onSelectChange={handleSelectChange}
                    onOpen={(opened) => setDetailEmailId(opened.id)}
                    onSenderClick={handleSenderFilter}
                    onDelete={handleDeleteEmail}
                    deleting={deletingId === email.id}
                  />
                ))}
              </div>
            </>
          )}

          {showPagination && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalEmailCount}
              itemsPerPage={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      </main>

      <EmailDetailSheet
        email={detailEmail}
        open={detailEmailId !== null && detailEmail !== null}
        onOpenChange={(open) => {
          if (!open) setDetailEmailId(null)
        }}
        isSummarizing={detailEmail ? isSummarizing(detailEmail.id) : false}
        onRequestSummary={enqueueSummary}
        onDelete={handleDeleteEmail}
        deleting={detailEmail ? deletingId === detailEmail.id : false}
      />
    </div>
  )
}
