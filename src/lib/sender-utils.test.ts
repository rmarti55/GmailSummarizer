import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  UNKNOWN_SENDER,
  buildSenderEqOrFilter,
  escapePostgrestEqValue,
  getSenderQueryValues,
  normalizeSenderForDisplay,
  normalizeSenderStats,
  parseSenderFromHeader,
  stripRfc5322Quotes,
} from './sender-utils'

describe('stripRfc5322Quotes', () => {
  it('removes surrounding quotes', () => {
    assert.equal(stripRfc5322Quotes('"ESQUIBEL, MARCOS P."'), 'ESQUIBEL, MARCOS P.')
  })

  it('unescapes doubled quotes inside quoted strings', () => {
    assert.equal(stripRfc5322Quotes('"Say ""Hi"""'), 'Say "Hi"')
  })

  it('leaves unquoted values unchanged', () => {
    assert.equal(stripRfc5322Quotes('Amazon'), 'Amazon')
  })
})

describe('parseSenderFromHeader', () => {
  it('strips RFC5322 quotes from display names with commas', () => {
    assert.equal(
      parseSenderFromHeader('"ESQUIBEL, MARCOS P." <marcos@example.com>'),
      'ESQUIBEL, MARCOS P.'
    )
  })

  it('strips quotes from long marketing display names', () => {
    assert.equal(
      parseSenderFromHeader(
        '"Synchrony for your FREEDOM TO RIDE / SYNCHRONY HOME" <noreply@synchrony.com>'
      ),
      'Synchrony for your FREEDOM TO RIDE / SYNCHRONY HOME'
    )
  })

  it('returns email when no display name is present', () => {
    assert.equal(parseSenderFromHeader('noreply@etsy.com'), 'noreply@etsy.com')
    assert.equal(parseSenderFromHeader('<noreply@etsy.com>'), 'noreply@etsy.com')
  })

  it('maps empty headers to Unknown sender', () => {
    assert.equal(parseSenderFromHeader(''), UNKNOWN_SENDER)
    assert.equal(parseSenderFromHeader('   '), UNKNOWN_SENDER)
  })
})

describe('normalizeSenderForDisplay', () => {
  it('strips legacy quoted stored values for display', () => {
    assert.equal(
      normalizeSenderForDisplay('"ESQUIBEL, MARCOS P."'),
      'ESQUIBEL, MARCOS P.'
    )
  })

  it('maps blank values to Unknown sender', () => {
    assert.equal(normalizeSenderForDisplay(''), UNKNOWN_SENDER)
    assert.equal(normalizeSenderForDisplay('   '), UNKNOWN_SENDER)
    assert.equal(normalizeSenderForDisplay(null), UNKNOWN_SENDER)
  })
})

describe('getSenderQueryValues', () => {
  it('returns normalized and legacy quoted variants', () => {
    assert.deepEqual(getSenderQueryValues('ESQUIBEL, MARCOS P.'), [
      'ESQUIBEL, MARCOS P.',
      '"ESQUIBEL, MARCOS P."',
    ])
  })

  it('includes both empty and Unknown sender labels', () => {
    assert.deepEqual(getSenderQueryValues(UNKNOWN_SENDER), ['', UNKNOWN_SENDER])
  })

  it('deduplicates when input already includes quotes', () => {
    const values = getSenderQueryValues('"Amazon"')
    assert.deepEqual(values, ['Amazon', '"Amazon"'])
  })
})

describe('escapePostgrestEqValue', () => {
  it('wraps values in double quotes', () => {
    assert.equal(escapePostgrestEqValue('Amazon'), '"Amazon"')
  })

  it('escapes commas and internal quotes', () => {
    assert.equal(
      escapePostgrestEqValue('ESQUIBEL, MARCOS P.'),
      '"ESQUIBEL, MARCOS P."'
    )
    assert.equal(escapePostgrestEqValue('"Quoted" Name'), '"""Quoted"" Name"')
  })
})

describe('buildSenderEqOrFilter', () => {
  it('builds sender.eq clauses joined for PostgREST or()', () => {
    assert.equal(
      buildSenderEqOrFilter(['ESQUIBEL, MARCOS P.', '"ESQUIBEL, MARCOS P."']),
      'sender.eq."ESQUIBEL, MARCOS P.",sender.eq."""ESQUIBEL, MARCOS P."""'
    )
  })

  it('deduplicates identical values', () => {
    assert.equal(buildSenderEqOrFilter(['Amazon', 'Amazon']), 'sender.eq."Amazon"')
  })
})

describe('normalizeSenderStats', () => {
  it('merges quoted and unquoted legacy sender buckets', () => {
    const stats = normalizeSenderStats([
      { sender: '"Amazon"', count: 3 },
      { sender: 'Amazon', count: 5 },
    ])

    assert.equal(stats.length, 1)
    assert.equal(stats[0]?.sender, 'Amazon')
    assert.equal(stats[0]?.count, 8)
    assert.equal(stats[0]?.percentage, 100)
  })
})
