import { describe, expect, it } from 'vitest'
import { buildSeed } from './seed'
import { arrearsItems, cycleShortfall, memberArrears, reconciles, summarize, activePayout } from '../domain/ledger'
import { buildHistory, assessRisk } from '../domain/risk'
import { buildSchedule, currentCycle, shuffleWithSeed } from '../domain/rotation'

describe('seed data', () => {
  const today = '2026-06-15'
  const s = buildSeed(today)

  it('has two mid-round groups with the expected shape', () => {
    expect(s.groups.map((g) => [g.members.length, g.frequency, g.contributionCentavos])).toEqual([
      [6, 'weekly', 100000],
      [10, 'monthly', 500000],
    ])
    expect(currentCycle(buildSchedule(s.groups[0]), today).cycle).toBe(4)
    expect(currentCycle(buildSchedule(s.groups[1]), today).cycle).toBe(5)
  })

  it('reconciles and has no negative pot', () => {
    for (const g of s.groups) {
      expect(reconciles(s.ledgers[g.id])).toBe(true)
      expect(summarize(s.ledgers[g.id]).potBalance).toBeGreaterThanOrEqual(0)
    }
  })

  it('contains flagged members at each level', () => {
    const levels = new Set<string>()
    for (const g of s.groups) {
      const sch = buildSchedule(g)
      for (const m of g.members) levels.add(assessRisk(buildHistory(sch, s.ledgers[g.id], m.id, today)).level)
    }
    expect([...levels].sort()).toEqual(['High', 'Low', 'Medium'])
  })

  it('stores a reproducible seeded order', () => {
    const g = s.groups[1]
    expect(shuffleWithSeed(g.seedInput!, g.seed!)).toEqual(g.members.map((m) => m.name))
  })
  it('turns missed payments into arrears and short payouts', () => {
    const weekly = s.ledgers['demo-weekly']
    expect(memberArrears(weekly, 'w4')).toBe(100000)
    expect(cycleShortfall(weekly, 2)).toBe(100000)
    expect(activePayout(weekly, 2)?.amount).toBe(500000)
    const monthly = s.ledgers['demo-monthly']
    expect(memberArrears(monthly, 'm6')).toBe(1000000)
    expect(arrearsItems(monthly).every((a) => a.outstanding >= 0)).toBe(true)
  })
})
