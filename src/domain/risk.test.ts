import { describe, expect, it } from 'vitest'
import { assessRisk, buildHistory, type CycleRecord } from './risk'
import { buildSchedule } from './rotation'
import { recordContribution } from './ledger'
import type { Entry } from './types'

const rec = (...s: (string | number)[]): CycleRecord[] =>
  s.map((x, i) => {
    if (x === 'o') return { cycle: i + 1, status: 'on_time', daysLate: 0 }
    if (x === 'm') return { cycle: i + 1, status: 'missed', daysLate: 0 }
    if (typeof x === 'string' && x.startsWith('od')) return { cycle: i + 1, status: 'overdue', daysLate: Number(x.slice(2)) }
    return { cycle: i + 1, status: 'late', daysLate: x as number }
  })

describe('risk rules', () => {
  const cases: [string, CycleRecord[], string][] = [
    ['no history', [], 'Low'],
    ['always on time', rec('o', 'o', 'o', 'o'), 'Low'],
    ['one short late payment', rec('o', 'o', 'o', 2), 'Low'],
    ['two late payments', rec('o', 3, 'o', 2), 'Medium'],
    ['one long delay', rec('o', 'o', 'o', 9), 'Medium'],
    ['one missed', rec('o', 'o', 'm', 'o'), 'Medium'],
    ['overdue by 2 days', rec('o', 'o', 'o', 'od2'), 'Medium'],
    ['overdue by 7 days', rec('o', 'o', 'o', 'od7'), 'High'],
    ['missed plus late', rec('o', 'm', 4, 'o'), 'High'],
    ['two missed', rec('m', 'm', 'o', 'o'), 'High'],
    ['three late', rec('o', 2, 2, 2), 'High'],
  ]
  it.each(cases)('%s -> %s', (_n, history, level) => {
    expect(assessRisk(history).level).toBe(level)
  })

  it('only looks at the last 4 cycles', () => {
    expect(assessRisk(rec('m', 'm', 'm', 'o', 'o', 'o', 'o')).level).toBe('Low')
  })

  it('explains itself with reasons', () => {
    expect(assessRisk(rec('o', 3, 'o', 2)).reasons).toContain('2 late payments in last 4 cycles')
    expect(assessRisk(rec('o', 'o', 'm', 'o')).reasons).toContain('1 missed cycle in last 4 cycles')
    expect(assessRisk(rec('o', 'o', 'o', 'od5')).reasons).toContain('Current cycle is 5 days overdue')
    expect(assessRisk(rec('o', 'o', 'o', 'o')).reasons).toEqual(['Paid on time in all 4 recorded cycles'])
    expect(assessRisk([]).reasons).toEqual(['No payment history yet'])
  })

  it('builds history from the ledger', () => {
    const members = ['a', 'b'].map((id) => ({ id, name: id }))
    const schedule = buildSchedule({ members, startDate: '2026-03-01', frequency: 'weekly' })
    let e: Entry[] = []
    e = recordContribution(e, { cycle: 1, memberId: 'a', status: 'late', amount: 100, dueDate: '2026-03-01', paidDate: '2026-03-04' }, 't')
    // Today is in cycle 2, 3 days after its due date. Member a has not paid cycle 2. Member b paid nothing.
    const a = buildHistory(schedule, e, 'a', '2026-03-11')
    expect(a).toEqual([
      { cycle: 1, status: 'late', daysLate: 3 },
      { cycle: 2, status: 'overdue', daysLate: 3 },
    ])
    const b = buildHistory(schedule, e, 'b', '2026-03-11')
    expect(b[0]).toEqual({ cycle: 1, status: 'missed', daysLate: 0 })
    expect(buildHistory(schedule, e, 'a', '2026-02-01')).toEqual([])
  })
})
