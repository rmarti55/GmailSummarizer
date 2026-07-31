'use client'

import { useState, useRef } from 'react'
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
import { applyEmailSelectionChange, type SelectChangeOptions } from '@/lib/email-selection'
import { normalizeSenderForDisplay } from '@/lib/sender-utils'
import {
  getSenderExpandErrorCopy,
  type SenderExpandErrorKind,
} from '@/lib/sender-expand-fetch'
import { cn } from '@/lib/utils'

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
  fetchErrorKind?: SenderExpandErrorKind | null
  onRetry?: (sender: string) => void
  onPageChange: (sender: string, page: number) => void
  onPageSizeChange: (sender: string, pageSize: PageSize) => void
  pageSize: number
  onDeleteEmail: (emailId: string, senderName: string) => void
  onBulkDelete: (emailIds: string[], senderName: string) => Promise<void>
  onOpenEmail: (email: Email) => void
  deletingId: string | null
  bulkDeleting?: boolean
  bulkDeleteProgress?: string | null
  isExiting?: boolean
}

export function ExpandableSenderCard({
  sender,
  rank,
  isExpanded,
  onToggleExpand,
  emails,
  pagination,
  loading,
  fetchErrorKind = null,
  onRetry,
  onPageChange,
  onPageSizeChange,
  pageSize,
  onDeleteEmail,
  onBulkDelete,
  onOpenEmail,
  deletingId,
  bulkDeleting = false,
  bulkDeleteProgress = null,
  isExiting = false,
}: ExpandableSenderCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectionAnchorRef = useRef<string | null>(null)
  const errorCopy = fetchErrorKind ? getSenderExpandErrorCopy(fetchErrorKind) : null

  const allSelected = emails.length > 0 && selectedIds.size === emails.length

  const clearSelection = () => {
    setSelectedIds(new Set())
    selectionAnchorRef.current = null
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

  const handlePageChange = (page: number) => {
    clearSelection()
    onPageChange(sender.sender, page)
  }

  const handlePageSizeChange = (size: PageSize) => {
    clearSelection()
    onPageSizeChange(sender.sender, size)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || isExiting) return
    await onBulkDelete(ids, sender.sender)
    clearSelection()
  }

  const displayName = normalizeSenderForDisplay(sender.sender)
  const showExpanded = isExpanded && !isExiting

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-lg py-0 gap-0 shadow-none',
        isExiting
          ? 'pointer-events-none animate-out fade-out-0 slide-out-to-top-1 duration-200 max-h-0 opacity-0'
          : 'transition-colors hover:bg-accent/30'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 py-1.5 px-3 transition-colors',
          isExiting ? 'cursor-default' : 'cursor-pointer hover:bg-accent'
        )}
        onClick={() => {
          if (!isExiting) onToggleExpand(sender.sender)
        }}
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

      {showExpanded && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <Separator />
          <CardContent className="p-2">
            {loading ? (
              <div className="rounded-md border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 border-b px-2 py-1 last:border-b-0"
                  >
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : errorCopy ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{errorCopy.title}</h3>
                <p className="text-muted-foreground mb-4">{errorCopy.description}</p>
                {onRetry && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRetry(sender.sender)
                    }}
                  >
                    Retry
                  </Button>
                )}
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
                <div className="mb-1.5 overflow-hidden rounded-md border bg-muted/40">
                  {pagination && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1">
                      <div className="text-xs text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} emails
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <PageSizeSelect
                          id={`sender-page-size-${rank}`}
                          value={pageSize}
                          onChange={handlePageSizeChange}
                          compact
                        />
                        {pagination.totalPages > 1 && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={!pagination.hasPrev}
                              onClick={() => handlePageChange(pagination.page - 1)}
                            >
                              Previous
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
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
                  {pagination && <Separator />}
                  <EmailBulkActionBar
                    selectedCount={selectedIds.size}
                    totalInView={emails.length}
                    allSelected={allSelected}
                    onSelectAllInView={handleSelectAllInView}
                    onClearSelection={clearSelection}
                    onBulkDelete={handleBulkDelete}
                    deleting={bulkDeleting}
                    deleteProgress={bulkDeleteProgress ?? undefined}
                    compact
                    embedded
                  />
                </div>

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
                      compact
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
