import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveSyncCta, shouldHydrateSyncProgress } from './sync-cta'

describe('resolveSyncCta', () => {
  it('disables only while running', () => {
    assert.equal(resolveSyncCta({ isRunning: true }), 'syncing')
  })

  it('shows Sync Complete only for local justCompleted flash', () => {
    assert.equal(
      resolveSyncCta({ isRunning: false, justCompleted: true, status: 'completed' }),
      'complete'
    )
  })

  it('does not lock CTA for durable completed status alone', () => {
    assert.equal(
      resolveSyncCta({ isRunning: false, status: 'completed', justCompleted: false }),
      'idle'
    )
  })

  it('shows retry for failed jobs', () => {
    assert.equal(
      resolveSyncCta({ isRunning: false, status: 'failed', error: 'boom' }),
      'retry'
    )
    assert.equal(
      resolveSyncCta({ isRunning: false, error: 'network' }),
      'retry'
    )
  })

  it('defaults to idle CTA', () => {
    assert.equal(resolveSyncCta({ isRunning: false }), 'idle')
    assert.equal(resolveSyncCta({ isRunning: false, status: 'idle' }), 'idle')
  })
})

describe('shouldHydrateSyncProgress', () => {
  it('resumes only running jobs', () => {
    assert.equal(shouldHydrateSyncProgress({ isRunning: true }), 'resume')
  })

  it('keeps failed for Retry UI', () => {
    assert.equal(
      shouldHydrateSyncProgress({ isRunning: false, status: 'failed' }),
      'failed'
    )
    assert.equal(
      shouldHydrateSyncProgress({ isRunning: false, error: 'nope' }),
      'failed'
    )
  })

  it('ignores completed so reload cannot re-lock CTA', () => {
    assert.equal(
      shouldHydrateSyncProgress({ isRunning: false, status: 'completed' }),
      'ignore'
    )
    assert.equal(
      shouldHydrateSyncProgress({ isRunning: false, status: 'idle' }),
      'ignore'
    )
  })
})
