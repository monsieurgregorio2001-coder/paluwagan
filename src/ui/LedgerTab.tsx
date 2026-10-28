import { useEffect, useState, type FormEvent } from 'react'
import { actions } from '../data/store'
import { formatDate, formatStamp } from '../domain/dates'
import { activePayout, effectiveContribution, isActive, reversedIds } from '../domain/ledger'
import { formatPHP, parsePesos } from '../domain/money'
import type { ContributionStatus, Entry, Group } from '../domain/types'
import type { GroupInfo } from './groupInfo'
import { Badge, ConfirmDialog, ErrorMsg, Money } from './shared'

const STATUS_LABEL: Record<ContributionStatus, string> = { on_time: 'Paid on time', late: 'Paid late', missed: 'Missed' }
const plain = (c: number) => formatPHP(c).replace(/,/g, '')

export function LedgerTab({ group, entries, info, today, focus }: { group: Group; entries: Entry[]; info: GroupInfo; today: string; focus?: string }) {
  const [cycle, setCycle] = useState(info.cycle)
  const row = info.schedule[cycle - 1]
  const [memberId, setMemberId] = useState(group.members[0].id)
  const [status, setStatus] = useState<ContributionStatus>('on_time')
  const [paidDate, setPaidDate] = useState(today)
  const [amount, setAmount] = useState(plain(group.contributionCentavos).replace('₱', ''))
  const [error, setError] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [reversing, setReversing] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [revError, setRevError] = useState<string | null>(null)
  const [confirmPayout, setConfirmPayout] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id

  const open = info.arrears.filter((a) => a.outstanding > 0)
  const wanted = focus?.startsWith('arrears-') ? open.find((a) => a.memberId === focus.slice(8)) : undefined
  const [arrKey, setArrKey] = useState<string>(() => {
    const first = wanted ?? open[0]
    return first ? `${first.memberId}|${first.cycle}` : ''
  })
  const [arrAmount, setArrAmount] = useState('')
  const [arrError, setArrError] = useState<string | null>(null)
  const [arrDone, setArrDone] = useState<string | null>(null)
  const selected = open.find((a) => `${a.memberId}|${a.cycle}` === arrKey) ?? open[0]

  // An error belongs to the thing that caused it. Changing what you are working on clears it.
  useEffect(() => { setError(null); setPayError(null) }, [cycle, memberId, status, amount, paidDate])
  useEffect(() => { setArrError(null); setArrDone(null) }, [arrKey, arrAmount])
  useEffect(() => { setRevError(null) }, [reversing, reason])

  useEffect(() => {
    if (focus?.startsWith('arrears')) document.getElementById('arrears-h')?.scrollIntoView({ block: 'start' })
  }, [focus])

  const rev = reversedIds(entries)
  const payout = activePayout(entries, cycle)
  const defaultPayout = Math.min(info.potSize, info.potBalance)

  const parsedAmount = status === 'missed' ? 0 : parsePesos(amount)
  const shortBy = parsedAmount === null ? 0 : Math.max(0, group.contributionCentavos - parsedAmount)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const centavos = status === 'missed' ? 0 : parsePesos(amount)
    if (centavos === null) return setError('Enter the amount in pesos, for example 1,000.00.')
    const err = actions.recordContribution(group.id, {
      cycle, memberId, status, amount: centavos, expected: group.contributionCentavos, dueDate: row.dueDate,
      paidDate: status === 'on_time' ? row.dueDate : status === 'late' ? paidDate : undefined,
    })
    setError(err)
  }

  const doPayout = () => { setConfirmPayout(false); setPayError(actions.recordPayout(group.id, { cycle, memberId: row.recipient.id, amount: defaultPayout, note: 'Pot released to recipient' })) }

  const submitArrears = (e: FormEvent) => {
    e.preventDefault()
    setArrDone(null)
    if (!selected) return setArrError('There are no arrears to settle.')
    const text = arrAmount.trim() === '' ? plain(selected.outstanding).replace('₱', '') : arrAmount
    const centavos = parsePesos(text)
    if (centavos === null) return setArrError('Enter the amount in pesos, for example 1,000.00.')
    const err = actions.recordArrears(group.id, { cycle: selected.cycle, memberId: selected.memberId, amount: centavos })
    setArrError(err)
    if (!err) {
      setArrAmount('')
      setArrDone(`Recorded ${formatPHP(centavos)} from ${nameOf(selected.memberId)} for cycle ${selected.cycle}.`)
    }
  }

  const doReverse = (id: string) => {
    const err = actions.reverse(group.id, id, reason)
    setRevError(err)
    if (!err) { setReversing(null); setReason('') }
  }

  const sign = (e: Entry) => (e.type === 'reversal' ? (e.reversedType === 'payout' ? '+' : '-') : e.type === 'payout' ? '-' : '+')

  return (
    <>
      <section className="card" aria-labelledby="cyc-h">
        <h2 id="cyc-h" className="card-title">Contributions by cycle</h2>
        <div className="field narrow">
          <label htmlFor="cycle-sel">Cycle</label>
          <select id="cycle-sel" value={cycle} onChange={(e) => setCycle(Number(e.target.value))}>
            {info.schedule.map((r) => (
              <option key={r.cycle} value={r.cycle}>{`Cycle ${r.cycle}, due ${formatDate(r.dueDate)}, ${r.recipient.name} receives`}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table className="stack">
            <thead><tr><th scope="col">Member</th><th scope="col">Status</th><th scope="col" className="num">Amount</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {group.members.map((m) => {
                const e = effectiveContribution(entries, m.id, cycle)
                const owing = open.find((a) => a.memberId === m.id && a.cycle === cycle)
                return (
                  <tr key={m.id}>
                    <td data-label="Member">{m.name}</td>
                    <td data-label="Status">
                      {e?.status ? <Badge kind={e.status}>{STATUS_LABEL[e.status]}{e.status === 'late' ? ` (${e.daysLate} d)` : ''}</Badge> : <Badge kind="neutral">Not recorded</Badge>}
                      {owing && <div className="small status-note"><Money value={owing.outstanding} /> arrears owed</div>}
                    </td>
                    <td data-label="Amount" className="num">{e && e.amount ? <Money value={e.amount} /> : ''}</td>
                    <td data-label="" className="action-cell">
                      {owing ? (
                        <button className="btn small" onClick={() => { setArrKey(`${m.id}|${cycle}`); document.getElementById('arrears-h')?.scrollIntoView({ block: 'start' }) }} aria-label={`Settle arrears for ${m.name}`}>Settle arrears</button>
                      ) : !e ? (
                        <button className="btn small" onClick={() => { setMemberId(m.id); document.getElementById('rec-member')?.focus() }} aria-label={`Record payment for ${m.name}`}>Record</button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <form className="card" onSubmit={submit} aria-labelledby="rec-h" noValidate>
        <h2 id="rec-h" className="card-title">Record a contribution for cycle {cycle}</h2>
        <div className="grid form-grid">
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
              <input id="rec-amt" className="mono-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
        </div>
        {(status === 'missed' || shortBy > 0) && (
          <p className="notice">
            {nameOf(memberId)} will owe <Money value={status === 'missed' ? group.contributionCentavos : shortBy} /> in arrears, and the payout to {row.recipient.name} will be short by that amount.
          </p>
        )}
        <ErrorMsg message={error} />
        <button className="btn primary" type="submit">Add ledger entry</button>
      </form>

      <section className="card" aria-labelledby="pay-h">
        <h2 id="pay-h" className="card-title">Payout for cycle {cycle}</h2>
        {payout ? (
          <p>{row.recipient.name} was paid <Money value={payout.amount} />. To correct it, reverse the payout entry below.</p>
        ) : (
          <>
            <p>Recipient: <strong>{row.recipient.name}</strong>. Available to pay out: <Money value={defaultPayout} /> of a full pot of <Money value={info.potSize} />.</p>
            {defaultPayout < info.potSize && <p className="notice">The pot is short because some contributions are missing. The payout is limited to what the ledger holds, and the missing amount stays as arrears.</p>}
            <ErrorMsg message={payError} />
            <button className="btn primary" onClick={() => (defaultPayout < info.potSize ? setConfirmPayout(true) : doPayout())} disabled={defaultPayout <= 0}>Record payout</button>
            <ConfirmDialog open={confirmPayout} title="Release a short pot?" confirmLabel="Release short pot" onCancel={() => setConfirmPayout(false)} onConfirm={doPayout}>
              <p>{row.recipient.name} would receive <Money value={defaultPayout} /> of a full pot of <Money value={info.potSize} />. Short by <Money value={info.potSize - defaultPayout} />. A payout can only be corrected with a reversal.</p>
            </ConfirmDialog>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="arrears-h">
        <h2 id="arrears-h" className="card-title">Arrears</h2>
        <p className="small muted">
          When a member misses or underpays, the shortfall is owed by that member. Paying it is an append-only entry. If the payout was already made, the money is passed on to the recipient.
        </p>
        {info.arrears.length === 0 ? <p className="muted">No arrears in this group.</p> : (
          <div className="table-wrap">
            <table className="stack">
              <thead><tr><th scope="col">Member</th><th scope="col">Cycle</th><th scope="col" className="num">Owed</th><th scope="col" className="num">Paid</th><th scope="col" className="num">Outstanding</th></tr></thead>
              <tbody>
                {info.arrears.map((a) => (
                  <tr key={a.memberId + a.cycle}>
                    <td data-label="Member">{nameOf(a.memberId)}</td>
                    <td data-label="Cycle" className="mono-cell">{a.cycle}</td>
                    <td data-label="Owed" className="num"><Money value={a.owed} /></td>
                    <td data-label="Paid" className="num"><Money value={a.settled} /></td>
                    <td data-label="Outstanding" className="num">{a.outstanding > 0 ? <strong><Money value={a.outstanding} /></strong> : <Badge kind="paid">Settled</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected && (
          <form onSubmit={submitArrears} noValidate className="inline-form" aria-label="Record arrears payment">
            <div className="grid form-grid">
              <div className="field">
                <label htmlFor="arr-sel">Arrears to settle</label>
                <select id="arr-sel" value={`${selected.memberId}|${selected.cycle}`} onChange={(e) => { setArrKey(e.target.value); setArrAmount('') }}>
                  {open.map((a) => <option key={a.memberId + a.cycle} value={`${a.memberId}|${a.cycle}`}>{`${nameOf(a.memberId)}, cycle ${a.cycle}, ${plain(a.outstanding)} owed`}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="arr-amt">Amount received in PHP</label>
                <input id="arr-amt" className="mono-input" inputMode="decimal" value={arrAmount} placeholder={plain(selected.outstanding).replace('₱', '')} onChange={(e) => setArrAmount(e.target.value)} />
              </div>
            </div>
            <ErrorMsg message={arrError} />
            {arrDone && <div className="success" role="status">{arrDone}</div>}
            <button className="btn primary" type="submit">Record arrears payment</button>
          </form>
        )}
      </section>

      <section className="card" aria-labelledby="log-h">
        <h2 id="log-h" className="card-title">Ledger entries</h2>
        <p className="small muted">Entries are append-only. Nothing is edited or deleted. A mistake is fixed by adding a reversing entry.</p>
        <ErrorMsg message={revError} />
        {entries.length === 0 && <p className="muted">No entries yet.</p>}
        <div className="table-wrap">
          <table className="stack ledger">
            <thead><tr><th scope="col">Entry</th><th scope="col">Type</th><th scope="col">Member</th><th scope="col">Cycle</th><th scope="col" className="num">Amount</th><th scope="col">Details</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {[...entries].reverse().map((e) => {
                const done = e.type !== 'reversal' && rev.has(e.id)
                return (
                  <tr key={e.id} className={done ? 'reversed' : undefined}>
                    <td data-label="Entry" className="mono-cell">{e.id}</td>
                    <td data-label="Type" className="nowrap">
                      {e.type === 'reversal' ? <Badge kind="reversal">Reversal of {e.reverses}</Badge>
                        : e.type === 'payout' ? <Badge kind="neutral">Payout</Badge>
                        : e.type === 'arrears' ? <Badge kind="arrears">Arrears</Badge>
                        : <Badge kind={e.status ?? 'neutral'}>{e.status ? STATUS_LABEL[e.status] : 'Contribution'}</Badge>}
                    </td>
                    <td data-label="Member">{nameOf(e.memberId)}</td>
                    <td data-label="Cycle" className="mono-cell">{e.cycle}</td>
                    <td data-label="Amount" className="num amount">{e.amount ? <><span aria-hidden="true">{sign(e)}</span><span className="sr-only">{sign(e) === '+' ? 'plus ' : 'minus '}</span><Money value={e.amount} /></> : <span className="muted">none</span>}</td>
                    <td data-label="Details" className="small muted details">
                      {formatStamp(e.ts)}
                      {e.paidDate && e.status === 'late' ? `, paid ${formatDate(e.paidDate)}` : ''}
                      {e.shortfall ? <>, <Money value={e.shortfall} /> arrears created</> : ''}
                      {e.type === 'arrears' ? (e.forwarded ? ', passed to the cycle recipient' : ', held in the pot for the cycle payout') : ''}
                      {e.note ? `, ${e.note}` : ''}{done ? ', reversed' : ''}
                    </td>
                    <td data-label="" className="action-cell">
                      {isActive(e, rev) && reversing !== e.id && (
                        <div className="row end">
                          <button className="btn small" onClick={() => setRefused(e.id)} aria-label={`Edit entry ${e.id}`}>Edit entry</button>
                          <button className="btn small" onClick={() => { setReversing(e.id); setRefused(null); setReason(''); setRevError(null) }} aria-label={`Write a reversal for entry ${e.id}`}>Write a reversal</button>
                        </div>
                      )}
                      {refused === e.id && reversing !== e.id && <div className="notice refusal" role="status">Entries cannot be edited. Write a reversal.</div>}
                      {reversing === e.id && (
                        <div className="reverse-box">
                          <label htmlFor={`why-${e.id}`}>Reason for reversing {e.id}</label>
                          <input id={`why-${e.id}`} value={reason} onChange={(ev) => setReason(ev.target.value)} autoFocus />
                          <div className="row">
                            <button className="btn small danger" onClick={() => doReverse(e.id)}>Add reversing entry</button>
                            <button className="btn small" onClick={() => { setReversing(null); setRevError(null) }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
