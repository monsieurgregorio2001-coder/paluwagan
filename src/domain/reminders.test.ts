import { describe, expect, it } from 'vitest'
import {
  LANGS, TEMPLATES, TONES, approveDraft, createDraft, editDraft, fillTemplate, leftoverPlaceholders, sendDraft, suggestTone,
} from './reminders'
import { assessRisk } from './risk'

const vars = { name: 'Liza Mercado', amount: '₱1,000.00', dueDate: 'Mar 8, 2026', groupName: 'Barkada Weekly Ipon' }
const base = { groupId: 'g', memberId: 'm', memberName: 'Liza', cycle: 2 }

describe('reminder templates', () => {
  it('fills every variable in every language and tone', () => {
    for (const lang of LANGS) {
      for (const tone of TONES) {
        const text = fillTemplate(TEMPLATES[lang][tone], vars)
        expect(leftoverPlaceholders(text)).toEqual([])
        expect(text).not.toMatch(/[{}]/)
        for (const v of Object.values(vars)) expect(text).toContain(v)
      }
    }
  })

  it('has no em dashes, semicolons or english contractions in the copy', () => {
    for (const lang of LANGS) for (const tone of TONES) {
      const t = TEMPLATES[lang][tone]
      expect(t).not.toMatch(/[—;]/)
      if (lang === 'en') expect(t).not.toMatch(/\b\w+'(s|t|re|ve|ll|d|m)\b/i)
    }
  })

  it('throws on an unknown variable', () => {
    expect(() => fillTemplate('Hi {nope}', vars)).toThrow()
  })

  it('suggests tone from risk', () => {
    expect(suggestTone(assessRisk([{ cycle: 1, status: 'late', daysLate: 3 }, { cycle: 2, status: 'late', daysLate: 2 }]))).toBe('polite')
    expect(suggestTone(assessRisk([{ cycle: 1, status: 'overdue', daysLate: 8 }]))).toBe('firm')
    expect(suggestTone(assessRisk([{ cycle: 1, status: 'missed', daysLate: 0 }, { cycle: 2, status: 'missed', daysLate: 0 }]))).toBe('final')
  })
})

describe('approval flow', () => {
  it('requires approval before send, and blocks edits after approval', () => {
    let d = createDraft(base, 'en', 'polite', vars)
    expect(d.status).toBe('draft')
    expect(() => sendDraft(d, 'now')).toThrow()
    d = editDraft(d, 'Edited text for Liza')
    expect(d.edited).toBe(true)
    d = approveDraft(d, 'now')
    expect(d.status).toBe('approved')
    expect(() => editDraft(d, 'x')).toThrow()
    d = sendDraft(d, 'later')
    expect(d).toMatchObject({ status: 'sent', sentAt: 'later', text: 'Edited text for Liza' })
    expect(() => approveDraft(d, 'x')).toThrow()
  })

  it('refuses to approve empty text or text with unfilled placeholders', () => {
    const d = createDraft(base, 'fil', 'firm', vars)
    expect(() => approveDraft(editDraft(d, '   '), 'now')).toThrow()
    expect(() => approveDraft(editDraft(d, 'Hi {name}'), 'now')).toThrow()
  })
})
