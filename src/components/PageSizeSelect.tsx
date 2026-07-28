'use client'

import { cn } from '@/lib/utils'
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/page-size'

interface PageSizeSelectProps {
  value: number
  onChange: (size: PageSize) => void
  className?: string
  id?: string
  compact?: boolean
}

export function PageSizeSelect({
  value,
  onChange,
  className,
  id = 'page-size',
  compact = false,
}: PageSizeSelectProps) {
  return (
    <div className={cn('flex items-center', compact ? 'gap-1.5' : 'gap-2', className)}>
      <label
        htmlFor={id}
        className={cn(
          'text-muted-foreground shrink-0',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        Show
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as PageSize)}
        className={cn(
          'rounded-md border border-input bg-background shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact ? 'h-7 px-1.5 text-xs' : 'h-9 px-2 text-sm'
        )}
        aria-label="Emails per page"
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  )
}

export { PAGE_SIZE_OPTIONS, type PageSize }
