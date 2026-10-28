import type { RiskAssessment } from './risk'

export type Lang = 'en' | 'fil'
export type Tone = 'polite' | 'firm' | 'final'

export interface ReminderVars {
  name: string
  amount: string
  dueDate: string
  groupName: string
}

export const LANGS: Lang[] = ['en', 'fil']
export const TONES: Tone[] = ['polite', 'firm', 'final']
export const LANG_LABEL: Record<Lang, string> = { en: 'English', fil: 'Filipino' }
export const TONE_LABEL: Record<Tone, string> = { polite: 'Polite', firm: 'Firm', final: 'Final' }

export const AI_LABEL = 'Pre-written reminder template. You edit and approve it before it can be sent. Sending is simulated.'

/** Pre-written templates. Nothing here calls a model at runtime. */
export const TEMPLATES: Record<Lang, Record<Tone, string>> = {
  en: {
    polite:
      'Hi {name}, a friendly reminder that your contribution of {amount} to {groupName} was due on {dueDate}. ' +
      'If you have already paid, please ignore this message. Otherwise, could you send it when you are able? Thank you very much!',
    firm:
      'Hello {name}, your contribution of {amount} to {groupName} was due on {dueDate} and we have not received it yet. ' +
      'Please pay as soon as possible so the pot can be released on time to the recipient for this cycle. Please let us know if there is a problem.',
    final:
      '{name}, this is our final reminder. The {amount} contribution to {groupName} due on {dueDate} is still unpaid. ' +
      'If we do not receive it within two days, the group will need to discuss how to handle it. We would much prefer to sort this out with you first. Thank you.',
  },
  fil: {
    polite:
      'Magandang araw, {name}! Paalala lang po na ang kontribusyon ninyo na {amount} para sa {groupName} ay due noong {dueDate}. ' +
      'Kung nabayaran na po ninyo, pasensya na sa abala. Kung hindi pa, maaari po bang maipadala kapag may pagkakataon na? Maraming salamat po!',
    firm:
      'Kumusta, {name}. Lampas na po sa takdang petsa ({dueDate}) ang kontribusyon ninyo na {amount} sa {groupName} at hindi pa po namin ito natatanggap. ' +
      'Pakibayaran po sa lalong madaling panahon para maibigay sa tamang oras ang pot sa tatanggap ngayong cycle. Sabihin lang po sa amin kung may problema.',
    final:
      '{name}, ito na po ang huling paalala. Hindi pa rin po namin natatanggap ang {amount} para sa {groupName} na due noong {dueDate}. ' +
      'Kung hindi ito maisasaayos sa loob ng dalawang araw, kailangan po itong pag-usapan ng grupo. Mas gusto po naming maayos muna natin ito. Salamat po sa pang-unawa.',
  },
}

const PLACEHOLDER = /\{(\w+)\}/g

/** Replaces every {variable}. Throws if the template uses a variable that was not supplied. */
export function fillTemplate(template: string, vars: ReminderVars): string {
  return template.replace(PLACEHOLDER, (_m, key: string) => {
    if (!(key in vars)) throw new Error(`Unknown template variable: ${key}`)
    return vars[key as keyof ReminderVars]
  })
}

/** Returns any {placeholders} still present in text. */
export function leftoverPlaceholders(text: string): string[] {
  return Array.from(text.matchAll(PLACEHOLDER), (m) => m[0])
}

/** Members at Medium or High risk get reminders. Low risk gets none. */
export function needsReminder(a: RiskAssessment): boolean {
  return a.level !== 'Low'
}

export function suggestTone(a: RiskAssessment): Tone {
  if (a.level === 'High' && (a.stats.missed >= 2 || a.stats.overdueDays >= 14)) return 'final'
  if (a.level === 'High' || a.stats.overdueDays >= 3) return 'firm'
  return 'polite'
}

export type DraftStatus = 'draft' | 'approved' | 'sent'

export interface Draft {
  id: string
  groupId: string
  memberId: string
  memberName: string
  cycle: number
  lang: Lang
  tone: Tone
  text: string
  edited: boolean
  status: DraftStatus
  approvedAt?: string
  sentAt?: string
}

export function draftId(groupId: string, memberId: string, cycle: number, lang: Lang): string {
  return `${groupId}:${memberId}:${cycle}:${lang}`
}

export function createDraft(
  base: Pick<Draft, 'groupId' | 'memberId' | 'memberName' | 'cycle'>,
  lang: Lang,
  tone: Tone,
  vars: ReminderVars,
): Draft {
  return {
    ...base,
    id: draftId(base.groupId, base.memberId, base.cycle, lang),
    lang,
    tone,
    text: fillTemplate(TEMPLATES[lang][tone], vars),
    edited: false,
    status: 'draft',
  }
}

/** Edits are only allowed before approval. */
export function editDraft(d: Draft, text: string): Draft {
  if (d.status !== 'draft') throw new Error('Only drafts that are not yet approved can be edited.')
  return { ...d, text, edited: true }
}

export function approveDraft(d: Draft, now: string): Draft {
  if (d.status !== 'draft') throw new Error('Only a draft can be approved.')
  if (!d.text.trim()) throw new Error('The message is empty.')
  const left = leftoverPlaceholders(d.text)
  if (left.length) throw new Error(`Fill in ${left.join(', ')} before approving.`)
  return { ...d, status: 'approved', approvedAt: now }
}

/** Simulated send. Requires explicit human approval first. Nothing is transmitted. */
export function sendDraft(d: Draft, now: string): Draft {
  if (d.status !== 'approved') throw new Error('A reminder must be approved by a person before it can be sent.')
  return { ...d, status: 'sent', sentAt: now }
}
