'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface EmailBulkActionBarProps {
  selectedCount: number
  totalInView: number
  allSelected: boolean
  onSelectAllInView: (selected: boolean) => void
  onClearSelection: () => void
  onBulkDelete: () => void
  deleting?: boolean
  deleteProgress?: string
  compact?: boolean
  embedded?: boolean
}

export function EmailBulkActionBar({
  selectedCount,
  totalInView,
  allSelected,
  onSelectAllInView,
  onClearSelection,
  onBulkDelete,
  deleting = false,
  deleteProgress,
  compact = false,
  embedded = false,
}: EmailBulkActionBarProps) {
  const hasSelection = selectedCount > 0

  return (
    <div
      className={cn(
        'flex flex-nowrap items-center',
        compact ? 'h-7 gap-2 px-2' : 'h-8 gap-3 px-3',
        !embedded && 'mb-3 rounded-md border bg-muted/40'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Checkbox
          checked={
            allSelected && totalInView > 0
              ? true
              : selectedCount > 0
                ? 'indeterminate'
                : false
          }
          onCheckedChange={(checked) => onSelectAllInView(checked === true)}
          aria-label="Select all emails in view"
        />
        <span
          className={cn(
            'truncate text-muted-foreground',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {hasSelection
            ? `${selectedCount} selected`
            : `Select all (${totalInView})`}
        </span>
      </div>

      <div
        className={`ml-auto flex shrink-0 items-center gap-2 ${
          hasSelection ? '' : 'invisible pointer-events-none'
        }`}
      >
        <Button
          variant="ghost"
          size="sm"
          className={compact ? 'h-7 px-2 text-xs' : undefined}
          onClick={onClearSelection}
        >
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkDelete}
          disabled={deleting || !hasSelection}
          className={cn(
            'text-destructive hover:text-destructive',
            compact && 'h-7 px-2 text-xs'
          )}
        >
          <Trash2 className={cn('mr-2', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          {deleting
            ? (deleteProgress ?? 'Deleting...')
            : `Delete ${Math.max(selectedCount, 1)}`}
        </Button>
      </div>
    </div>
  )
}
