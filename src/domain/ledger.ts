import type { ContributionStatus, Entry } from './types'
import { diffDays } from './dates'

export class LedgerError extends Error {}

/** Money flows of one entry: what it adds to contributions and to payouts. The pot is the difference. */
function flows(e: Entry): { c: number; p: number } {
  const fwd = e.forwarded ? e.amount : 0
  if (e.type === 'contribution') return { c: e.amount, p: 0 }
  if (e.type === 'payout') return { c: 0, p: e.amount }
  if (e.type === 'arrears') return { c: e.amount, p: fwd }
  if (e.reversedType === 'contribution') return { c: -e.amount, p: 0 }
  if (e.reversedType === 'arrears') return { c: -e.amount, p: -fwd }
  return { c: 0, p: -e.amount }
}

export interface Summary {
  contributions: number
  payouts: number
  potBalance: number
}

/**
 * Net contributions and payouts (after reversals) and the pot balance replayed entry by entry.
 * Arrears payments count as contributions. When the cycle payout was already made they also count
 * as a payout, because the money is passed on to the short recipient.
 */
export function summarize(entries: readonly Entry[]): Summary {
  let contributions = 0
  let payouts = 0
  let potBalance = 0
  for (const e of entries) {
    const { c, p } = flows(e)
    contributions += c
    payouts += p
    potBalance += c - p
  }
  return { contributions, payouts, potBalance }
}

export function reconciles(entries: readonly Entry[]): boolean {
  const s = summarize(entries)
  return s.contributions === s.payouts + s.potBalance
}

export function reversedIds(entries: readonly Entry[]): Set<string> {
  const ids = new Set<string>()
  for (const e of entries) if (e.type === 'reversal' && e.reverses) ids.add(e.reverses)
  return ids
}

export function isActive(e: Entry, reversed: Set<string>): boolean {
  return e.type !== 'reversal' && !reversed.has(e.id)
}

/** The latest active contribution entry for a member and cycle, or undefined if none. */
export function effectiveContribution(entries: readonly Entry[], memberId: string, cycle: number): Entry | undefined {
  const rev = reversedIds(entries)
  let found: Entry | undefined
  for (const e of entries) {
    if (e.type === 'contribution' && e.memberId === memberId && e.cycle === cycle && isActive(e, rev)) found = e
  }
  return found
}

export function activePayout(entries: readonly Entry[], cycle: number): Entry | undefined {
  const rev = reversedIds(entries)
  return entries.find((e) => e.type === 'payout' && e.cycle === cycle && isActive(e, rev))
}

export interface ArrearsItem {
  memberId: string
  cycle: number
  /** Centavos the member fell short in that cycle. */
  owed: number
  /** Centavos of arrears already paid. */
  settled: number
  /** owed minus settled. Never negative. */
  outstanding: number
}

/** Arrears per member and cycle, derived from the active contribution shortfalls and arrears payments. */
export function arrearsItems(entries: readonly Entry[]): ArrearsItem[] {
  const rev = reversedIds(entries)
  const owed = new Map<string, { memberId: string; cycle: number; owed: number; settled: number }>()
  const key = (m: string, c: number) => `${m}|${c}`
  for (const e of entries) {
    if (!isActive(e, rev)) continue
    if (e.type === 'contribution') {
      // The latest active contribution for a member and cycle is the effective one.
      owed.set(key(e.memberId, e.cycle), { memberId: e.memberId, cycle: e.cycle, owed: e.shortfall ?? 0, settled: owed.get(key(e.memberId, e.cycle))?.settled ?? 0 })
    } else if (e.type === 'arrears') {
      const cur = owed.get(key(e.memberId, e.cycle)) ?? { memberId: e.memberId, cycle: e.cycle, owed: 0, settled: 0 }
      owed.set(key(e.memberId, e.cycle), { ...cur, settled: cur.settled + e.amount })
    }
  }
  return [...owed.values()]
    .filter((x) => x.owed > 0 || x.settled > 0)
    .map((x) => ({ ...x, outstanding: x.owed - x.settled }))
    .sort((a, b) => a.cycle - b.cycle || a.memberId.localeCompare(b.memberId))
}

