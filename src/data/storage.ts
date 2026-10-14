import type { AppState } from './seed'

const KEY = 'online-paluwagan:v2'

let memory: string | null = null
let persistent = false

function probe(): Storage | null {
  try {
    const s = window.localStorage
    const k = '__paluwagan_probe__'
    s.setItem(k, '1')
    s.removeItem(k)
    return s
  } catch {
    return null
  }
}

/** True when data is saved in localStorage. False means in-memory fallback. */
export function isPersistent(): boolean {
  return persistent
}

export function loadState(): AppState | null {
  const s = probe()
  persistent = s !== null
  try {
    const raw = s ? s.getItem(KEY) : memory
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState
    if (parsed && parsed.version === 1 && Array.isArray(parsed.groups) && parsed.ledgers && Array.isArray(parsed.drafts)) return parsed
    return null
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  const raw = JSON.stringify(state)
  memory = raw
  const s = probe()
  persistent = s !== null
  if (!s) return
  try {
    s.setItem(KEY, raw)
  } catch {
    persistent = false
  }
}

export function clearState(): void {
  memory = null
  const s = probe()
  try {
    s?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
