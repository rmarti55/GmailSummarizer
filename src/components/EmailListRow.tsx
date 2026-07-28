'use client'

import { useRef } from 'react'
import { MoreHorizontal, ExternalLink, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Email } from '@/types'
import { cn } from '@/lib/utils'
import type { SelectChangeOptions } from '@/lib/email-selection'

interface EmailListRowProps {
  email: Email
  selected: boolean
  onSelectChange: (
    emailId: string,
    selected: boolean,
    options?: SelectChangeOptions
  ) => void
  onOpen: (email: Email) => void
  onDelete: (emailId: string) => void
  onSenderClick?: (sender: string) => void
  deleting?: boolean
  showSender?: boolean
  compact?: boolean
}

export function EmailListRow({
  email,
  selected,
  onSelectChange,
  onOpen,
  onDelete,
  onSenderClick,
  deleting = false,
  showSender = true,
  compact = false,
}: EmailListRowProps) {
  const shiftKeyRef = useRef(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(email)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(email)
        }
      }}
      className={cn(
        'group flex items-center border-b text-left transition-colors hover:bg-accent/50',
        compact ? 'gap-2 px-2 py-1' : 'gap-3 px-3 py-1.5',
        selected && 'bg-accent/40'
      )}
    >
      <div
        className="flex shrink-0 items-center"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          shiftKeyRef.current = event.shiftKey
          event.stopPropagation()
        }}
        onPointerDown={(event) => {
          shiftKeyRef.current = event.shiftKey
        }}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => {
            onSelectChange(email.id, checked === true, {
              shiftKey: shiftKeyRef.current,
            })
            shiftKeyRef.current = false
          }}
          aria-label={`Select ${email.subject || 'email'}`}
        />
      </div>

      {showSender && (
        onSenderClick ? (
          <button
            type="button"
            className="w-36 shrink-0 truncate text-left text-sm font-medium text-foreground underline-offset-2 hover:underline sm:w-44"
            onClick={(event) => {
              event.stopPropagation()
              onSenderClick(email.sender || 'Unknown sender')
            }}
          >
            {email.sender || 'Unknown sender'}
          </button>
        ) : (
          <span className="w-36 shrink-0 truncate text-sm font-medium text-foreground sm:w-44">
            {email.sender || 'Unknown sender'}
          </span>
        )
      )}

      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {email.subject || '(no subject)'}
      </span>

      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {new Date(email.created_at).toLocaleDateString()}
      </span>

      <div
        className="shrink-0"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'p-0 opacity-60 group-hover:opacity-100',
                compact ? 'h-5 w-5' : 'h-6 w-6'
              )}
              aria-label="Email actions"
            >
              <MoreHorizontal className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                window.open(
                  `https://mail.google.com/mail/u/0/#inbox/${email.gmail_id}`,
                  '_blank'
                )
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View in Gmail
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(email.id)}
              disabled={deleting}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
