import { useState } from 'react'
import { actions } from '../data/store'
import { formatDate, formatStamp } from '../domain/dates'
import { formatPHP } from '../domain/money'
import {
  AI_LABEL, LANGS, LANG_LABEL, TONES, TONE_LABEL, createDraft, draftId, needsReminder, suggestTone,
  type Draft, type Lang, type Tone,
} from '../domain/reminders'
import type { Entry, Group, Member } from '../domain/types'
import type { GroupInfo } from './groupInfo'
import { Badge, ErrorMsg, RiskBadge } from './shared'

interface Props { group: Group; entries: Entry[]; info: GroupInfo; today: string; drafts: Draft[] }

export function RiskTab({ group, info, drafts }: Props) {
  const sent = drafts.filter((d) => d.status === 'sent').sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))
  return (
    <>
      <section className="card" aria-labelledby="risk-h">
        <h2 id="risk-h">Late-payment risk</h2>
        <p className="small muted">
          Rule-based, from the last 4 due cycles. High: 2 or more missed, or 1 missed plus 1 late, or 3 or more late, or 7 or more days overdue now. Medium: 1 missed, 2 late, any delay of 7 or more days, or overdue now. Otherwise Low.
        </p>
      </section>
      {group.members.map((m) => {
        const risk = info.risks.get(m.id)!
        const cycle = info.outstanding.get(m.id) ?? null
        return (
          <section className="card" key={m.id} aria-labelledby={`r-${m.id}`}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 id={`r-${m.id}`} style={{ margin: 0 }}>{m.name}</h3>
              <RiskBadge level={risk.level} />
            </div>
            <ul style={{ margin: '8px 0 0', paddingLeft: '1.2rem' }}>
              {risk.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
            {needsReminder(risk) && (
              cycle === null ? (
                <p className="muted small" style={{ marginTop: 10 }}>No payment is outstanding, so no reminder is needed. Watch the next due date.</p>
              ) : (
                <Reminders group={group} member={m} cycle={cycle} dueDate={info.schedule[cycle - 1].dueDate} tone={suggestTone(risk)} drafts={drafts} />
              )
            )}
          </section>
        )
      })}
      <section className="card" aria-labelledby="sent-h">
        <h2 id="sent-h">Sent log</h2>
        <p className="small muted">Sending is simulated. Nothing leaves your device.</p>
        {sent.length === 0 ? <p className="muted">No reminders sent yet.</p> : (
          <ul className="plain">
            {sent.map((d) => (
              <li className="entry" key={d.id}>
                <div><strong>{d.memberName}</strong> <Badge kind="neutral">{LANG_LABEL[d.lang]}</Badge> <Badge kind="neutral">{TONE_LABEL[d.tone]}</Badge> <Badge kind="paid">Simulated send</Badge></div>
                <div className="small muted">Cycle {d.cycle}. Approved {d.approvedAt ? formatStamp(d.approvedAt) : ''}. Sent {d.sentAt ? formatStamp(d.sentAt) : ''}.</div>
                <p className="draft-text" style={{ marginTop: 6 }}>{d.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Reminders({ group, member, cycle, dueDate, tone: suggested, drafts }: { group: Group; member: Member; cycle: number; dueDate: string; tone: Tone; drafts: Draft[] }) {
  const stored = (lang: Lang) => drafts.find((d) => d.id === draftId(group.id, member.id, cycle, lang))
  const tone = stored('en')?.tone ?? suggested
  const locked = LANGS.some((l) => stored(l) && stored(l)!.status !== 'draft')
  const vars = { name: member.name, amount: formatPHP(group.contributionCentavos), dueDate: formatDate(dueDate), groupName: group.name }
  const base = { groupId: group.id, memberId: member.id, memberName: member.name, cycle }
  const [open, setOpen] = useState(false)

  const changeTone = (t: Tone) => LANGS.forEach((l) => actions.upsertDraft(createDraft(base, l, t, vars)))

  if (!open) {
    return (
      <div style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => setOpen(true)}>Show reminder drafts for cycle {cycle}</button>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: '0 0 4px' }}>Reminder drafts for cycle {cycle} (due {formatDate(dueDate)})</h4>
      <p className="ai-label">{AI_LABEL}</p>
      <div className="field" style={{ maxWidth: 240 }}>
        <label htmlFor={`tone-${member.id}`}>Tone (suggested: {TONE_LABEL[suggested]})</label>
        <select id={`tone-${member.id}`} value={tone} disabled={locked} onChange={(e) => changeTone(e.target.value as Tone)}>
          {TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
        </select>
        {!locked && <div className="small muted">Changing the tone replaces any edits to the text.</div>}
      </div>
      <div className="grid">
        {LANGS.map((lang) => {
          const s = stored(lang)
          const draft = s ?? createDraft(base, lang, tone, vars)
          return <DraftCard key={lang} draft={draft} label={LANG_LABEL[lang]} />
        })}
      </div>
    </div>
  )
}

function DraftCard({ draft, label }: { draft: Draft; label: string }) {
  const [error, setError] = useState<string | null>(null)
  const id = `d-${draft.id.replace(/[^\w-]/g, '_')}`
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h5 style={{ margin: 0, fontSize: '1rem' }}>{label}</h5>
        <Badge kind={draft.status === 'draft' ? 'neutral' : draft.status === 'approved' ? 'current' : 'paid'}>
          {draft.status === 'draft' ? 'Draft, needs approval' : draft.status === 'approved' ? 'Approved, ready to send' : 'Sent (simulated)'}
        </Badge>
      </div>
      {draft.status === 'draft' ? (
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor={id}>Message ({label}). You may edit before approving.</label>
          <textarea id={id} value={draft.text} onChange={(e) => setError(actions.editDraft(draft, e.target.value))} />
        </div>
      ) : (
        <p className="draft-text" style={{ marginTop: 8 }}>{draft.text}</p>
      )}
      <ErrorMsg message={error} />
      <div className="row">
        {draft.status === 'draft' && <button className="btn primary" onClick={() => setError(actions.approveDraft(draft))}>Approve</button>}
        {draft.status === 'approved' && <button className="btn primary" onClick={() => setError(actions.sendDraft(draft.id))}>Send (simulated)</button>}
      </div>
      {draft.status === 'draft' && <p className="small muted" style={{ margin: '8px 0 0' }}>Send is available only after you approve.</p>}
    </div>
  )
}
