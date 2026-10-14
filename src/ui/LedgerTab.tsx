import { useState, type FormEvent } from 'react'
import { actions } from '../data/store'
import { formatDate, formatStamp } from '../domain/dates'
import { activePayout, effectiveContribution, isActive, reversedIds } from '../domain/ledger'
import { formatPHP, parsePesos } from '../domain/money'
import type { ContributionStatus, Entry, Group } from '../domain/types'
import type { GroupInfo } from './groupInfo'
import { Badge, ErrorMsg } from './shared'

const STATUS_LABEL: Record<ContributionStatus, string> = { on_time: 'Paid on time', late: 'Paid late', missed: 'Missed' }

export function LedgerTab({ group, entries, info, today }: { group: Group; entries: Entry[]; info: GroupInfo; today: string }) {
  const [cycle, setCycle] = useState(info.cycle)
  const row = info.schedule[cycle - 1]
  const [memberId, setMemberId] = useState(group.members[0].id)
  const [status, setStatus] = useState<ContributionStatus>('on_time')
  const [paidDate, setPaidDate] = useState(today)
  const [amount, setAmount] = useState(formatPHP(group.contributionCentavos).replace('₱', '').replace(/,/g, ''))
  const [error, setError] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [reversing, setReversing] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [revError, setRevError] = useState<string | null>(null)
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id

  const rev = reversedIds(entries)
  const payout = activePayout(entries, cycle)
  const defaultPayout = Math.min(info.potSize, info.potBalance)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const centavos = status === 'missed' ? 0 : parsePesos(amount)
    if (centavos === null) return setError('Enter the amount in pesos, for example 1,000.00.')
    const err = actions.recordContribution(group.id, {
      cycle, memberId, status, amount: centavos, dueDate: row.dueDate,
      paidDate: status === 'on_time' ? row.dueDate : status === 'late' ? paidDate : undefined,
    })
    setError(err)
  }

  const doPayout = () => setPayError(actions.recordPayout(group.id, { cycle, memberId: row.recipient.id, amount: defaultPayout, note: 'Pot released to recipient' }))

  const doReverse = (id: string) => {
    const err = actions.reverse(group.id, id, reason)
    setRevError(err)
    if (!err) { setReversing(null); setReason('') }
  }

  return (
    <>
      <section className="card" aria-labelledby="cyc-h">
        <h2 id="cyc-h">Contributions by cycle</h2>
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="cycle-sel">Cycle</label>
          <select id="cycle-sel" value={cycle} onChange={(e) => setCycle(Number(e.target.value))}>
            {info.schedule.map((r) => (
              <option key={r.cycle} value={r.cycle}>{`Cycle ${r.cycle}, due ${formatDate(r.dueDate)}, ${r.recipient.name} receives`}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Member</th><th scope="col">Status</th><th scope="col" className="num">Amount</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {group.members.map((m) => {
                const e = effectiveContribution(entries, m.id, cycle)
                return (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>
                      {e?.status ? <Badge kind={e.status}>{STATUS_LABEL[e.status]}{e.status === 'late' ? ` (${e.daysLate} d)` : ''}</Badge> : <Badge kind="neutral">Not recorded</Badge>}
                    </td>
                    <td className="num">{e && e.amount ? formatPHP(e.amount) : ''}</td>
                    <td>
                      {(!e || e.status === 'missed') && (
                        <button className="btn small" onClick={() => { setMemberId(m.id); document.getElementById('rec-member')?.focus() }} aria-label={`Record payment for ${m.name}`}>Record</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <form className="card" onSubmit={submit} aria-labelledby="rec-h" noValidate>
        <h2 id="rec-h">Record a contribution for cycle {cycle}</h2>
        <div className="grid">
          <div className="field">
            <label htmlFor="rec-member">Member</label>
            <select id="rec-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {group.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rec-status">Result</label>
            <select id="rec-status" value={status} onChange={(e) => setStatus(e.target.value as ContributionStatus)}>
              <option value="on_time">Paid on time</option>
              <option value="late">Paid late</option>
              <option value="missed">Missed</option>
            </select>
          </div>
          {status === 'late' && (
            <div className="field">
              <label htmlFor="rec-date">Date paid (after {formatDate(row.dueDate)})</label>
              <input id="rec-date" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
          )}
          {status !== 'missed' && (
            <div className="field">
              <label htmlFor="rec-amt">Amount in PHP</label>
              <input id="rec-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
        </div>
        <ErrorMsg message={error} />
        <button className="btn primary" type="submit">Add ledger entry</button>
      </form>

      <section className="card" aria-labelledby="pay-h">
        <h2 id="pay-h">Payout for cycle {cycle}</h2>
        {payout ? (
          <p>{row.recipient.name} was paid {formatPHP(payout.amount)}. To correct it, reverse the payout entry below.</p>
        ) : (
          <>
            <p>Recipient: <strong>{row.recipient.name}</strong>. Amount available to pay out: <strong>{formatPHP(defaultPayout)}</strong> of a full pot of {formatPHP(info.potSize)}.</p>
            {defaultPayout < info.potSize && <p className="notice">The pot is short because some contributions are missing. The payout is limited to what the ledger holds.</p>}
            <ErrorMsg message={payError} />
            <button className="btn primary" onClick={doPayout} disabled={defaultPayout <= 0}>Record payout</button>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="log-h">
        <h2 id="log-h">Ledger entries</h2>
        <p className="small muted">Entries are append-only. Nothing is edited or deleted. A mistake is fixed by adding a reversing entry.</p>
        <ErrorMsg message={revError} />
        {entries.length === 0 && <p className="muted">No entries yet.</p>}
        <ul className="plain">
          {[...entries].reverse().map((e) => {
            const done = e.type !== 'reversal' && rev.has(e.id)
            return (
              <li key={e.id} className={`entry${done ? ' reversed' : ''}`}>
                <div className="entry-main">
                  <strong>{e.id}</strong>{' '}
                  {e.type === 'reversal' ? <Badge kind="reversal">Reversal of {e.reverses}</Badge>
                    : e.type === 'payout' ? <Badge kind="paid">Payout</Badge>
                    : <Badge kind={e.status ?? 'neutral'}>{e.status ? STATUS_LABEL[e.status] : 'Contribution'}</Badge>}{' '}
                  {nameOf(e.memberId)}, cycle {e.cycle}, {e.type === 'reversal' ? (e.reversedType === 'payout' ? '+' : '-') : e.type === 'payout' ? '-' : '+'}{formatPHP(e.amount)}
                </div>
                <div className="small muted">
                  {formatStamp(e.ts)}{e.paidDate && e.status === 'late' ? `, paid ${formatDate(e.paidDate)}` : ''}{e.note ? `, ${e.note}` : ''}{done ? ', reversed' : ''}
                </div>
                {isActive(e, rev) && reversing !== e.id && (
                  <button className="btn small" style={{ marginTop: 6 }} onClick={() => { setReversing(e.id); setReason(''); setRevError(null) }} aria-label={`Reverse entry ${e.id}`}>Reverse</button>
                )}
                {reversing === e.id && (
                  <div style={{ marginTop: 6 }}>
                    <label htmlFor={`why-${e.id}`}>Reason for reversing {e.id}</label>
                    <input id={`why-${e.id}`} value={reason} onChange={(ev) => setReason(ev.target.value)} autoFocus />
                    <div className="row" style={{ marginTop: 6 }}>
                      <button className="btn small danger" onClick={() => doReverse(e.id)}>Add reversing entry</button>
                      <button className="btn small" onClick={() => { setReversing(null); setRevError(null) }}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
