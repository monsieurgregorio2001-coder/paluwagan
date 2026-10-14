import { describe, expect, it } from 'vitest'
import {
  LedgerError, activePayout, effectiveContribution, reconciles, recordContribution, recordPayout, reverseEntry, summarize,
} from './ledger'
import { addDays } from './dates'
import { makeRng } from './rotation'
import type { Entry } from './types'

const T = '2026-01-01T00:00:00Z'
const base = { cycle: 1, memberId: 'a', dueDate: '2026-01-05' }

describe('ledger basics', () => {
  it('records on time, late and missed contributions', () => {
    let e: Entry[] = []
    e = recordContribution(e, { ...base, status: 'on_time', amount: 100000 }, T)
    e = recordContribution(e, { ...base, memberId: 'b', status: 'late', amount: 100000, paidDate: '2026-01-09' }, T)
    e = recordContribution(e, { ...base, memberId: 'c', status: 'missed', amount: 0 }, T)
    expect(e.map((x) => x.status)).toEqual(['on_time', 'late', 'missed'])
    expect(e[1].daysLate).toBe(4)
    expect(summarize(e)).toEqual({ contributions: 200000, payouts: 0, potBalance: 200000 })
  })

  it('requires a late payment to be after the due date', () => {
    expect(() => recordContribution([], { ...base, status: 'late', amount: 100, paidDate: '2026-01-05' }, T)).toThrow(LedgerError)
    expect(() => recordContribution([], { ...base, status: 'late', amount: 100 }, T)).toThrow(LedgerError)
  })

  it('rejects non-integer, zero and duplicate amounts', () => {
    expect(() => recordContribution([], { ...base, status: 'on_time', amount: 10.5 }, T)).toThrow(LedgerError)
    expect(() => recordContribution([], { ...base, status: 'on_time', amount: 0 }, T)).toThrow(LedgerError)
    const e = recordContribution([], { ...base, status: 'on_time', amount: 100 }, T)
    expect(() => recordContribution(e, { ...base, status: 'on_time', amount: 100 }, T)).toThrow(LedgerError)
  })

  it('allows a late payment after a missed entry, and the latest active entry wins', () => {
    let e = recordContribution([], { ...base, status: 'missed', amount: 0 }, T)
    e = recordContribution(e, { ...base, status: 'late', amount: 500, paidDate: '2026-01-20' }, T)
    expect(effectiveContribution(e, 'a', 1)?.status).toBe('late')
  })

  it('corrects mistakes with reversing entries and never edits the original', () => {
    let e = recordContribution([], { ...base, status: 'on_time', amount: 100000 }, T)
    const before = JSON.parse(JSON.stringify(e))
    e = reverseEntry(e, 'E1', 'Wrong member', T)
    expect(e.slice(0, 1)).toEqual(before)
    expect(e[1]).toMatchObject({ type: 'reversal', reverses: 'E1', amount: 100000, reversedType: 'contribution' })
    expect(summarize(e).potBalance).toBe(0)
    expect(effectiveContribution(e, 'a', 1)).toBeUndefined()
    e = recordContribution(e, { ...base, status: 'on_time', amount: 100000 }, T)
    expect(summarize(e).potBalance).toBe(100000)
  })

  it('refuses double reversal, reversing a reversal and missing reasons', () => {
    let e = recordContribution([], { ...base, status: 'on_time', amount: 100 }, T)
    expect(() => reverseEntry(e, 'E1', '', T)).toThrow(LedgerError)
    e = reverseEntry(e, 'E1', 'oops', T)
    expect(() => reverseEntry(e, 'E1', 'again', T)).toThrow(LedgerError)
    expect(() => reverseEntry(e, 'E2', 'undo', T)).toThrow(LedgerError)
    expect(() => reverseEntry(e, 'E99', 'x', T)).toThrow(LedgerError)
  })

  it('blocks payouts above the pot and reversals that would overdraw it', () => {
    let e = recordContribution([], { ...base, status: 'on_time', amount: 1000 }, T)
    expect(() => recordPayout(e, { cycle: 1, memberId: 'a', amount: 1001 }, T)).toThrow(LedgerError)
    e = recordPayout(e, { cycle: 1, memberId: 'a', amount: 1000 }, T)
    expect(activePayout(e, 1)?.id).toBe('E2')
    expect(() => reverseEntry(e, 'E1', 'x', T)).toThrow(LedgerError)
    e = reverseEntry(e, 'E2', 'payout was wrong', T)
    expect(summarize(e).potBalance).toBe(1000)
    e = reverseEntry(e, 'E1', 'payment was wrong', T)
    expect(summarize(e)).toEqual({ contributions: 0, payouts: 0, potBalance: 0 })
  })
})

