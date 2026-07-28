const SUMMARIZE_CONCURRENCY = 3

type OnComplete = (emailId: string, summary: string) => void
type OnError = (emailId: string, error: unknown) => void

export function formatSummarizeError(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error?: unknown }).error
    if (typeof message === 'string' && message.length > 0) return message
  }
  return 'Failed to generate summary'
}

export class SummarizeQueue {
  private queue: string[] = []
  private active = 0
  private inFlight = new Set<string>()
  private queued = new Set<string>()
  private readonly concurrency = SUMMARIZE_CONCURRENCY
  private onComplete?: OnComplete
  private onError?: OnError
  private onStatusChange?: () => void

  constructor(options?: {
    onComplete?: OnComplete
    onError?: OnError
    onStatusChange?: () => void
  }) {
    this.onComplete = options?.onComplete
    this.onError = options?.onError
    this.onStatusChange = options?.onStatusChange
  }

  getSummarizingIds(): Set<string> {
    return new Set([...this.queued, ...this.inFlight])
  }

  enqueue(emailIds: string[]) {
    for (const id of emailIds) {
      if (this.queued.has(id) || this.inFlight.has(id)) continue
      this.queued.add(id)
      this.queue.push(id)
    }
    this.notifyStatus()
    this.process()
  }

  private notifyStatus() {
    this.onStatusChange?.()
  }

  private process() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const id = this.queue.shift()
      if (!id) break

      this.queued.delete(id)
      this.inFlight.add(id)
      this.active++
      this.notifyStatus()

      void this.runOne(id).finally(() => {
        this.inFlight.delete(id)
        this.active--
        this.notifyStatus()
        this.process()
      })
    }
  }

  private async runOne(emailId: string) {
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.summary) {
          this.onComplete?.(emailId, data.summary)
          return
        }
      }

      const errorBody = await response.json().catch(() => ({}))
      const message = formatSummarizeError(errorBody)
      console.error(`Summarize failed for ${emailId}: ${message}`, errorBody)
      this.onError?.(emailId, message)
    } catch (error) {
      const message = formatSummarizeError(error)
      console.error(`Summarize failed for ${emailId}: ${message}`, error)
      this.onError?.(emailId, message)
    }
  }
}
