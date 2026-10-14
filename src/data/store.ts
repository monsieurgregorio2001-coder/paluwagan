import { useSyncExternalStore } from 'react'
import { todayManila } from '../domain/dates'
import { LedgerError, recordArrearsPayment, recordContribution, recordPayout, reverseEntry, type ArrearsInput, type ContributionInput, type PayoutInput } from '../domain/ledger'
import { approveDraft, editDraft, sendDraft, type Draft } from '../domain/reminders'
import type { Group } from '../domain/types'
import { buildSeed, type AppState } from './seed'
import { clearState, loadState, saveState } from './storage'

let state: AppState = loadState() ?? buildSeed(todayManila())
const listeners = new Set<() => void>()

function commit(next: AppState): void {
  state = next
  saveState(state)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state)
}

const nowIso = () => new Date().toISOString()

/** Runs a ledger change. Returns an error message or null on success. */
function guard(fn: () => void): string | null {
  try {
    fn()
    return null
  } catch (e) {
    if (e instanceof LedgerError || e instanceof Error) return e.message
    return 'Something went wrong.'
  }
}

export const actions = {
  addGroup(group: Group): void {
    commit({ ...state, groups: [...state.groups, group], ledgers: { ...state.ledgers, [group.id]: [] } })
  },
  resetDemo(): void {
    clearState()
    commit(buildSeed(todayManila()))
  },
  recordContribution(groupId: string, input: ContributionInput): string | null {
    return guard(() => {
      const next = recordContribution(state.ledgers[groupId] ?? [], input, nowIso())
      commit({ ...state, ledgers: { ...state.ledgers, [groupId]: next } })
    })
  },
  recordPayout(groupId: string, input: PayoutInput): string | null {
    return guard(() => {
      const next = recordPayout(state.ledgers[groupId] ?? [], input, nowIso())
      commit({ ...state, ledgers: { ...state.ledgers, [groupId]: next } })
    })
  },
  recordArrears(groupId: string, input: ArrearsInput): string | null {
    return guard(() => {
      const next = recordArrearsPayment(state.ledgers[groupId] ?? [], input, nowIso())
      commit({ ...state, ledgers: { ...state.ledgers, [groupId]: next } })
    })
  },
  reverse(groupId: string, entryId: string, note: string): string | null {
    return guard(() => {
      const next = reverseEntry(state.ledgers[groupId] ?? [], entryId, note, nowIso())
      commit({ ...state, ledgers: { ...state.ledgers, [groupId]: next } })
    })
  },
  /** Inserts or replaces a draft, unless the stored one is already approved or sent. */
  upsertDraft(draft: Draft): void {
    const existing = state.drafts.find((d) => d.id === draft.id)
    if (existing && existing.status !== 'draft') return
    commit({ ...state, drafts: [...state.drafts.filter((d) => d.id !== draft.id), draft] })
  },
  editDraft(draft: Draft, text: string): string | null {
    return guard(() => {
      const edited = editDraft(draft, text)
      commit({ ...state, drafts: [...state.drafts.filter((d) => d.id !== draft.id), edited] })
    })
  },
  approveDraft(draft: Draft): string | null {
    return guard(() => {
      const base = state.drafts.find((d) => d.id === draft.id) ?? draft
      const approved = approveDraft(base, nowIso())
      commit({ ...state, drafts: [...state.drafts.filter((d) => d.id !== draft.id), approved] })
    })
  },
  sendDraft(draftId: string): string | null {
    return guard(() => {
      const d = state.drafts.find((x) => x.id === draftId)
      if (!d) throw new Error('Draft not found.')
      const sent = sendDraft(d, nowIso())
      commit({ ...state, drafts: state.drafts.map((x) => (x.id === draftId ? sent : x)) })
    })
  },
}
