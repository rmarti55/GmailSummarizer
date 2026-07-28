import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifySenderKind } from './sender-classifier'

describe('classifySenderKind', () => {
  it('classifies human names as person', () => {
    assert.equal(
      classifySenderKind({
        displayName: 'Mayowa Tomori',
        email: 'mayowa@example.com',
        domain: 'example.com',
      }),
      'person'
    )
    assert.equal(
      classifySenderKind({
        displayName: 'ESQUIBEL, MARCOS P.',
        email: 'marcos@city.gov',
        domain: 'city.gov',
      }),
      'person'
    )
  })

  it('classifies brands and automated senders as organization', () => {
    assert.equal(
      classifySenderKind({
        displayName: 'Etsy',
        email: 'noreply@mail.etsy.com',
        domain: 'mail.etsy.com',
      }),
      'organization'
    )
    assert.equal(
      classifySenderKind({
        displayName: 'noreply@yourmortgageonline.com',
      }),
      'organization'
    )
    assert.equal(
      classifySenderKind({
        displayName: 'City of Santa Fe Public Records',
        email: 'records@santafenm.gov',
        domain: 'santafenm.gov',
      }),
      'organization'
    )
    assert.equal(
      classifySenderKind({
        displayName: 'UTILITY OFFICE',
        email: 'billing@utility.example',
        domain: 'utility.example',
      }),
      'organization'
    )
  })

  it('classifies ambiguous single names as unknown', () => {
    assert.equal(
      classifySenderKind({
        displayName: 'Neon',
        email: 'hello@neon.tech',
        domain: 'neon.tech',
      }),
      'unknown'
    )
    assert.equal(
      classifySenderKind({
        displayName: 'Dan',
        email: 'dan@example.com',
        domain: 'example.com',
      }),
      'unknown'
    )
  })

  it('classifies mailing-list via suffixes as organization', () => {
    assert.equal(
      classifySenderKind({
        displayName: 'Isabel Hees (via Google Sheets)',
        email: 'isabel@example.com',
        domain: 'example.com',
      }),
      'organization'
    )
  })
})
