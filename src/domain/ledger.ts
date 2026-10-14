import type { ContributionStatus, Entry } from './types'
import { diffDays } from './dates'

export class LedgerError extends Error {}

/** Signed effect of one entry on the pot. */
function delta(e: Entry): number {
  if (e.type === 'contribution') return e.amount
  if (e.type === 'payout') return -e.amount
  return e.reversedType === 'contribution' ? -e.amount : e.amount
}

export interface Summary {
  contributions: number
  payouts: number
  potBalance: number
}

/** Net contributions and payouts (after reversals) and the pot balance replayed entry by entry. */
export function summarize(entries: readonly Entry[]): Summary {
  let contributions = 0
  let payouts = 0
  let potBalance = 0
  for (const e of entries) {
    if (e.type === 'contribution') contributions += e.amount
    else if (e.type === 'payout') payouts += e.amount
    else if (e.reversedType === 'contribution') contributions -= e.amount
    else payouts -= e.amount
    potBalance += delta(e)
  }
  return { contributions, payouts, potBalance }
}

/** The ledger invariant: net contributions equal net payouts plus the pot balance. */
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
      note: input.note,
    }
  }
  return [...entries, entry]
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

/** Corrects an entry by appending a reversing entry. The original is never edited or removed. */
export function reverseEntry(entries: readonly Entry[], id: string, note: string, now: string): Entry[] {
  const target = entries.find((e) => e.id === id)
  if (!target) throw new LedgerError('Entry not found.')
  if (target.type === 'reversal') throw new LedgerError('A reversal cannot be reversed. Record a new entry instead.')
  if (reversedIds(entries).has(id)) throw new LedgerError('This entry is already reversed.')
  if (!note.trim()) throw new LedgerError('A reason is required for a reversal.')
  if (target.type === 'contribution' && target.amount > summarize(entries).potBalance) {
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
    note: note.trim(),
  }
  return [...entries, entry]
}