/** Arrears still owed by one member for one cycle. */
export function arrearsOutstanding(entries: readonly Entry[], memberId: string, cycle: number): number {
  return arrearsItems(entries).find((i) => i.memberId === memberId && i.cycle === cycle)?.outstanding ?? 0
}

/** What a member still owes for a cycle: the contribution minus what they have paid and settled, never below zero. */
export function cycleOutstanding(entries: readonly Entry[], memberId: string, cycle: number, contribution: number): number {
  const paid = effectiveContribution(entries, memberId, cycle)?.amount ?? 0
  const settled = arrearsItems(entries).find((i) => i.memberId === memberId && i.cycle === cycle)?.settled ?? 0
  return Math.max(0, contribution - paid - settled)
}

/** Total arrears still owed by a member across all cycles. */
export function memberArrears(entries: readonly Entry[], memberId: string): number {
  return arrearsItems(entries).filter((i) => i.memberId === memberId).reduce((t, i) => t + i.outstanding, 0)
}

/** Total arrears still owed to the recipient of a cycle (the shortfall of that cycle's payout). */
export function cycleShortfall(entries: readonly Entry[], cycle: number): number {
  return arrearsItems(entries).filter((i) => i.cycle === cycle).reduce((t, i) => t + i.outstanding, 0)
}

/** Throws if any arrears balance would be negative. Called after every operation that can change it. */
function assertArrearsValid(entries: readonly Entry[]): void {
  if (arrearsItems(entries).some((i) => i.outstanding < 0)) {
    throw new LedgerError('This would leave an arrears balance below zero. Reverse the arrears payment first.')
  }
}

function nextMeta(entries: readonly Entry[], now: string): { id: string; seq: number; ts: string } {
  const seq = entries.length + 1
  return { id: `E${seq}`, seq, ts: now }
}

function assertCentavos(n: number, label: string): void {
  if (!Number.isSafeInteger(n)) throw new LedgerError(`${label} must be a whole number of centavos`)
}

export interface ContributionInput {
  cycle: number
  memberId: string
  status: ContributionStatus
  /** Amount in centavos. Ignored for missed. */
  amount: number
  dueDate: string
  /** Amount due per cycle in centavos. A smaller or missed payment leaves the difference as arrears. */
  expected?: number
  /** Required for late. Defaults to the due date for on time. */
  paidDate?: string
  note?: string
}

/** Appends a contribution entry. Returns a new array and never touches the old entries. */
export function recordContribution(entries: readonly Entry[], input: ContributionInput, now: string): Entry[] {
  const existing = effectiveContribution(entries, input.memberId, input.cycle)
  let entry: Entry
  if (input.status === 'missed') {
    if (existing) throw new LedgerError('This cycle already has an active entry. Reverse it first.')
    entry = {
      ...nextMeta(entries, now),
      type: 'contribution',
      cycle: input.cycle,
      memberId: input.memberId,
      amount: 0,
      status: 'missed',
      shortfall: input.expected ?? 0,
      note: input.note,
    }
  } else {
    assertCentavos(input.amount, 'Amount')
    if (input.amount <= 0) throw new LedgerError('Amount must be greater than zero.')
    if (existing && existing.status !== 'missed') {
      throw new LedgerError('This cycle already has a payment. Reverse it first to correct it.')
    }
    const paidDate = input.status === 'late' ? input.paidDate : (input.paidDate ?? input.dueDate)
    if (!paidDate) throw new LedgerError('A late payment needs the date it was paid.')
    const daysLate = Math.max(0, diffDays(input.dueDate, paidDate))
    if (input.status === 'late' && daysLate < 1) throw new LedgerError('A late payment must be dated after the due date.')
    entry = {
      ...nextMeta(entries, now),
      type: 'contribution',
      cycle: input.cycle,
      memberId: input.memberId,
      amount: input.amount,
      status: input.status,
      paidDate,
      daysLate: input.status === 'late' ? daysLate : 0,
      shortfall: Math.max(0, (input.expected ?? 0) - input.amount),
      note: input.note,
    }
  }
  const next = [...entries, entry]
  assertArrearsValid(next)
  return next
}

