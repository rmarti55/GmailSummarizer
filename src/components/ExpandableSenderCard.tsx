'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, ChevronDown, Mail } from 'lucide-react'
import { EmailListRow } from '@/components/EmailListRow'
import { EmailBulkActionBar } from '@/components/EmailBulkActionBar'
import { PageSizeSelect, type PageSize } from '@/components/PageSizeSelect'
import { Email } from '@/types'
import { normalizeSenderForDisplay } from '@/lib/sender-utils'

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
  onPageSizeChange: (sender: string, pageSize: PageSize) => void
  pageSize: number
  onDeleteEmail: (emailId: string, senderName: string) => void
  onBulkDelete: (emailIds: string[], senderName: string) => Promise<void>
  onOpenEmail: (email: Email) => void
  deletingId: string | null
  bulkDeleting?: boolean
  bulkDeleteProgress?: string | null
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
  onPageSizeChange,
  pageSize,
  onDeleteEmail,
  onBulkDelete,
  onOpenEmail,
  deletingId,
  bulkDeleting = false,
  bulkDeleteProgress = null,
}: ExpandableSenderCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allSelected = emails.length > 0 && selectedIds.size === emails.length

  const handleSelectChange = (emailId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(emailId)
      else next.delete(emailId)
      return next
    })
  }

  const handleSelectAllInView = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(emails.map((email) => email.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handlePageChange = (page: number) => {
    setSelectedIds(new Set())
    onPageChange(sender.sender, page)
  }

  const handlePageSizeChange = (size: PageSize) => {
    setSelectedIds(new Set())
    onPageSizeChange(sender.sender, size)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await onBulkDelete(ids, sender.sender)
    setSelectedIds(new Set())
  }

  const displayName = normalizeSenderForDisplay(sender.sender)

  return (
    <Card className="overflow-hidden rounded-lg py-0 gap-0 shadow-none transition-colors hover:bg-accent/30">
      <div
        className="flex items-center justify-between gap-3 py-2 px-3 cursor-pointer hover:bg-accent transition-colors"
        onClick={() => onToggleExpand(sender.sender)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {rank}
          </div>
          <p className="min-w-0 truncate text-sm font-medium text-foreground">
            {displayName}
            <span className="font-normal text-muted-foreground">
              {' '}
              · {sender.percentage}%
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {sender.count} emails
          </Badge>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <Separator />
          <CardContent className="p-3">
            {loading ? (
              <div className="rounded-md border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                  >
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No emails found</h3>
                <p className="text-muted-foreground">
                  No emails from this sender in your current data
                </p>
              </div>
            ) : (
              <>
                {pagination && (
                  <div className="flex flex-col gap-3 pb-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} emails
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <PageSizeSelect
                        id={`sender-page-size-${rank}`}
                        value={pageSize}
                        onChange={handlePageSizeChange}
                      />
                      {pagination.totalPages > 1 && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!pagination.hasPrev}
                            onClick={() => handlePageChange(pagination.page - 1)}
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
                            onClick={() => handlePageChange(pagination.page + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <EmailBulkActionBar
                  selectedCount={selectedIds.size}
                  totalInView={emails.length}
                  allSelected={allSelected}
                  onSelectAllInView={handleSelectAllInView}
                  onClearSelection={() => setSelectedIds(new Set())}
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
                      onOpen={onOpenEmail}
                      onDelete={(emailId) => onDeleteEmail(emailId, sender.sender)}
                      deleting={deletingId === email.id}
                      showSender={false}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </div>
      )}
    </Card>
  )
}
