import { summarize } from './ledger'
import type { Entry } from './types'

/**
 * The books are three records that are written at the same moment an entry is appended and are never derived from
 * each other afterwards:
 *   1. the ledger entries (the append-only list),
 *   2. the cycle state machine (what each cycle has collected and paid out),
 *   3. each member's stub (a copy of every line that member is on).
 * "Check the books" compares them. A line edited in one place no longer matches the other two.
 */

/** Every field of an entry, flattened so a stub can be compared with its ledger line field for field. */
export interface Line {
  id: string
  type: Entry['type']
  cycle: number
  memberId: string
  amount: number
  shortfall: number
  forwarded: boolean
  reverses: string
  reversedType: string
  status: string
  paidDate: string
  daysLate: number
  ts: string
  note: string
}

export interface CycleState {
  cycle: number
  /** Net centavos that came in during this cycle, after reversals. */
  collected: number
  /** Net centavos that went out during this cycle, after reversals. */
  paidOut: number
  /** Entries written into this cycle. */
  lines: number
}

export interface Books {
  cycles: CycleState[]
  /** Member id to the stub lines written for that member. */
  stubs: Record<string, Line[]>
}

export const emptyBooks = (): Books => ({ cycles: [], stubs: {} })

export function lineOf(e: Entry): Line {
  return {
    id: e.id, type: e.type, cycle: e.cycle, memberId: e.memberId, amount: e.amount,
    shortfall: e.shortfall ?? 0, forwarded: e.forwarded === true, reverses: e.reverses ?? '', reversedType: e.reversedType ?? '',
    status: e.status ?? '', paidDate: e.paidDate ?? '', daysLate: e.daysLate ?? 0, ts: e.ts, note: e.note ?? '',
  }
}

/** Money in and out of one line. Same rules as the ledger, written out once for the books. */
export function flowOf(l: Line): { c: number; p: number } {
  const fwd = l.forwarded ? l.amount : 0
  if (l.type === 'contribution') return { c: l.amount, p: 0 }
  if (l.type === 'payout') return { c: 0, p: l.amount }
  if (l.type === 'arrears') return { c: l.amount, p: fwd }
  if (l.reversedType === 'contribution') return { c: -l.amount, p: 0 }
  if (l.reversedType === 'arrears') return { c: -l.amount, p: -fwd }
  return { c: 0, p: -l.amount }
}

/** Writes one new entry into the cycle state machine and the member's stub. Returns new books. */
export function appendToBooks(books: Books, entry: Entry): Books {
  const line = lineOf(entry)
  const { c, p } = flowOf(line)
  const cycles = books.cycles.slice()
  const at = cycles.findIndex((s) => s.cycle === line.cycle)
  const cur = at >= 0 ? cycles[at] : { cycle: line.cycle, collected: 0, paidOut: 0, lines: 0 }
  const next = { ...cur, collected: cur.collected + c, paidOut: cur.paidOut + p, lines: cur.lines + 1 }
  if (at >= 0) cycles[at] = next
  else cycles.push(next)
  cycles.sort((a, b) => a.cycle - b.cycle)
  return { cycles, stubs: { ...books.stubs, [line.memberId]: [...(books.stubs[line.memberId] ?? []), line] } }
}

/** Builds books by writing every entry in order. Used once for seed data and for saved data from before the books existed. */
export function booksFromEntries(entries: readonly Entry[]): Books {
  return entries.reduce(appendToBooks, emptyBooks())
}

export interface CycleCheck {
  cycle: number
  /** Net centavos the ledger entries say this cycle holds. */
  ledger: number
  /** Net centavos the cycle state machine says. */
  state: number
  /** Net centavos the member stubs say. */
  stubs: number
  /** Money in and out of the cycle, per record, for display. */
  flows: { ledger: { in: number; out: number }; state: { in: number; out: number }; stubs: { in: number; out: number } }
  /** Centavos that moved in this cycle, in and out, as the ledger entries say. */
  moved: number
  /** Lines whose stub or entry is missing or different. */
  mismatched: string[]
  ok: boolean
  /** Signed centavos: negative when the ledger holds less than the other two records. */
  difference: number
}

export interface BooksCheck {
  cycles: CycleCheck[]
  ok: boolean
  /** The first cycle that does not match, if any. */
  failure: CycleCheck | null
  /** Centavos checked up to and including each cycle, for the count to zero. */
  total: number
}

