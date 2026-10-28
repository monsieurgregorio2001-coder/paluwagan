import { describe, expect, it } from 'vitest'
import { appendToBooks, booksFromEntries, checkBooks, emptyBooks, forgeLine, shortBy } from './books'
import { reverseEntry } from './ledger'
import { makeRng } from './rotation'
import { randomGroup } from './simulate'
import { buildSeed } from '../data/seed'
import type { Entry } from './types'

const TODAY = '2026-06-10'

describe('check the books', () => {
  it('balances on the seed data, every group, cycle by cycle', () => {
    const seed = buildSeed(TODAY)
    for (const g of seed.groups) {
      const entries = seed.ledgers[g.id]
      const check = checkBooks(entries, booksFromEntries(entries))
      expect(check.ok).toBe(true)
      expect(check.cycles.length).toBeGreaterThan(0)
      expect(check.cycles.every((c) => c.ledger === c.state && c.state === c.stubs)).toBe(true)
    }
  })

  it('balances an empty ledger', () => {
    expect(checkBooks([], emptyBooks()).ok).toBe(true)
  })

  it('appending to the books entry by entry gives the same books as the batch', () => {
    const { entries } = randomGroup(3)
    expect(entries.reduce(appendToBooks, emptyBooks())).toEqual(booksFromEntries(entries))
  })

  it('reports Short by the forged amount in the forged cycle', () => {
    const entries = buildSeed(TODAY).ledgers['demo-weekly']
    const target = entries.find((e) => e.type === 'contribution' && e.cycle === 2 && e.amount > 0)!
    const books = booksFromEntries(entries)
    const forged = forgeLine(entries, { id: target.id, patch: { amount: target.amount - 25_000 } })
    const check = checkBooks(forged, books)
    expect(check.ok).toBe(false)
    expect(check.failure!.cycle).toBe(2)
    expect(shortBy(check.failure!)).toEqual({ word: 'Short', centavos: 25_000 })
    // The real entries and books are untouched, so undo is just dropping the copy.
    expect(checkBooks(entries, books).ok).toBe(true)
    expect(entries.find((e) => e.id === target.id)!.amount).toBe(target.amount)
  })

  it('says Over when a line is forged upward', () => {
    const entries = buildSeed(TODAY).ledgers['demo-weekly']
    const t = entries.find((e) => e.type === 'contribution' && e.amount > 0)!
    const check = checkBooks(forgeLine(entries, { id: t.id, patch: { amount: t.amount + 100 } }), booksFromEntries(entries))
    expect(shortBy(check.failure!)).toEqual({ word: 'Over', centavos: 100 })
  })

  it('catches a forged reversal', () => {
    let entries = buildSeed(TODAY).ledgers['demo-weekly']
    const t = entries.find((e) => e.type === 'contribution' && e.amount > 0 && e.cycle === 4) ?? entries.filter((e) => e.type === 'contribution' && e.amount > 0).at(-1)!
    entries = reverseEntry(entries, t.id, 'Entered in error', '2026-06-10T00:00:00Z')
    const books = booksFromEntries(entries)
    const rev = entries.at(-1)!
    expect(rev.type).toBe('reversal')
    expect(checkBooks(entries, books).ok).toBe(true)
    for (const patch of [{ amount: rev.amount - 1 }, { amount: rev.amount + 1 }, { reversedType: 'payout' as const }, { reverses: 'E1' }, { cycle: rev.cycle + 1 }, { memberId: 'someone' }]) {
      expect(checkBooks(forgeLine(entries, { id: rev.id, patch }), books).ok, JSON.stringify(patch)).toBe(false)
    }
  })

  it('catches any single forged line, on random groups', () => {
    const rng = makeRng(2026)
    let forgeries = 0
    for (let seed = 1; seed <= 60; seed++) {
      const { group, entries } = randomGroup(seed)
      if (!entries.length) continue
      const books = booksFromEntries(entries)
      expect(checkBooks(entries, books).ok).toBe(true)
      for (const e of entries) {
        const other = group.members[(group.members.findIndex((m) => m.id === e.memberId) + 1) % group.members.length].id
        const patches: Partial<Entry>[] = [
          { amount: e.amount + 1 + Math.floor(rng() * 5000) },
          ...(e.amount > 0 ? [{ amount: e.amount - 1 }, { amount: 0 }] : []),
          { cycle: e.cycle + 1 },
          { memberId: other },
          { type: e.type === 'payout' ? ('contribution' as const) : ('payout' as const) },
          { shortfall: (e.shortfall ?? 0) + 100 },
          { forwarded: !e.forwarded },
          { note: (e.note ?? '') + 'x' },
          { ts: '2030-01-01T00:00:00Z' },
        ]
        for (const patch of patches) {
          forgeries++
          expect(checkBooks(forgeLine(entries, { id: e.id, patch }), books).ok, `seed ${seed} ${e.id} ${JSON.stringify(patch)}`).toBe(false)
        }
      }
    }
    expect(forgeries).toBeGreaterThan(1000)
  })

  it('catches a deleted line and an inserted line', () => {
    const entries = buildSeed(TODAY).ledgers['demo-weekly']
    const books = booksFromEntries(entries)
    expect(checkBooks(entries.slice(0, -1), books).ok).toBe(false)
    expect(checkBooks([...entries, { ...entries[0], id: 'E999', seq: 999 }], books).ok).toBe(false)
  })

  it('forging a line that does not exist throws and never changes the entries', () => {
    const entries = buildSeed(TODAY).ledgers['demo-weekly']
    const before = JSON.stringify(entries)
    expect(() => forgeLine(entries, { id: 'nope', patch: { amount: 1 } })).toThrow()
    forgeLine(entries, { id: entries[0].id, patch: { amount: 1 } })
    expect(JSON.stringify(entries)).toBe(before)
  })
})