describe('ledger property tests', () => {
  it('always reconciles, never goes negative, and is append-only under random operations', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = makeRng(seed)
      const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)]
      const members = ['a', 'b', 'c', 'd', 'e']
      let entries: Entry[] = []
      for (let step = 0; step < 300; step++) {
        const prev = entries
        const roll = rng()
        const cycle = 1 + Math.floor(rng() * 5)
        const due = addDays('2026-01-01', cycle * 7)
        try {
          if (roll < 0.5) {
            const status = pick(['on_time', 'late', 'missed'] as const)
            const amount = (1 + Math.floor(rng() * 5000)) * 100 + Math.floor(rng() * 100)
            entries = recordContribution(entries, {
              cycle, memberId: pick(members), status, amount, dueDate: due, paidDate: status === 'late' ? addDays(due, 1 + Math.floor(rng() * 20)) : undefined,
            }, T)
          } else if (roll < 0.7) {
            entries = recordPayout(entries, { cycle, memberId: pick(members), amount: 1 + Math.floor(rng() * 300000) }, T)
          } else if (entries.length) {
            entries = reverseEntry(entries, pick(entries).id, 'random correction', T)
          }
        } catch (e) {
          expect(e).toBeInstanceOf(LedgerError)
          expect(entries).toBe(prev)
        }
        const s = summarize(entries)
        expect(reconciles(entries)).toBe(true)
        expect(s.contributions).toBe(s.payouts + s.potBalance)
        expect(s.potBalance).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(s.potBalance)).toBe(true)
        // Append-only: earlier entries are untouched.
        expect(entries.slice(0, prev.length)).toEqual(prev)
        expect(entries.length).toBeGreaterThanOrEqual(prev.length)
      }
      expect(entries.length).toBeGreaterThan(40)
      expect(entries.some((e) => e.type === 'reversal')).toBe(true)
      // Sequence numbers and ids are contiguous.
      entries.forEach((e, i) => {
        expect(e.seq).toBe(i + 1)
        expect(e.id).toBe(`E${i + 1}`)
      })
    }
  })

  it('reversing every active entry newest first returns the pot to zero', () => {
    const rng = makeRng(99)
    let entries: Entry[] = []
    for (let i = 0; i < 60; i++) {
      try {
        entries = recordContribution(entries, {
          cycle: 1 + (i % 6), memberId: `m${i}`, status: 'on_time', amount: 100 + Math.floor(rng() * 99999), dueDate: '2026-01-05',
        }, T)
        if (i % 7 === 6) entries = recordPayout(entries, { cycle: 1 + (i % 6), memberId: 'x', amount: Math.max(1, Math.floor(summarize(entries).potBalance / 2)) }, T)
      } catch { /* duplicate payout for a cycle is fine */ }
    }
    const originals = entries.filter((e) => e.type !== 'reversal')
    for (const e of [...originals].reverse()) entries = reverseEntry(entries, e.id, 'unwind', T)
    expect(summarize(entries)).toEqual({ contributions: 0, payouts: 0, potBalance: 0 })
  })
})
