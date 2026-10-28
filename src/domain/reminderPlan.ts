import { formatDate } from './dates'
import { cycleOutstanding } from './ledger'
import { formatPHP } from './money'
import { LANGS, TONES, createDraft, needsReminder, suggestTone, type Draft, type Lang, type ReminderVars, type Tone } from './reminders'
import { assessRisk, buildHistory, outstandingCycle } from './risk'
import { buildSchedule } from './rotation'
import type { Entry, Group, Member } from './types'

export interface ReminderTarget {
  member: Member
  /** The cycle the member still owes for. */
  cycle: number
  dueDate: string
  suggested: Tone
  /** Centavos still owed for that cycle. */
  outstanding: number
  vars: ReminderVars
}

/** Members who need a reminder, with the cycle and amount they still owe. The single place reminder facts come from. */
export function reminderTargets(group: Group, entries: readonly Entry[], today: string): ReminderTarget[] {
  const schedule = buildSchedule(group)
  const out: ReminderTarget[] = []
  for (const member of group.members) {
    const risk = assessRisk(buildHistory(schedule, entries, member.id, today))
    if (!needsReminder(risk)) continue
    const cycle = outstandingCycle(schedule, entries, member.id, today)
    if (cycle === null) continue
    const outstanding = cycleOutstanding(entries, member.id, cycle, group.contributionCentavos)
    if (outstanding <= 0) continue
    const dueDate = schedule[cycle - 1].dueDate
    out.push({
      member, cycle, dueDate, suggested: suggestTone(risk), outstanding,
      vars: { name: member.name, amount: formatPHP(outstanding), dueDate: formatDate(dueDate), groupName: group.name, cycle: String(cycle) },
    })
  }
  return out
}

/** Every draft the app can produce for a target: both languages in every tone. */
export function allDraftsFor(group: Group, t: ReminderTarget): Draft[] {
  const base = { groupId: group.id, memberId: t.member.id, memberName: t.member.name, cycle: t.cycle }
  const out: Draft[] = []
  for (const lang of LANGS) for (const tone of TONES) out.push(createDraft(base, lang, tone, t.vars))
  return out
}

/** The language tag a reader or screen reader should get for a draft. */
export const draftLang = (d: Pick<Draft, 'lang'>): Lang => d.lang

// ---- Reminder rubric (evals/reminders.md) ----

export interface RubricResult { amount: boolean; language: boolean; noExtraFacts: boolean; nameAndCycle: boolean }

const FIL_WORDS = new Set(['po', 'ang', 'ng', 'sa', 'na', 'ay', 'namin', 'ninyo', 'ito', 'hindi', 'kung', 'para', 'kontribusyon', 'paalala', 'salamat', 'muna', 'natin', 'natatanggap', 'pakibayaran', 'kayo', 'ngayong', 'mga'])
const EN_WORDS = new Set(['the', 'your', 'to', 'was', 'is', 'and', 'please', 'you', 'if', 'we', 'have', 'not', 'it', 'for', 'of', 'thank', 'a', 'will', 'our'])

/** Which language a text is written in, by counting common words. Null when the counts tie. */
export function detectLanguage(text: string): Lang | null {
  const words = text.toLowerCase().match(/[a-zñ]+/g) ?? []
  const fil = words.filter((w) => FIL_WORDS.has(w)).length
  const en = words.filter((w) => EN_WORDS.has(w)).length
  return fil === en ? null : fil > en ? 'fil' : 'en'
}

/**
 * Scores one draft against the member record on four rules. The target is rebuilt from the ledger, not read from the draft,
 * so a draft cannot vouch for itself. Tone is not scored.
 */
export function scoreDraft(group: Group, t: ReminderTarget, d: Draft): RubricResult {
  const text = d.text
  const amounts = text.match(/₱[\d,]+\.\d{2}/g) ?? []
  const amount = amounts.length >= 1 && amounts.every((a) => a === formatPHP(t.outstanding))
  const language = draftLang(d) === detectLanguage(text)
  // Facts allowed in the text: the member's name, the group, the one amount, the due date and the cycle. Nothing else with a digit or a number word.
  let rest = text
  for (const known of [t.member.name, group.name, formatPHP(t.outstanding), formatDate(t.dueDate)]) rest = rest.split(known).join(' ')
  rest = rest.replace(new RegExp(`cycle ${t.cycle}\\b`, 'gi'), ' ')
  const noExtraFacts = !/\d/.test(rest) && !/\b(one|two|three|four|five|six|seven|ten|days?|dalawang|tatlong|apat|limang|linggo|weeks?)\b/i.test(rest) && !/₱/.test(rest)
  const nameAndCycle = d.memberName === t.member.name && d.memberId === t.member.id && text.includes(t.member.name) && d.cycle === t.cycle && new RegExp(`\\bcycle ${t.cycle}\\b`, 'i').test(text) && text.includes(formatDate(t.dueDate))
  return { amount, language, noExtraFacts, nameAndCycle }
}
