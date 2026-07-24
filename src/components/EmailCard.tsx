'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Trash2 } from 'lucide-react'
import { EmailSummaryBlock } from '@/components/EmailSummaryBlock'
import { EmailBody } from '@/components/EmailBody'
import { Email } from '@/types'
import { cn } from '@/lib/utils'

interface EmailCardProps {
  email: Email
  isSummarizing: boolean
  onExpand?: (emailId: string) => void
  onDelete?: (emailId: string) => void
  deletingId?: string | null
  compact?: boolean
  showSender?: boolean
  className?: string
}

export function EmailCard({
  email,
  isSummarizing,
  onExpand,
  onDelete,
  deletingId,
  compact = false,
  showSender = true,
  className,
}: EmailCardProps) {
  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open) {
      onExpand?.(email.id)
    }
  }

  return (
    <Card className={cn('hover:shadow-md transition-shadow gap-0', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            {showSender && (
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-foreground">{email.sender}</p>
                <Badge variant="secondary" className="text-xs">
                  {new Date(email.created_at).toLocaleDateString()}
                </Badge>
              </div>
            )}
            {!showSender && (
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  {new Date(email.created_at).toLocaleDateString()}
                </Badge>
              </div>
            )}
            <CardTitle className="text-base leading-6">{email.subject}</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <details className="group" onToggle={handleToggle}>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center">
            <span>Read email</span>
            <svg
              className="w-4 h-4 ml-1 transform group-open:rotate-90 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </summary>

          <div className="mt-4 space-y-4">
            <EmailSummaryBlock
              email={email}
              isSummarizing={isSummarizing}
              compact={compact}
            />

            <div className="rounded-lg border bg-muted/50 p-4">
              <EmailBody text={email.body_preview} />
            </div>
          </div>
        </details>

        <div className="flex items-center gap-2">
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
          {onDelete && (
            <Button
              onClick={() => onDelete(email.id)}
              variant="outline"
              size="sm"
              disabled={deletingId === email.id}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deletingId === email.id ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
