'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SummarizeQueue } from '@/lib/client-summarize'
import { Email } from '@/types'

export function useSummarizeQueue(
  onComplete: (emailId: string, summary: string) => void
) {
  const [summarizingIds, setSummarizingIds] = useState<Set<string>>(new Set())
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const queueRef = useRef<SummarizeQueue | null>(null)

  useEffect(() => {
    const queue = new SummarizeQueue({
      onComplete: (emailId, summary) => {
        onCompleteRef.current(emailId, summary)
      },
      onError: (emailId, error) => {
        console.error(`Summarize failed for ${emailId}:`, error)
      },
      onStatusChange: () => {
        setSummarizingIds(queue.getSummarizingIds())
      },
    })
    queueRef.current = queue
    return () => {
      queueRef.current = null
    }
  }, [])

  const enqueueMissingSummaries = useCallback((emails: Email[]) => {
    const ids = emails.filter((email) => !email.summary).map((email) => email.id)
    if (ids.length === 0) return
    queueRef.current?.enqueue(ids)
  }, [])

  const isSummarizing = useCallback(
    (emailId: string) => summarizingIds.has(emailId),
    [summarizingIds]
  )

  return { enqueueMissingSummaries, isSummarizing }
}
