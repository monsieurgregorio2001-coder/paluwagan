import { addDays, addMonths } from '../domain/dates'
import { recordContribution, recordPayout, summarize } from '../domain/ledger'
import { buildSchedule, currentCycle, potSizeCentavos, shuffleWithSeed } from '../domain/rotation'
import type { Entry, Group } from '../domain/types'
import type { Draft } from '../domain/reminders'

export interface AppState {
  version: 1
  groups: Group[]
  ledgers: Record<string, Entry[]>
  drafts: Draft[]
}

/** Payment pattern per member: 'o' on time, 'm' missed, a number is days late, '-' not yet paid. */
type Pattern = (string | number)[]

const MONTHLY_SEED = 'opisina-2026'
const MONTHLY_NAMES = [
  'Rey Magsaysay', 'Gloria Fernandez', 'Benjie Aquino', 'Cecilia Navarro', 'Eduardo Castillo',
  'Rowena Pascual', 'Dennis Ocampo', 'Marites Soriano', 'Arnel Domingo', 'Josefina Tolentino',
]

function stamp(date: string, hour = 9): string {
  return `${date}T${String(hour).padStart(2, '0')}:00:00+08:00`
}

function buildLedger(group: Group, patterns: Pattern[], today: string): Entry[] {
  const schedule = buildSchedule(group)
  const { cycle: current } = currentCycle(schedule, today)
  let entries: Entry[] = []
  for (let c = 1; c <= current; c++) {
    const due = schedule[c - 1].dueDate
    group.members.forEach((m, i) => {
      const p = patterns[i][c - 1]
      if (p === '-' || p === undefined) return
      if (p === 'o') {
        entries = recordContribution(entries, { cycle: c, memberId: m.id, status: 'on_time', amount: group.contributionCentavos, expected: group.contributionCentavos, dueDate: due }, stamp(due))
      } else if (p === 'm') {
        entries = recordContribution(entries, { cycle: c, memberId: m.id, status: 'missed', amount: 0, expected: group.contributionCentavos, dueDate: due, note: 'No payment by the end of the cycle' }, stamp(addDays(due, 3)))
      } else {
        const paid = addDays(due, p as number)
        entries = recordContribution(entries, { cycle: c, memberId: m.id, status: 'late', amount: group.contributionCentavos, expected: group.contributionCentavos, dueDate: due, paidDate: paid }, stamp(paid, 14))
      }
    })
    if (c < current) {
      const payoutDate = addDays(due, 4)
      const amount = Math.min(potSizeCentavos(group), summarize(entries).potBalance)
      if (amount > 0) {
        entries = recordPayout(entries, { cycle: c, memberId: schedule[c - 1].recipient.id, amount, note: 'Pot released to recipient' }, stamp(payoutDate, 16))
      }
    }
  }
  return entries
}

/** Builds the two demo groups relative to today so they are always mid-round. */
export function buildSeed(today: string): AppState {
  // Weekly group of 6, currently in cycle 4. Cycle 4 started 5 days ago.
  const weeklyStart = addDays(today, -(3 * 7 + 5))
  const weekly: Group = {
    id: 'demo-weekly',
    name: 'Barkada Weekly Ipon',
    members: [
      { id: 'w1', name: 'Maricel Santos' },
      { id: 'w2', name: 'Ramon Dela Cruz' },
      { id: 'w3', name: 'Liza Mercado' },
      { id: 'w4', name: 'Joel Bautista' },
      { id: 'w5', name: 'Angelica Reyes' },
      { id: 'w6', name: 'Noel Villanueva' },
    ],
    contributionCentavos: 100_000,
    frequency: 'weekly',
    startDate: weeklyStart,
    orderMethod: 'manual',
  }
  const weeklyPatterns: Pattern[] = [
    ['o', 'o', 'o', 'o'],
    ['o', 'o', 'o', 'o'],
    ['o', 3, 5, 2],
    ['o', 'm', 4, '-'],
    ['o', 'o', 'o', 'o'],
    ['o', 'o', 'o', '-'],
  ]

  // Monthly group of 10, currently in cycle 5. Cycle 5 started 9 days ago.
  const monthlyStart = addMonths(addDays(today, -9), -4)
  const monthly: Group = {
    id: 'demo-monthly',
    name: 'Opisina Buwanang Paluwagan',
    members: shuffleWithSeed(MONTHLY_NAMES, MONTHLY_SEED).map((name, i) => ({ id: `m${i + 1}`, name })),
    contributionCentavos: 500_000,
    frequency: 'monthly',
    startDate: monthlyStart,
    orderMethod: 'seeded',
    seed: MONTHLY_SEED,
    seedInput: MONTHLY_NAMES,
  }
  const monthlyPatterns: Pattern[] = [
    ['o', 'o', 'o', 'o', 'o'],
    ['o', 'o', 'o', 'o', 'o'],
    ['o', 'o', 6, 9, 8],
    ['o', 'o', 'o', 'o', 'o'],
    ['o', 'o', 'o', 'o', 2],
    ['o', 'm', 'm', 'o', '-'],
    ['o', 'o', 'o', 'o', 'o'],
    ['o', 4, 'o', 'o', 'o'],
    ['o', 'o', 'o', 'o', '-'],
    ['o', 'o', 'o', 'o', 'o'],
  ]

  return {
    version: 1,
    groups: [weekly, monthly],
    ledgers: {
      [weekly.id]: buildLedger(weekly, weeklyPatterns, today),
      [monthly.id]: buildLedger(monthly, monthlyPatterns, today),
    },
    drafts: [],
  }
}
