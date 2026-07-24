'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface EmailBulkActionBarProps {
  selectedCount: number
  totalInView: number
  allSelected: boolean
  onSelectAllInView: (selected: boolean) => void
  onClearSelection: () => void
  onBulkDelete: () => void
  deleting?: boolean
}

export function EmailBulkActionBar({
  selectedCount,
  totalInView,
  allSelected,
  onSelectAllInView,
  onClearSelection,
  onBulkDelete,
  deleting = false,
}: EmailBulkActionBarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelected && totalInView > 0}
          onCheckedChange={(checked) => onSelectAllInView(checked === true)}
          aria-label="Select all emails in view"
        />
        <span className="text-sm text-muted-foreground">
          {selectedCount > 0
            ? `${selectedCount} selected`
            : `Select all (${totalInView})`}
        </span>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? 'Deleting...' : `Delete ${selectedCount}`}
          </Button>
        </div>
      )}
    </div>
  )
}
