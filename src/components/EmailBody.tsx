'use client'

import { cn } from '@/lib/utils'
import { isLikelyListLine, splitEmailBodyIntoBlocks } from '@/lib/format-email-body'

interface EmailBodyProps {
  text: string
  className?: string
}

export function EmailBody({ text, className }: EmailBodyProps) {
  const blocks = splitEmailBodyIntoBlocks(text)

  if (blocks.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground italic', className)}>
        No email content available.
      </p>
    )
  }

  return (
    <div
      className={cn(
        'max-w-prose text-sm text-foreground leading-relaxed space-y-3',
        className
      )}
    >
      {blocks.map((block, index) => {
        if (isLikelyListLine(block)) {
          return (
            <p
              key={index}
              className="pl-4 border-l-2 border-muted-foreground/20"
            >
              {block}
            </p>
          )
        }

        return <p key={index}>{block}</p>
      })}
    </div>
  )
}
