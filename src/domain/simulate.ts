import { addDays } from './dates'
import { recordArrearsPayment, recordContribution, recordPayout, reverseEntry, summarize, arrearsItems } from './ledger'
import { buildSchedule, currentCycle, makeRng, potSizeCentavos } from './rotation'
import type { Entry, Frequency, Group } from './types'

const NAMES = ['Ñora Dela Peña', 'Ramon Cruz', 'Liza Mercado', 'Joel Bautista', 'Angelica Reyes', 'Noel Villanueva', 'Mylene Ocampo', 'Dodong Alcantara', 'Pia Salazar', 'Tito Magbanua']
const FREQS: Frequency[] = ['weekly', 'biweekly', 'monthly']

export interface SimGroup { group: Group; entries: Entry[]; today: string }

/** A random but valid group in a random mid-round state. The same seed always builds the same group. */
export function randomGroup(seed: number): SimGroup {
  const rng = makeRng(seed)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]
  const n = 3 + Math.floor(rng() * 6)
  const names = NAMES.slice().sort(() => rng() - 0.5).slice(0, n)
  const frequency = pick(FREQS)
  const group: Group = {
    id: `sim-${seed}`, name: `Sim ${seed} Ipon`, members: names.map((name, i) => ({ id: `s${i + 1}`, name })),
    contributionCentavos: (1 + Math.floor(rng() * 50)) * 10_000 + Math.floor(rng() * 4) * 2_500,
    frequency, startDate: '2026-01-05', orderMethod: 'manual',
  }
  const schedule = buildSchedule(group)
  const target = 1 + Math.floor(rng() * n)
  const today = addDays(schedule[target - 1].dueDate, Math.floor(rng() * 6))
  const { cycle: current } = currentCycle(schedule, today)
  let entries: Entry[] = []
  const stamp = (d: string) => `${d}T09:00:00+08:00`
  for (let c = 1; c <= current; c++) {
    const due = schedule[c - 1].dueDate
    for (const m of group.members) {
      const roll = rng()
      try {
        if (c === current && roll < 0.3) continue
        if (roll < 0.55) entries = recordContribution(entries, { cycle: c, memberId: m.id, status: 'on_time', amount: group.contributionCentavos, expected: group.contributionCentavos, dueDate: due }, stamp(due))
        else if (roll < 0.7) entries = recordContribution(entries, { cycle: c, memberId: m.id, status: 'late', amount: group.contributionCentavos, expected: group.contributionCentavos, dueDate: due, paidDate: addDays(due, 1 + Math.floor(rng() * 9)) }, stamp(due))
        else if (roll < 0.85) entries = recordContribution(entries, { cycle: c, memberId: m.id, status: 'missed', amount: 0, expected: group.contributionCentavos, dueDate: due }, stamp(due))
        else entries = recordContribution(entries, { cycle: c, memberId: m.id, status: 'on_time', amount: Math.max(100, Math.floor(group.contributionCentavos * (0.2 + rng() * 0.6))), expected: group.contributionCentavos, dueDate: due }, stamp(due))
      } catch { /* an invalid random step is skipped */ }
    }
    if (c < current) {
      try {
        const amount = Math.min(potSizeCentavos(group), summarize(entries).potBalance)
        if (amount > 0) entries = recordPayout(entries, { cycle: c, memberId: schedule[c - 1].recipient.id, amount }, stamp(addDays(due, 4)))
      } catch { /* skipped */ }
    }
  }
  for (const a of arrearsItems(entries)) {
    if (a.outstanding > 0 && rng() < 0.3) {
      try { entries = recordArrearsPayment(entries, { cycle: a.cycle, memberId: a.memberId, amount: Math.max(1, Math.floor(a.outstanding * rng())) }, stamp(today)) } catch { /* skipped */ }
    }
  }
  if (entries.length && rng() < 0.4) {
    try { entries = reverseEntry(entries, pick(entries.filter((e) => e.type !== 'reversal')).id, 'Entered in error', stamp(today)) } catch { /* skipped */ }
  }
  return { group, entries, today }
}
