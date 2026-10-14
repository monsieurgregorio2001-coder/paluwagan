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
import { arrearsItems } from '../domain/ledger'
import { Badge, ErrorMsg, Money, RiskBadge } from './shared'

interface Props { group: Group; entries: Entry[]; info: GroupInfo; today: string; drafts: Draft[] }

export function RiskTab({ group, entries, info, drafts }: Props) {
  const sent = drafts.filter((d) => d.status === 'sent').sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))
  return (
    <>
      <section className="card" aria-labelledby="risk-h">
        <h2 id="risk-h" className="card-title">Late-payment risk</h2>
        <p className="small muted">
          Rule-based, from the last 4 due cycles. High means 2 or more missed, 1 missed plus 1 late, 3 or more late, or 7 or more days overdue now. Medium means 1 missed, 2 late, any delay of 7 or more days, or overdue now. Everything else is Low.
        </p>
      </section>
      <div className="grid risk-grid">
        {group.members.map((m) => {
          const risk = info.risks.get(m.id)!
          const cycle = info.outstanding.get(m.id) ?? null
          const owing = arrearsItems(entries).filter((a) => a.memberId === m.id && a.outstanding > 0)
          const total = owing.reduce((t, a) => t + a.outstanding, 0)
          return (
            <section className={`card risk-card${needsReminder(risk) ? ' wide' : ''}`} key={m.id} aria-labelledby={`r-${m.id}`}>
              <div className="card-head">
                <h3 id={`r-${m.id}`}>{m.name}</h3>
                <RiskBadge level={risk.level} />
              </div>
              <ul className="reasons">
                {risk.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {total > 0 && (
                <div className="arrears-box">
                  <div>
                    <div className="label">Arrears owed</div>
                    <div className="value"><Money value={total} /></div>
                    <div className="small muted">{owing.map((a) => `cycle ${a.cycle}`).join(', ')}. The recipient&apos;s payout was short by this amount.</div>
                  </div>
                  <a className="btn small" href={`#/g/${group.id}/ledger/arrears-${m.id}`} aria-label={`Record arrears payment for ${m.name}`}>Record arrears payment</a>
                </div>
              )}
              {needsReminder(risk) && (
                cycle === null ? (
                  <p className="muted small">No payment is outstanding, so no reminder is needed. Watch the next due date.</p>
                ) : (
                  <Reminders group={group} member={m} cycle={cycle} dueDate={info.schedule[cycle - 1].dueDate} tone={suggestTone(risk)} drafts={drafts} />
                )
              )}
            </section>
          )
        })}
      </div>
      <section className="card" aria-labelledby="sent-h">
        <h2 id="sent-h" className="card-title">Sent log</h2>
        <p className="small muted">Sending is simulated. Nothing leaves your device.</p>
        {sent.length === 0 ? <p className="muted">No reminders sent yet.</p> : (
          <ul className="plain">
            {sent.map((d) => (
              <li className="sent-item" key={d.id}>
                <div className="chips"><strong>{d.memberName}</strong> <Badge kind="neutral">{LANG_LABEL[d.lang]}</Badge> <Badge kind="neutral">{TONE_LABEL[d.tone]}</Badge> <Badge kind="paid">Simulated send</Badge></div>
                <div className="small muted">Cycle {d.cycle}. Approved {d.approvedAt ? formatStamp(d.approvedAt) : ''}. Sent {d.sentAt ? formatStamp(d.sentAt) : ''}.</div>
                <p className="bubble sent">{d.text}</p>
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
      <div className="reminder-open">
        <button className="btn" onClick={() => setOpen(true)}>Show reminder drafts for cycle {cycle}</button>
      </div>
    )
  }
  return (
    <div className="reminders">
      <h4>Reminder drafts for cycle {cycle}, due {formatDate(dueDate)}</h4>
      <p className="ai-label">{AI_LABEL}</p>
      <div className="field narrow">
        <label htmlFor={`tone-${member.id}`}>Tone (suggested: {TONE_LABEL[suggested]})</label>
        <select id={`tone-${member.id}`} value={tone} disabled={locked} onChange={(e) => changeTone(e.target.value as Tone)}>
          {TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
        </select>
        {!locked && <div className="small muted">Changing the tone replaces any edits to the text.</div>}
      </div>
      <div className="grid messages">
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
    <div className="message">
      <div className="message-head">
        <div>
          <div className="to">To <strong>{draft.memberName}</strong></div>
          <div className="small muted">{label}</div>
        </div>
        <Badge kind={draft.status === 'draft' ? 'neutral' : draft.status === 'approved' ? 'current' : 'paid'}>
          {draft.status === 'draft' ? 'Draft, needs approval' : draft.status === 'approved' ? 'Approved, ready to send' : 'Sent (simulated)'}
        </Badge>
      </div>
      {draft.status === 'draft' ? (
        <div className="field">
          <label htmlFor={id} className="sr-only">Message ({label}). You may edit before approving.</label>
          <textarea id={id} className="bubble-edit" value={draft.text} onChange={(e) => setError(actions.editDraft(draft, e.target.value))} />
          <div className="small muted">You may edit the message before approving it.</div>
        </div>
      ) : (
        <p className="bubble">{draft.text}</p>
      )}
      <ErrorMsg message={error} />
      <div className="row">
        {draft.status === 'draft' && <button className="btn primary" onClick={() => setError(actions.approveDraft(draft))}>Approve</button>}
        {draft.status === 'approved' && <button className="btn primary" onClick={() => setError(actions.sendDraft(draft.id))}>Send (simulated)</button>}
        {draft.status === 'draft' && <span className="small muted">Send is available only after you approve.</span>}
      </div>
    </div>
  )
}
