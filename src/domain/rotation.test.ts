import { describe, expect, it } from 'vitest'
import { addMonths, diffDays, formatDate, todayManila } from './dates'
import { buildSchedule, currentCycle, cycleDueDate, makeRng, recipientForCycle, shuffleWithSeed } from './rotation'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i + 1}`)

describe('rotation', () => {
  it('is deterministic for a given seed and differs across seeds', () => {
    const a = shuffleWithSeed(ids(10), 'kapitbahay')
    const b = shuffleWithSeed(ids(10), 'kapitbahay')
    expect(a).toEqual(b)
    const others = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => shuffleWithSeed(ids(10), s).join())
    expect(new Set(others).size).toBeGreaterThan(1)
  })

  it('does not mutate its input and keeps every member', () => {
    const input = ids(8)
    const copy = [...input]
    const out = shuffleWithSeed(input, 'x')
    expect(input).toEqual(copy)
    expect([...out].sort()).toEqual([...input].sort())
  })

  it('pays every member exactly once per round, for many sizes, seeds and rounds', () => {
    for (let n = 2; n <= 24; n++) {
      for (const seed of ['s1', 's2', 'seed-' + n]) {
        const order = shuffleWithSeed(ids(n), seed)
        for (let round = 0; round < 3; round++) {
          const paid = Array.from({ length: n }, (_, c) => recipientForCycle(order, round * n + c))
          expect(new Set(paid).size).toBe(n)
          expect([...paid].sort()).toEqual([...order].sort())
        }
      }
    }
  })

  it('shuffle is roughly fair across seeds (every position is reachable)', () => {
    const first = new Set<string>()
    for (let i = 0; i < 200; i++) first.add(shuffleWithSeed(ids(5), `seed-${i}`)[0])
    expect(first.size).toBe(5)
  })

  it('rng returns values in [0, 1)', () => {
    const r = makeRng('abc')
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('computes due dates for each frequency', () => {
    expect(cycleDueDate('2026-01-05', 'weekly', 2)).toBe('2026-01-19')
    expect(cycleDueDate('2026-01-05', 'biweekly', 2)).toBe('2026-02-02')
    expect(cycleDueDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28')
    expect(cycleDueDate('2026-01-31', 'monthly', 2)).toBe('2026-03-31')
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28')
    expect(diffDays('2026-02-27', '2026-03-02')).toBe(3)
  })

  it('builds a schedule and finds the current cycle', () => {
    const members = ids(4).map((id) => ({ id, name: id }))
    const s = buildSchedule({ members, startDate: '2026-03-01', frequency: 'weekly' })
    expect(s.map((r) => r.dueDate)).toEqual(['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22'])
    expect(currentCycle(s, '2026-02-20')).toEqual({ cycle: 1, started: false })
    expect(currentCycle(s, '2026-03-09')).toEqual({ cycle: 2, started: true })
    expect(currentCycle(s, '2027-01-01')).toEqual({ cycle: 4, started: true })
  })

  it('formats dates in Asia/Manila', () => {
    expect(formatDate('2026-03-01')).toBe('Mar 1, 2026')
    expect(todayManila(new Date('2026-03-01T17:00:00Z'))).toBe('2026-03-02')
  })
})
