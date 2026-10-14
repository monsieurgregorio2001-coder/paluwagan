const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

/** Formats integer centavos as Philippine pesos, for example 100000 -> "₱1,000.00". */
export function formatPHP(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error('Money must be integer centavos')
  const sign = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const pesos = Math.floor(abs / 100)
  const cents = abs % 100
  // Format the whole pesos part and the cents separately so no float math is involved.
  const whole = php.format(pesos).replace(/\.00$/, '')
  return `${sign}${whole}.${String(cents).padStart(2, '0')}`
}

/** Parses user text such as "1,000" or "1000.50" into integer centavos. Returns null if invalid. */
export function parsePesos(text: string): number | null {
  const cleaned = text.trim().replace(/^₱/, '').replace(/,/g, '')
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!m) return null
  const pesos = Number(m[1])
  const cents = m[2] ? Number(m[2].padEnd(2, '0')) : 0
  const total = pesos * 100 + cents
  if (!Number.isSafeInteger(total)) return null
  return total
}