const net = (l: Line) => { const f = flowOf(l); return f.c - f.p }
const sameLine = (a: Line, b: Line) => (Object.keys(a) as (keyof Line)[]).every((k) => a[k] === b[k])

/**
 * Reconciles the three records cycle by cycle. A cycle passes only when the ledger, the state machine and the stubs
 * agree on the money and every line matches its stub field for field.
 */
export function checkBooks(entries: readonly Entry[], books: Books): BooksCheck {
  const ledgerLines = new Map<string, Line>(entries.map((e) => [e.id, lineOf(e)]))
  const stubLines = new Map<string, Line>()
  for (const list of Object.values(books.stubs)) for (const l of list) stubLines.set(l.id, l)
  const numbers = new Set<number>([...ledgerLines.values()].map((l) => l.cycle).concat([...stubLines.values()].map((l) => l.cycle), books.cycles.map((c) => c.cycle)))
  const out: CycleCheck[] = [...numbers].sort((a, b) => a - b).map((cycle) => {
    const ledger = [...ledgerLines.values()].filter((l) => l.cycle === cycle).reduce((t, l) => t + net(l), 0)
    const moved = [...ledgerLines.values()].filter((l) => l.cycle === cycle).reduce((t, l) => { const f = flowOf(l); return t + Math.abs(f.c) + Math.abs(f.p) }, 0)
    const stubs = [...stubLines.values()].filter((l) => l.cycle === cycle).reduce((t, l) => t + net(l), 0)
    const st = books.cycles.find((s) => s.cycle === cycle)
    const state = st ? st.collected - st.paidOut : 0
    const sumFlows = (ls: Line[]) => ls.reduce((t, l) => { const f = flowOf(l); return { in: t.in + f.c, out: t.out + f.p } }, { in: 0, out: 0 })
    const flows = {
      ledger: sumFlows([...ledgerLines.values()].filter((l) => l.cycle === cycle)),
      state: { in: st?.collected ?? 0, out: st?.paidOut ?? 0 },
      stubs: sumFlows([...stubLines.values()].filter((l) => l.cycle === cycle)),
    }
    const ids = new Set([...ledgerLines.keys(), ...stubLines.keys()])
    const mismatched = [...ids].filter((id) => {
      const a = ledgerLines.get(id)
      const b = stubLines.get(id)
      if (!a || !b) return (a ?? b)!.cycle === cycle
      return (a.cycle === cycle || b.cycle === cycle) && !sameLine(a, b)
    })
    // Measure the gap against whichever other record disagrees with the ledger.
    let difference = ledger - (state !== ledger ? state : stubs)
    if (difference === 0 && mismatched.length) {
      // Same net, different lines: measure the moved money line by line.
      difference = -mismatched.reduce((t, id) => t + Math.abs((ledgerLines.get(id)?.amount ?? 0) - (stubLines.get(id)?.amount ?? 0)), 0)
    }
    const ok = ledger === state && state === stubs && mismatched.length === 0
    return { cycle, ledger, state, stubs, flows, moved, mismatched, ok, difference }
  })
  const failure = out.find((c) => !c.ok) ?? null
  const s = summarize(entries)
  return { cycles: out, ok: failure === null, failure, total: Math.abs(s.contributions) }
}

/** What the page says for a cycle that does not match. */
export function shortBy(c: CycleCheck): { word: 'Short' | 'Over' | 'Mismatch'; centavos: number } {
  if (c.difference < 0) return { word: 'Short', centavos: -c.difference }
  if (c.difference > 0) return { word: 'Over', centavos: c.difference }
  return { word: 'Mismatch', centavos: 0 }
}

export interface Forgery {
  id: string
  /** Replacement fields for that one line. */
  patch: Partial<Omit<Entry, 'id' | 'seq'>>
}

/** Returns a copy of the entries with one line edited. The real entries are never touched. */
export function forgeLine(entries: readonly Entry[], forgery: Forgery): Entry[] {
  const found = entries.some((e) => e.id === forgery.id)
  if (!found) throw new Error('That line does not exist.')
  return entries.map((e) => (e.id === forgery.id ? { ...e, ...forgery.patch } : { ...e }))
}
