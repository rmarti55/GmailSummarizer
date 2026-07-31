import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  fetchWithRetry,
  getSenderExpandErrorCopy,
  shouldRetrySenderExpandResponse,
} from './sender-expand-fetch'

describe('shouldRetrySenderExpandResponse', () => {
  it('retries only 5xx', () => {
    assert.equal(shouldRetrySenderExpandResponse(500), true)
    assert.equal(shouldRetrySenderExpandResponse(503), true)
    assert.equal(shouldRetrySenderExpandResponse(401), false)
    assert.equal(shouldRetrySenderExpandResponse(404), false)
    assert.equal(shouldRetrySenderExpandResponse(200), false)
  })
})

describe('getSenderExpandErrorCopy', () => {
  it('distinguishes network from mismatch', () => {
    assert.equal(getSenderExpandErrorCopy('network').title, 'Connection failed')
    assert.equal(getSenderExpandErrorCopy('mismatch').title, 'Could not load emails')
    assert.notEqual(
      getSenderExpandErrorCopy('network').description,
      getSenderExpandErrorCopy('mismatch').description
    )
  })
})

describe('fetchWithRetry', () => {
  it('retries thrown fetch then succeeds', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      if (calls < 3) throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    const sleeps: number[] = []

    const response = await fetchWithRetry('/api/test', undefined, {
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })

    assert.equal(calls, 3)
    assert.deepEqual(sleeps, [300, 800])
    assert.equal(response.status, 200)
  })

  it('retries 5xx then returns final response', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return new Response('fail', { status: calls < 3 ? 503 : 200 })
    }

    const response = await fetchWithRetry('/api/test', undefined, {
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {},
    })

    assert.equal(calls, 3)
    assert.equal(response.status, 200)
  })

  it('does not retry 401', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return new Response('unauthorized', { status: 401 })
    }

    const response = await fetchWithRetry('/api/test', undefined, {
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {
        assert.fail('should not sleep for 4xx')
      },
    })

    assert.equal(calls, 1)
    assert.equal(response.status, 401)
  })

  it('rethrows after exhausting network retries', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }

    await assert.rejects(
      () =>
        fetchWithRetry('/api/test', undefined, {
          fetchImpl: fetchImpl as typeof fetch,
          sleep: async () => {},
          maxAttempts: 3,
        }),
      (error: unknown) => error instanceof TypeError && error.message === 'Failed to fetch'
    )
  })
})
