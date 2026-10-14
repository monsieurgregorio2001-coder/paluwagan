import { activePayout, arrearsItems, effectiveContribution, summarize, type ArrearsItem } from '../domain/ledger'
import { assessRisk, buildHistory, outstandingCycle, type RiskAssessment } from '../domain/risk'
import { buildSchedule, currentCycle, potSizeCentavos } from '../domain/rotation'
import type { Entry, Group, Member } from '../domain/types'
import type { ScheduleRow } from '../domain/rotation'

export interface GroupInfo {
  schedule: ScheduleRow[]
  cycle: number
  started: boolean
  total: number
  recipient: Member
  nextRecipient: Member | null
  potSize: number
  potBalance: number
  paidCount: number
  collected: number
  risks: Map<string, RiskAssessment>
  outstanding: Map<string, number | null>
  /** Arrears per member and cycle, including settled ones. */
  arrears: ArrearsItem[]
  /** Total arrears still owed in the group. */
  arrearsTotal: number
}

export function groupInfo(group: Group, entries: readonly Entry[], today: string): GroupInfo {
  const schedule = buildSchedule(group)
  const { cycle, started } = currentCycle(schedule, today)
  let paidCount = 0
  let collected = 0
  const risks = new Map<string, RiskAssessment>()
  const outstanding = new Map<string, number | null>()
  for (const m of group.members) {
    const eff = effectiveContribution(entries, m.id, cycle)
    if (eff && eff.status !== 'missed') {
      paidCount++
      collected += eff.amount
    }
    risks.set(m.id, assessRisk(buildHistory(schedule, entries, m.id, today)))
    outstanding.set(m.id, outstandingCycle(schedule, entries, m.id, today))
  }
  const arrears = arrearsItems(entries)
  return {
    schedule,
    cycle,
    started,
    total: group.members.length,
    recipient: schedule[cycle - 1].recipient,
    nextRecipient: schedule[cycle]?.recipient ?? null,
    potSize: potSizeCentavos(group),
    potBalance: summarize(entries).potBalance,
    paidCount,
    collected,
    risks,
    outstanding,
    arrears,
    arrearsTotal: arrears.reduce((t, a) => t + a.outstanding, 0),
  }
}

export function cycleStatus(group: Group, entries: readonly Entry[], cycle: number) {
  const paid = group.members.filter((m) => {
    const e = effectiveContribution(entries, m.id, cycle)
    return e && e.status !== 'missed'
  }).length
  return { paid, payout: activePayout(entries, cycle) }
}

/** Payout state of one cycle, including any shortfall caused by missed or short contributions. */
export function payoutState(entries: readonly Entry[], cycle: number) {
  const items = arrearsItems(entries).filter((a) => a.cycle === cycle)
  const owed = items.reduce((t, a) => t + a.owed, 0)
  const shortfall = items.reduce((t, a) => t + a.outstanding, 0)
  return { owed, shortfall, debtors: items.filter((a) => a.outstanding > 0).map((a) => a.memberId) }
}
