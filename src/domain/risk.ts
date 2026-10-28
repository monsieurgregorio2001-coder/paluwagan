import { diffDays } from './dates'
import { arrearsOutstanding, effectiveContribution } from './ledger'
import { currentCycle, type ScheduleRow } from './rotation'
import type { Entry } from './types'

export type RiskLevel = 'Low' | 'Medium' | 'High'

export interface CycleRecord {
  cycle: number
  status: 'on_time' | 'late' | 'missed' | 'overdue'
  /** Days late for a late payment, or days overdue for an unpaid current cycle. */
  daysLate: number
}

export interface RiskAssessment {
  level: RiskLevel
  reasons: string[]
  stats: { window: number; late: number; missed: number; maxDaysLate: number; overdueDays: number }
}

export const RISK_WINDOW = 4

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Rule-based late-payment risk from the most recent cycles (up to four).
 *
 * High:   2 or more missed, or 1 missed plus 1 late, or 3 or more late, or current cycle 7+ days overdue.
 * Medium: 1 missed, or 2 late, or any delay of 7+ days, or current cycle overdue.
 * Low:    everything else.
 */
export function assessRisk(history: readonly CycleRecord[]): RiskAssessment {
  const window = [...history].sort((a, b) => a.cycle - b.cycle).slice(-RISK_WINDOW)
  const n = window.length
  const late = window.filter((r) => r.status === 'late').length
  const missed = window.filter((r) => r.status === 'missed').length
  const overdue = window.find((r) => r.status === 'overdue')
  const overdueDays = overdue ? overdue.daysLate : 0
  const maxDaysLate = window.reduce((m, r) => (r.status === 'late' || r.status === 'overdue' ? Math.max(m, r.daysLate) : m), 0)

  let level: RiskLevel = 'Low'
  if (missed >= 2 || (missed >= 1 && late >= 1) || late >= 3 || overdueDays >= 7) level = 'High'
  else if (missed === 1 || late >= 2 || maxDaysLate >= 7 || overdueDays >= 1) level = 'Medium'

  const reasons: string[] = []
  if (missed) reasons.push(`${plural(missed, 'missed cycle', 'missed cycles')} in last ${n} cycles`)
  if (late) reasons.push(`${plural(late, 'late payment', 'late payments')} in last ${n} cycles`)
  if (overdueDays) reasons.push(`Current cycle is ${plural(overdueDays, 'day', 'days')} overdue`)
  if (maxDaysLate >= 7 && late) reasons.push(`Longest delay was ${plural(maxDaysLate, 'day', 'days')}`)
  if (reasons.length === 0) {
    reasons.push(n === 0 ? 'No payment history yet' : `Paid on time in all ${n} recorded ${n === 1 ? 'cycle' : 'cycles'}`)
  }
  return { level, reasons, stats: { window: n, late, missed, maxDaysLate, overdueDays } }
}

/** Builds a member's history from the schedule and ledger for every cycle that is already due. */
export function buildHistory(
  schedule: readonly ScheduleRow[],
  entries: readonly Entry[],
  memberId: string,
  today: string,
): CycleRecord[] {
  const { cycle: current, started } = currentCycle(schedule, today)
  if (!started) return []
  const out: CycleRecord[] = []
  for (const row of schedule) {
    if (row.cycle > current) break
    const eff = effectiveContribution(entries, memberId, row.cycle)
    if (eff && eff.status) {
      out.push({ cycle: row.cycle, status: eff.status, daysLate: eff.daysLate ?? 0 })
    } else if (row.cycle === current) {
      const d = diffDays(row.dueDate, today)
      if (d >= 1) out.push({ cycle: row.cycle, status: 'overdue', daysLate: d })
      // Due today and unpaid is not a risk signal yet.
    } else {
      out.push({ cycle: row.cycle, status: 'missed', daysLate: 0 })
    }
  }
  return out
}

/**
 * The most recent cycle (up to the current one) where the member still owes money, or null if they are paid up.
 * That is a cycle with no active payment, a missed one, or a short payment whose arrears are not settled.
 */
export function outstandingCycle(
  schedule: readonly ScheduleRow[],
  entries: readonly Entry[],
  memberId: string,
  today: string,
): number | null {
  const { cycle: current, started } = currentCycle(schedule, today)
  if (!started) return null
  for (let c = current; c >= 1; c--) {
    const eff = effectiveContribution(entries, memberId, c)
    if (!eff || eff.status === 'missed' || arrearsOutstanding(entries, memberId, c) > 0) {
      // A cycle that is not yet due today is not outstanding.
      if (schedule[c - 1].dueDate < today || c < current) return c
    }
  }
  return null
}
