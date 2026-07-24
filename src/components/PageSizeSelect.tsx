'use client'

import { cn } from '@/lib/utils'
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/page-size'

interface PageSizeSelectProps {
  value: number
  onChange: (size: PageSize) => void
  className?: string
  id?: string
}

export function PageSizeSelect({
  value,
  onChange,
  className,
  id = 'page-size',
}: PageSizeSelectProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="text-sm text-muted-foreground shrink-0">
        Show
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as PageSize)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
