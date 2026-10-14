import { describe, expect, it } from 'vitest'
import { formatPHP, parsePesos } from './money'

describe('money', () => {
  it('formats centavos as PHP', () => {
    expect(formatPHP(100000)).toBe('₱1,000.00')
    expect(formatPHP(0)).toBe('₱0.00')
    expect(formatPHP(5)).toBe('₱0.05')
    expect(formatPHP(123456789)).toBe('₱1,234,567.89')
    expect(formatPHP(-250050)).toBe('-₱2,500.50')
  })
  it('rejects non-integer money', () => {
    expect(() => formatPHP(10.5)).toThrow()
  })
  it('parses peso text into integer centavos without floats', () => {
    expect(parsePesos('1,000')).toBe(100000)
    expect(parsePesos('1000.5')).toBe(100050)
    expect(parsePesos('₱0.07')).toBe(7)
    expect(parsePesos('19.99')).toBe(1999)
    expect(parsePesos('abc')).toBeNull()
    expect(parsePesos('1.234')).toBeNull()
    expect(parsePesos('-5')).toBeNull()
    expect(parsePesos('')).toBeNull()
  })
})
