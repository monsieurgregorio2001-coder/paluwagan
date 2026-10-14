import { addDays, addMonths } from './dates'
import type { Frequency, Group, Member } from './types'

/** Hashes a string to a 32-bit seed (FNV-1a). */
function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small deterministic PRNG (mulberry32). */
export function makeRng(seed: string | number): () => number {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates shuffle that is fully determined by the seed. Does not mutate the input. */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const rng = makeRng(seed)
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Due date of the zero-based cycle index. */
export function cycleDueDate(startDate: string, frequency: Frequency, index: number): string {
  switch (frequency) {
    case 'weekly':
      return addDays(startDate, 7 * index)
    case 'biweekly':
      return addDays(startDate, 14 * index)
    case 'monthly':
      return addMonths(startDate, index)
  }
}

/** Recipient of a zero-based cycle index. Wraps around, so every member is paid once per round. */
export function recipientForCycle<T>(order: readonly T[], index: number): T {
  return order[index % order.length]
}

export interface ScheduleRow {
  cycle: number
  dueDate: string
  recipient: Member
}

/** One round: one cycle per member, in payout order. */
export function buildSchedule(group: Pick<Group, 'members' | 'startDate' | 'frequency'>): ScheduleRow[] {
  return group.members.map((m, i) => ({
    cycle: i + 1,
    dueDate: cycleDueDate(group.startDate, group.frequency, i),
    recipient: m,
  }))
}

/** Current cycle number (1-based): the latest cycle whose due date is on or before today. */
export function currentCycle(schedule: readonly ScheduleRow[], today: string): { cycle: number; started: boolean } {
  let cycle = 0
  for (const row of schedule) if (row.dueDate <= today) cycle = row.cycle
  return cycle === 0 ? { cycle: 1, started: false } : { cycle, started: true }
}

export function potSizeCentavos(group: Pick<Group, 'members' | 'contributionCentavos'>): number {
  return group.members.length * group.contributionCentavos
}
