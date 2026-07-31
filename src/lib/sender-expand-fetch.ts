export type SenderExpandErrorKind = 'network' | 'http' | 'mismatch'

export interface SenderExpandErrorCopy {
  title: string
  description: string
}

const DEFAULT_DELAYS_MS = [300, 800]

export function getSenderExpandErrorCopy(kind: SenderExpandErrorKind): SenderExpandErrorCopy {
  switch (kind) {
    case 'network':
      return {
        title: 'Connection failed',
        description: 'Check your connection and try again.',
      }
    case 'http':
      return {
        title: 'Could not load emails',
        description: 'Something went wrong. Try again.',
      }
    case 'mismatch':
      return {
        title: 'Could not load emails',
        description: 'Try again. If this keeps happening, refresh the page.',
      }
  }
}

export function shouldRetrySenderExpandResponse(status: number): boolean {
  return status >= 500 && status <= 599
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    maxAttempts?: number
    delaysMs?: number[]
    fetchImpl?: typeof fetch
    sleep?: (ms: number) => Promise<void>
  }
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? 3
  const delaysMs = options?.delaysMs ?? DEFAULT_DELAYS_MS
  const fetchImpl = options?.fetchImpl ?? fetch
  const sleep =
    options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))

  let lastError: unknown
  let lastResponse: Response | undefined

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetchImpl(input, init)
      if (!shouldRetrySenderExpandResponse(response.status) || attempt === maxAttempts - 1) {
        return response
      }
      lastResponse = response
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts - 1) {
        throw error
      }
    }

    const delay = delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 800
    await sleep(delay)
  }

  if (lastResponse) return lastResponse
  throw lastError ?? new Error('fetchWithRetry failed without response')
}
