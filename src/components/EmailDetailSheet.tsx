'use client'

import { useEffect, useRef } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmailSummaryBlock } from '@/components/EmailSummaryBlock'
import { EmailBody } from '@/components/EmailBody'
import { Email } from '@/types'

interface EmailDetailSheetProps {
  email: Email | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSummarizing: boolean
  onRequestSummary: (emailId: string) => void
  onDelete: (emailId: string) => void
  deleting?: boolean
}

export function EmailDetailSheet({
  email,
  open,
  onOpenChange,
  isSummarizing,
  onRequestSummary,
  onDelete,
  deleting = false,
}: EmailDetailSheetProps) {
  const requestedForId = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !email) {
      if (!open) requestedForId.current = null
      return
    }
    if (email.summary) return
    if (requestedForId.current === email.id || isSummarizing) return
    requestedForId.current = email.id
    onRequestSummary(email.id)
  }, [open, email, isSummarizing, onRequestSummary])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
        aria-describedby={undefined}
      >
        {email && (
          <>
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <Badge variant="secondary" className="text-xs">
                  {new Date(email.created_at).toLocaleDateString()}
                </Badge>
                <span className="text-sm text-muted-foreground truncate">
                  {email.sender || 'Unknown sender'}
                </span>
              </div>
              <SheetTitle className="text-left leading-snug">
                {email.subject || '(no subject)'}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-2 space-y-5 px-4 pb-6">
              <EmailSummaryBlock email={email} isSummarizing={isSummarizing} />

              <EmailBody text={email.body_preview} />

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() =>
                    window.open(
                      `https://mail.google.com/mail/u/0/#inbox/${email.gmail_id}`,
                      '_blank'
                    )
                  }
                  variant="outline"
                  size="sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View in Gmail
                </Button>
                <Button
                  onClick={() => onDelete(email.id)}
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
