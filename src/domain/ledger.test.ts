import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LedgerError, activePayout, arrearsItems, arrearsOutstanding, cycleOutstanding, cycleShortfall, effectiveContribution, memberArrears, reconciles, recordArrearsPayment, recordContribution, recordPayout, reverseEntry, summarize,
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
    let arrearsEntries = 0
    let operations = 0
    for (let seed = 1; seed <= 40; seed++) {
      const rng = makeRng(seed)
      const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)]
      const members = ['a', 'b', 'c', 'd', 'e']
      let entries: Entry[] = []
      for (let step = 0; step < 300; step++) {
        operations++
        const prev = entries
        const roll = rng()
        const cycle = 1 + Math.floor(rng() * 5)
        const due = addDays('2026-01-01', cycle * 7)
        try {
          if (roll < 0.4) {
            const status = pick(['on_time', 'late', 'missed'] as const)
            const amount = (1 + Math.floor(rng() * 5000)) * 100 + Math.floor(rng() * 100)
            entries = recordContribution(entries, {
              cycle, memberId: pick(members), status, amount, expected: 500000, dueDate: due, paidDate: status === 'late' ? addDays(due, 1 + Math.floor(rng() * 20)) : undefined,
            }, T)
          } else if (roll < 0.55) {
            const open = arrearsItems(entries).filter((i) => i.outstanding > 0)
            const target = open.length ? pick(open) : { memberId: pick(members), cycle, outstanding: 1 }
            const amount = rng() < 0.3 ? target.outstanding + 1 : 1 + Math.floor(rng() * target.outstanding)
            entries = recordArrearsPayment(entries, { cycle: target.cycle, memberId: target.memberId, amount }, T)
          } else if (roll < 0.72) {
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
        // Arrears are whole centavos, never negative, and settled never exceeds owed.
        for (const a of arrearsItems(entries)) {
          expect(Number.isInteger(a.outstanding)).toBe(true)
          expect(a.outstanding).toBeGreaterThanOrEqual(0)
          expect(a.settled).toBeLessThanOrEqual(a.owed)
        }
        // Append-only: earlier entries are untouched.
        expect(entries.slice(0, prev.length)).toEqual(prev)
        expect(entries.length).toBeGreaterThanOrEqual(prev.length)
      }
      expect(entries.length).toBeGreaterThan(40)
      expect(entries.some((e) => e.type === 'reversal')).toBe(true)
      arrearsEntries += entries.filter((e) => e.type === 'arrears').length
      // Sequence numbers and ids are contiguous.
      entries.forEach((e, i) => {
        expect(e.seq).toBe(i + 1)
        expect(e.id).toBe(`E${i + 1}`)
      })
    }
    expect(arrearsEntries).toBeGreaterThan(100)
    // Evidence: CI reads the executed operation count from here, so the figure is measured, not typed.
    if (process.env.EVIDENCE_OPS_FILE) writeFileSync(process.env.EVIDENCE_OPS_FILE, JSON.stringify({ operations }))
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

describe('arrears', () => {
  const due = 500000
  const miss = (e: Entry[], memberId = 'a', cycle = 1) =>
    recordContribution(e, { cycle, memberId, status: 'missed', amount: 0, expected: due, dueDate: '2026-01-05' }, T)
  const pay = (e: Entry[], memberId = 'b', cycle = 1) =>
    recordContribution(e, { cycle, memberId, status: 'on_time', amount: due, expected: due, dueDate: '2026-01-05' }, T)

  it('turns a missed contribution into arrears for that member', () => {
    const e = miss(pay([]))
    expect(arrearsItems(e)).toEqual([{ memberId: 'a', cycle: 1, owed: due, settled: 0, outstanding: due }])
    expect(memberArrears(e, 'a')).toBe(due)
    expect(memberArrears(e, 'b')).toBe(0)
    expect(cycleShortfall(e, 1)).toBe(due)
  })

  it('turns an underpayment into arrears for the difference', () => {
    const e = recordContribution([], { ...base, status: 'on_time', amount: 320000, expected: due }, T)
    expect(arrearsOutstanding(e, 'a', 1)).toBe(180000)
  })

  it('settles arrears with an append-only entry that keeps the ledger reconciled', () => {
    let e = miss(pay([]))
    const before = JSON.parse(JSON.stringify(e))
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 200000 }, T)
    expect(e.slice(0, before.length)).toEqual(before)
    expect(e[e.length - 1]).toMatchObject({ type: 'arrears', amount: 200000, forwarded: false })
    expect(arrearsOutstanding(e, 'a', 1)).toBe(300000)
    expect(summarize(e)).toEqual({ contributions: 700000, payouts: 0, potBalance: 700000 })
    expect(reconciles(e)).toBe(true)
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 300000 }, T)
    expect(arrearsOutstanding(e, 'a', 1)).toBe(0)
    expect(reconciles(e)).toBe(true)
  })

  it('passes the money to the recipient when the cycle payout was already short', () => {
    let e = miss(pay([]))
    e = recordPayout(e, { cycle: 1, memberId: 'r', amount: due }, T)
    expect(summarize(e).potBalance).toBe(0)
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: due }, T)
    expect(e[e.length - 1].forwarded).toBe(true)
    expect(summarize(e)).toEqual({ contributions: 2 * due, payouts: 2 * due, potBalance: 0 })
    expect(reconciles(e)).toBe(true)
  })

  it('never lets arrears go negative', () => {
    let e = miss([])
    expect(() => recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: due + 1 }, T)).toThrow(LedgerError)
    expect(() => recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 0 }, T)).toThrow(LedgerError)
    expect(() => recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 10.5 }, T)).toThrow(LedgerError)
    expect(() => recordArrearsPayment(e, { cycle: 1, memberId: 'b', amount: 100 }, T)).toThrow(LedgerError)
    expect(() => recordArrearsPayment(e, { cycle: 2, memberId: 'a', amount: 100 }, T)).toThrow(LedgerError)
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: due }, T)
    expect(() => recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 1 }, T)).toThrow(LedgerError)
  })

  it('blocks a reversal that would strand an arrears payment', () => {
    let e = miss([])
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 100000 }, T)
    expect(() => reverseEntry(e, 'E1', 'wrong', T)).toThrow(LedgerError)
    e = reverseEntry(e, 'E2', 'wrong amount', T)
    expect(arrearsOutstanding(e, 'a', 1)).toBe(due)
    expect(reconciles(e)).toBe(true)
    e = reverseEntry(e, 'E1', 'recorded by mistake', T)
    expect(arrearsItems(e)).toEqual([])
  })

  it('does not let a later payment push settled arrears above what is owed', () => {
    let e = miss([])
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 100000 }, T)
    expect(() => recordContribution(e, { cycle: 1, memberId: 'a', status: 'late', amount: due, expected: due, dueDate: '2026-01-05', paidDate: '2026-01-09' }, T)).toThrow(LedgerError)
  })

  it('reverses a forwarded arrears payment symmetrically', () => {
    let e = miss(pay([]))
    e = recordPayout(e, { cycle: 1, memberId: 'r', amount: due }, T)
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: due }, T)
    const s = summarize(e)
    e = reverseEntry(e, 'E4', 'paid by mistake', T)
    expect(summarize(e)).toEqual({ contributions: s.contributions - due, payouts: s.payouts - due, potBalance: s.potBalance })
    expect(arrearsOutstanding(e, 'a', 1)).toBe(due)
    expect(reconciles(e)).toBe(true)
  })
})

describe('cycleOutstanding', () => {
  it('quotes the full contribution when nothing is recorded', () => {
    expect(cycleOutstanding([], 'a', 1, 100000)).toBe(100000)
  })

  it('quotes the remainder after an underpayment and after arrears payments', () => {
    let e: Entry[] = recordContribution([], { ...base, status: 'on_time', amount: 60000, expected: 100000 }, T)
    expect(cycleOutstanding(e, 'a', 1, 100000)).toBe(40000)
    e = recordArrearsPayment(e, { cycle: 1, memberId: 'a', amount: 15000 }, T)
    expect(cycleOutstanding(e, 'a', 1, 100000)).toBe(25000)
  })

  it('is zero when paid in full', () => {
    const e = recordContribution([], { ...base, status: 'on_time', amount: 100000, expected: 100000 }, T)
    expect(cycleOutstanding(e, 'a', 1, 100000)).toBe(0)
  })
})
