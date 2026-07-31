import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { singleFlight } from './single-flight'

describe('singleFlight', () => {
  it('runs fn once when called concurrently with the same key', async () => {
    const store = new Map<string, Promise<string>>()
    let runs = 0

    const fn = async () => {
      runs += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      return 'ok'
    }

    const [a, b, c] = await Promise.all([
      singleFlight('user-1', store, fn),
      singleFlight('user-1', store, fn),
      singleFlight('user-1', store, fn),
    ])

    assert.equal(runs, 1)
    assert.equal(a, 'ok')
    assert.equal(b, 'ok')
    assert.equal(c, 'ok')
    assert.equal(store.size, 0)
  })

  it('runs separately for different keys', async () => {
    const store = new Map<string, Promise<number>>()
    let runs = 0

    const fn = async () => {
      runs += 1
      return runs
    }

    const [a, b] = await Promise.all([
      singleFlight('user-a', store, fn),
      singleFlight('user-b', store, fn),
    ])

    assert.equal(runs, 2)
    assert.equal(a, 1)
    assert.equal(b, 2)
    assert.equal(store.size, 0)
  })

  it('clears the store entry after rejection', async () => {
    const rejectStore = new Map<string, Promise<string>>()
    const err = new Error('refresh failed')

    await assert.rejects(
      () =>
        singleFlight('user-1', rejectStore, async () => {
          throw err
        }),
      err
    )

    assert.equal(rejectStore.size, 0)

    const retryStore = new Map<string, Promise<string>>()
    let runs = 0
    const result = await singleFlight('user-1', retryStore, async () => {
      runs += 1
      return 'retry-ok'
    })

    assert.equal(runs, 1)
    assert.equal(result, 'retry-ok')
  })
})
