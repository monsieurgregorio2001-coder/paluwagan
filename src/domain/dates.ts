const MS_DAY = 86_400_000

function parts(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Invalid date: ${iso}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function isValidDate(iso: string): boolean {
  try {
    const [y, m, d] = parts(iso)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  } catch {
    return false
  }
}

export function toDayNumber(iso: string): number {
  const [y, m, d] = parts(iso)
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY)
}

export function fromDayNumber(n: number): string {
  return new Date(n * MS_DAY).toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days)
}

/** Adds calendar months, clamping to the end of shorter months (Jan 31 + 1 month = Feb 28 or 29). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const nd = Math.min(d, last)
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

/** Whole days from a to b. Positive when b is after a. */
export function diffDays(a: string, b: string): number {
  return toDayNumber(b) - toDayNumber(a)
}

const TZ = 'Asia/Manila'

/** Today's calendar date in Asia/Manila as YYYY-MM-DD. */
export function todayManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const dateFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, dateStyle: 'medium' })
const stampFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' })

/** Formats a calendar date (YYYY-MM-DD) for display in Asia/Manila. */
export function formatDate(iso: string): string {
  const [y, m, d] = parts(iso)
  // 04:00 UTC is noon in Manila, so the calendar day never shifts.
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d, 4)))
}

/** Formats an ISO timestamp for display in Asia/Manila. */
export function formatStamp(ts: string): string {
  return stampFmt.format(new Date(ts))
}
