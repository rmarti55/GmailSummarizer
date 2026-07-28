import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyEmailSelectionChange } from './email-selection'

const ids = ['a', 'b', 'c', 'd', 'e']

describe('applyEmailSelectionChange', () => {
  it('toggles a single row and sets the anchor', () => {
    const result = applyEmailSelectionChange(new Set(), null, ids, 'b', true)

    assert.deepEqual([...result.selectedIds], ['b'])
    assert.equal(result.anchorId, 'b')
  })

  it('selects a contiguous range when shift-clicking', () => {
    let selected = new Set<string>()
    let anchor: string | null = null

    ;({ selectedIds: selected, anchorId: anchor } = applyEmailSelectionChange(
      selected,
      anchor,
      ids,
      'a',
      true
    ))

    const result = applyEmailSelectionChange(selected, anchor, ids, 'd', true, {
      shiftKey: true,
    })

    assert.deepEqual([...result.selectedIds], ['a', 'b', 'c', 'd'])
    assert.equal(result.anchorId, 'd')
  })

  it('deselects a contiguous range when shift-clicking an unchecked row', () => {
    const selected = new Set(['a', 'b', 'c', 'd', 'e'])
    const result = applyEmailSelectionChange(selected, 'a', ids, 'c', false, {
      shiftKey: true,
    })

    assert.deepEqual([...result.selectedIds], ['d', 'e'])
    assert.equal(result.anchorId, 'c')
  })

  it('falls back to a single toggle when shift-clicking without an anchor', () => {
    const result = applyEmailSelectionChange(new Set(), null, ids, 'c', true, {
      shiftKey: true,
    })

    assert.deepEqual([...result.selectedIds], ['c'])
    assert.equal(result.anchorId, 'c')
  })
})
