import { describe, expect, it } from 'vitest'
import { buildSeed } from '../data/seed'
import { allDraftsFor, detectLanguage, reminderTargets, scoreDraft } from './reminderPlan'
import { approveDraft, createDraft, sendDraft, type Draft, type DraftStatus } from './reminders'
import { cycleOutstanding, recordContribution } from './ledger'
import { outstandingCycle } from './risk'
import { buildSchedule } from './rotation'
import { randomGroup } from './simulate'

const TODAY = '2026-06-10'

describe('outstanding cycle and amount', () => {
  it('counts a short payment as outstanding and quotes the remainder', () => {
    const g = buildSeed(TODAY).groups[0]
    const sched = buildSchedule(g)
    const m = g.members[0].id
    const entries = recordContribution([], { cycle: 1, memberId: m, status: 'on_time', amount: 60_000, expected: g.contributionCentavos, dueDate: sched[0].dueDate }, '2026-01-01T00:00:00Z')
    const today = sched[0].dueDate
    expect(outstandingCycle(sched, entries, m, today)).toBe(null)
    // The current cycle is not overdue on its due date, so move to the day after.
    const tomorrow = sched[0].dueDate.replace(/\d\d$/, (d) => String(Number(d) + 1).padStart(2, '0'))
    expect(outstandingCycle(sched, entries, m, tomorrow)).toBe(1)
    expect(cycleOutstanding(entries, m, 1, g.contributionCentavos)).toBe(40_000)
  })
})

describe('reminder rubric', () => {
  it('scores every draft of the seeded groups four for four', () => {
    const seed = buildSeed(TODAY)
    let drafts = 0
    for (const g of seed.groups) {
      const entries = seed.ledgers[g.id]
      for (const t of reminderTargets(g, entries, TODAY)) {
        for (const d of allDraftsFor(g, t)) {
          drafts++
          expect(scoreDraft(g, t, d), `${g.name} ${d.id} ${d.tone}`).toEqual({ amount: true, language: true, noExtraFacts: true, nameAndCycle: true })
        }
      }
    }
    expect(drafts).toBeGreaterThan(0)
  })

  it('catches a wrong amount, a wrong language tag, an extra fact and a wrong name', () => {
    const seed = buildSeed(TODAY)
    const g = seed.groups[0]
    const t = reminderTargets(g, seed.ledgers[g.id], TODAY)[0]
    const d = allDraftsFor(g, t).find((x) => x.lang === 'en' && x.tone === 'polite')!
    expect(scoreDraft(g, t, { ...d, text: d.text.replace(/₱[\d,]+\.\d{2}/, '₱1.00') }).amount).toBe(false)
    expect(scoreDraft(g, t, { ...d, lang: 'fil' }).language).toBe(false)
    expect(scoreDraft(g, t, { ...d, text: d.text + ' You also missed 3 cycles.' }).noExtraFacts).toBe(false)
    expect(scoreDraft(g, t, { ...d, memberName: 'Someone Else' }).nameAndCycle).toBe(false)
    expect(scoreDraft(g, t, { ...d, cycle: t.cycle + 1 }).nameAndCycle).toBe(false)
  })

  it('detects English and Filipino text', () => {
    expect(detectLanguage('Please send your contribution to the group.')).toBe('en')
    expect(detectLanguage('Maraming salamat po sa kontribusyon ninyo.')).toBe('fil')
  })

  it('scores every draft on randomized member states', () => {
    let drafts = 0
    for (let seed = 1; seed <= 150; seed++) {
      const { group, entries, today } = randomGroup(seed)
      for (const t of reminderTargets(group, entries, today)) {
        for (const d of allDraftsFor(group, t)) {
          drafts++
          expect(scoreDraft(group, t, d), `seed ${seed} ${d.id} ${d.lang} ${d.tone}`).toEqual({ amount: true, language: true, noExtraFacts: true, nameAndCycle: true })
        }
      }
    }
    expect(drafts).toBeGreaterThan(500)
  })
})

describe('nothing sends without approval', () => {
  const base = { groupId: 'g', memberId: 'm', memberName: 'Liza', cycle: 2 }
  const vars = { name: 'Liza', amount: '₱1.00', dueDate: 'Jan 1, 2026', groupName: 'G', cycle: '2' }
  it('throws for every status except approved', () => {
    const draft = createDraft(base, 'en', 'polite', vars)
    for (const status of ['draft', 'sent'] as DraftStatus[]) {
      const d: Draft = { ...draft, status }
      expect(() => sendDraft(d, 'now')).toThrow()
    }
    expect(sendDraft(approveDraft(draft, 'now'), 'later').status).toBe('sent')
  })
})
