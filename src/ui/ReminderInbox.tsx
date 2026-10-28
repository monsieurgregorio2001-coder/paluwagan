import { useEffect, useRef, useState } from 'react'
import { actions } from '../data/store'
import { formatStamp } from '../domain/dates'
import { draftLang, reminderTargets, type ReminderTarget } from '../domain/reminderPlan'
import { LANGS, LANG_LABEL, TEMPLATE_LABEL, TONES, TONE_LABEL, createDraft, draftId, type Draft, type DraftStatus, type Tone } from '../domain/reminders'
import type { Entry, Group } from '../domain/types'
import { Badge, ConfirmDialog, ErrorMsg } from './shared'

const STATUS: { key: DraftStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent', label: 'Sent (simulated)' },
]

interface Item { target: ReminderTarget; lang: (typeof LANGS)[number]; draft: Draft }

function itemsFor(group: Group, targets: ReminderTarget[], stored: Draft[]): Item[] {
  const out: Item[] = []
  for (const target of targets) {
    const base = { groupId: group.id, memberId: target.member.id, memberName: target.member.name, cycle: target.cycle }
    for (const lang of LANGS) {
      const s = stored.find((d) => d.id === draftId(group.id, target.member.id, target.cycle, lang))
      // A draft nobody edited is rebuilt from the ledger, so it always quotes what is owed now.
      const draft = s && (s.edited || s.status !== 'draft') ? s : createDraft(base, lang, s?.tone ?? target.suggested, target.vars)
      out.push({ target, lang, draft })
    }
  }
  // Sent drafts whose member no longer needs a reminder still belong in the log.
  for (const s of stored) if (s.status === 'sent' && !out.some((i) => i.draft.id === s.id)) out.push({ target: null as unknown as ReminderTarget, lang: s.lang, draft: s })
  return out
}

export function ReminderInbox({ group, entries, today, drafts }: { group: Group; entries: Entry[]; today: string; drafts: Draft[] }) {
  const [filter, setFilter] = useState<DraftStatus>('draft')
  const targets = reminderTargets(group, entries, today)
  const items = itemsFor(group, targets, drafts)
  const count = (s: DraftStatus) => items.filter((i) => i.draft.status === s).length
  const shownItems = items.filter((i) => i.draft.status === filter)
  return (
    <section className="card" aria-labelledby="inbox-h">
      <h2 id="inbox-h" className="card-title">Reminder inbox</h2>
      <p className="ai-label">{TEMPLATE_LABEL}</p>
      <div className="seg" role="group" aria-label="Reminder status">
        {STATUS.map((s) => (
          <button key={s.key} type="button" className="seg-btn" aria-pressed={filter === s.key} onClick={() => setFilter(s.key)}>{s.label} <span className="seg-count">{count(s.key)}</span></button>
        ))}
      </div>
      {shownItems.length === 0 ? (
        <p className="muted inbox-empty">
          {filter === 'draft' ? (targets.length === 0 ? 'No reminders to write. Everyone is paid up.' : 'No drafts waiting. Everything has been approved.') : filter === 'approved' ? 'Nothing is approved and waiting to send.' : 'Nothing has been sent yet. Sending is simulated.'}
        </p>
      ) : (
        <ul className="plain inbox">
          {shownItems.map((i) => <li key={i.draft.id}><DraftCard item={i} /></li>)}
        </ul>
      )}
    </section>
  )
}

function AutoText({ id, value, lang, label, onChange }: { id: string; value: string; lang: string; label: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} id={id} lang={lang} className="bubble-edit" aria-label={label} rows={1} value={value} onChange={(e) => onChange(e.target.value)} />
}

function DraftCard({ item }: { item: Item }) {
  const { draft, target } = item
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const id = `d-${draft.id.replace(/[^\w-]/g, '_')}`
  const stale = target && draft.status === 'draft' && !draft.text.includes(target.vars.amount)
  const setTone = (t: Tone) => { setError(null); actions.upsertDraft(createDraft({ groupId: draft.groupId, memberId: draft.memberId, memberName: draft.memberName, cycle: draft.cycle }, draft.lang, t, target.vars)) }
  const tone = draft.tone
  return (
    <div className="message">
      <div className="message-head">
        <div>
          <div className="to">To <strong>{draft.memberName}</strong>, cycle {draft.cycle}</div>
          <div className="small muted">{LANG_LABEL[draft.lang]}{target ? `. Quotes ${target.vars.amount} owed.` : ''}</div>
        </div>
        <Badge kind={draft.status === 'draft' ? 'neutral' : draft.status === 'approved' ? 'current' : 'paid'}>
          {draft.status === 'draft' ? 'Draft, needs approval' : draft.status === 'approved' ? 'Approved, ready to send' : 'Sent (simulated)'}
        </Badge>
      </div>
      {draft.status === 'draft' ? (
        <>
          <div className="field narrow">
            <label htmlFor={`${id}-tone`}>Tone (suggested: {TONE_LABEL[target.suggested]})</label>
            <select id={`${id}-tone`} value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
              {TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
            </select>
            {!draft.edited && <div className="small muted">Changing the tone replaces any edits to the text.</div>}
          </div>
          <div className="field">
            <AutoText id={id} value={draft.text} lang={draftLang(draft)} label={`Message in ${LANG_LABEL[draft.lang]} to ${draft.memberName}. You may edit before approving.`} onChange={(v) => setError(actions.editDraft(draft, v))} />
            <div className="small muted">You may edit the message before approving it.</div>
          </div>
          {stale && <div className="notice">This text no longer quotes {target.vars.amount}, the amount owed now. Change the tone to rebuild it.</div>}
        </>
      ) : (
        <p className="bubble" lang={draftLang(draft)}>{draft.text}</p>
      )}
      {draft.status === 'sent' && <p className="small muted">Approved {draft.approvedAt ? formatStamp(draft.approvedAt) : ''}. Sent {draft.sentAt ? formatStamp(draft.sentAt) : ''}. Simulated: nothing left this device.</p>}
      <ErrorMsg message={error} />
      <div className="row">
        {draft.status === 'draft' && <button type="button" className="btn primary" onClick={() => setConfirm(true)}>Approve</button>}
        {draft.status === 'approved' && <button type="button" className="btn primary" onClick={() => setError(actions.sendDraft(draft.id))}>Send (simulated)</button>}
        {draft.status === 'draft' && <span className="small muted">Send is available only after you approve.</span>}
      </div>
      <ConfirmDialog open={confirm} title={`Approve this reminder to ${draft.memberName}?`} confirmLabel="Approve reminder" onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); setError(actions.approveDraft(draft)) }}>
        <p>{target ? `It asks for ${target.vars.amount} for cycle ${draft.cycle}. ` : ''}After you approve it, the text cannot be edited. Sending is still a separate step, and it is simulated.</p>
        <blockquote className="quote" lang={draftLang(draft)}>{draft.text}</blockquote>
      </ConfirmDialog>
    </div>
  )
}