export interface PayoutInput {
  cycle: number
  memberId: string
  amount: number
  note?: string
}

export function recordPayout(entries: readonly Entry[], input: PayoutInput, now: string): Entry[] {
  assertCentavos(input.amount, 'Amount')
  if (input.amount <= 0) throw new LedgerError('Payout must be greater than zero.')
  if (activePayout(entries, input.cycle)) throw new LedgerError('This cycle already has a payout. Reverse it first.')
  if (input.amount > summarize(entries).potBalance) throw new LedgerError('Payout is larger than the pot balance.')
  const entry: Entry = {
    ...nextMeta(entries, now),
    type: 'payout',
    cycle: input.cycle,
    memberId: input.memberId,
    amount: input.amount,
    note: input.note,
  }
  return [...entries, entry]
}

export interface ArrearsInput {
  /** The cycle in which the contribution was missed or short. */
  cycle: number
  /** The member who owes the arrears and is paying it now. */
  memberId: string
  amount: number
  note?: string
}

/**
 * Settles part or all of a member's arrears for one cycle with an append-only entry.
 * If that cycle's payout was already made, the money is passed straight to the recipient.
 * Otherwise it stays in the pot and the payout picks it up.
 */
export function recordArrearsPayment(entries: readonly Entry[], input: ArrearsInput, now: string): Entry[] {
  assertCentavos(input.amount, 'Amount')
  if (input.amount <= 0) throw new LedgerError('Arrears payment must be greater than zero.')
  const owing = arrearsOutstanding(entries, input.memberId, input.cycle)
  if (owing <= 0) throw new LedgerError('This member owes no arrears for that cycle.')
  if (input.amount > owing) throw new LedgerError('Payment is larger than the arrears owed.')
  const entry: Entry = {
    ...nextMeta(entries, now),
    type: 'arrears',
    cycle: input.cycle,
    memberId: input.memberId,
    amount: input.amount,
    forwarded: activePayout(entries, input.cycle) !== undefined,
    note: input.note,
  }
  const next = [...entries, entry]
  assertArrearsValid(next)
  return next
}

/** Corrects an entry by appending a reversing entry. The original is never edited or removed. */
export function reverseEntry(entries: readonly Entry[], id: string, note: string, now: string): Entry[] {
  const target = entries.find((e) => e.id === id)
  if (!target) throw new LedgerError('Entry not found.')
  if (target.type === 'reversal') throw new LedgerError('A reversal cannot be reversed. Record a new entry instead.')
  if (reversedIds(entries).has(id)) throw new LedgerError('This entry is already reversed.')
  if (!note.trim()) throw new LedgerError('A reason is required for a reversal.')
  const taken = target.type === 'contribution' || (target.type === 'arrears' && !target.forwarded) ? target.amount : 0
  if (taken > summarize(entries).potBalance) {
    throw new LedgerError('Reversing this payment would make the pot negative. Reverse the payout first.')
  }
  const entry: Entry = {
    ...nextMeta(entries, now),
    type: 'reversal',
    cycle: target.cycle,
    memberId: target.memberId,
    amount: target.amount,
    reverses: target.id,
    reversedType: target.type,
    ...(target.type === 'arrears' ? { forwarded: target.forwarded } : {}),
    note: note.trim(),
  }
  const next = [...entries, entry]
  assertArrearsValid(next)
  return next
}
