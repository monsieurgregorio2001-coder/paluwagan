import { formatDate } from '../domain/dates'
import { reconciles, summarize } from '../domain/ledger'
import type { Entry, Group } from '../domain/types'
import { cycleStatus, payoutState, type GroupInfo } from './groupInfo'
import { Badge, Money, Stat } from './shared'

export function Dashboard({ group, entries, info, today }: { group: Group; entries: Entry[]; info: GroupInfo; today: string }) {
  const s = summarize(entries)
  const due = info.schedule[info.cycle - 1].dueDate
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id
  const open = info.arrears.filter((a) => a.outstanding > 0)
  return (
    <>
      <div className="stats">
        <Stat label="Current cycle" value={info.started ? `${info.cycle} of ${info.total}` : 'Not started'} sub={`Due ${formatDate(due)}`} />
        <Stat label="Receiving now" value={info.recipient.name} />
        <Stat label="Receiving next" value={info.nextRecipient ? info.nextRecipient.name : 'Round ends'} />
        <Stat label="Pot held" value={<Money value={info.potBalance} />} />
        <Stat label="Collected this cycle" value={<Money value={info.collected} />} sub={<>{info.paidCount} of {info.total} paid, of <Money value={info.potSize} /></>} />
      </div>

      <section className="card" aria-labelledby="sched-h">
        <h2 id="sched-h" className="card-title">Cycle schedule</h2>
        <p className="small muted">
          One round, each member receives once. If a member misses or underpays, the recipient&apos;s payout is short by that amount and the member owes it as arrears.
        </p>
        {group.orderMethod === 'seeded' && group.seed && (
          <p className="small muted">
            Payout order drawn with seed <span className="money">{group.seed}</span> from the names: {(group.seedInput ?? []).join(', ')}. The same seed and names give the same order.
          </p>
        )}
        <div className="table-wrap">
          <table className="stack">
            <thead>
              <tr>
                <th scope="col">Cycle</th>
                <th scope="col">Due</th>
                <th scope="col">Recipient</th>
                <th scope="col" className="num">Payout</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {info.schedule.map((row) => {
                const st = cycleStatus(group, entries, row.cycle)
                const ps = payoutState(entries, row.cycle)
                const isCurrent = info.started && row.cycle === info.cycle
                const future = row.dueDate > today
                const short = ps.shortfall > 0 && (st.payout || isCurrent)
                return (
                  <tr key={row.cycle} className={isCurrent ? 'current-row' : undefined} aria-current={isCurrent ? 'step' : undefined}>
                    <td data-label="Cycle" className="mono-cell">{row.cycle}</td>
                    <td data-label="Due">{formatDate(row.dueDate)}</td>
                    <td data-label="Recipient">{row.recipient.name}</td>
                    <td data-label="Payout" className="num">{st.payout ? <Money value={st.payout.amount} /> : <span className="muted">Pending</span>}</td>
                    <td data-label="Status">
                      {short ? (
                        <>
                          <Badge kind="short">Short payout</Badge>
                          <div className="small status-note">
                            <Money value={ps.shortfall} /> short, owed by {ps.debtors.map(nameOf).join(', ')}
                          </div>
                        </>
                      ) : st.payout ? <Badge kind="paid">{ps.owed > 0 ? 'Paid in full after arrears' : 'Paid out'}</Badge>
                        : isCurrent ? <Badge kind="current">Current, {st.paid} of {info.total} paid</Badge>
                        : future ? <Badge kind="neutral">Upcoming</Badge>
                        : <Badge kind="missed">Payout not recorded</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="arr-h">
        <h2 id="arr-h" className="card-title">Arrears</h2>
        {open.length === 0 ? (
          <p className="muted">No arrears. Every missed or short contribution has been settled.</p>
        ) : (
          <>
            <p className="small muted">Each amount is owed by the member who missed, and goes to that cycle&apos;s recipient when paid.</p>
            <div className="table-wrap">
              <table className="stack">
                <thead>
                  <tr><th scope="col">Member</th><th scope="col">Cycle</th><th scope="col" className="num">Owed</th><th scope="col" className="num">Paid</th><th scope="col" className="num">Outstanding</th></tr>
                </thead>
                <tbody>
                  {open.map((a) => (
                    <tr key={a.memberId + a.cycle}>
                      <td data-label="Member">{nameOf(a.memberId)}</td>
                      <td data-label="Cycle" className="mono-cell">{a.cycle}</td>
                      <td data-label="Owed" className="num"><Money value={a.owed} /></td>
                      <td data-label="Paid" className="num"><Money value={a.settled} /></td>
                      <td data-label="Outstanding" className="num"><strong><Money value={a.outstanding} /></strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p><a className="btn" href={`#/g/${group.id}/ledger/arrears`}>Record arrears payment</a></p>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="rec-h">
        <h2 id="rec-h" className="card-title">Ledger check</h2>
        <p className="small muted">Net contributions must equal net payouts plus the pot balance. This is computed from the append-only ledger.</p>
        <p className="check">
          <Money value={s.contributions} /> contributed = <Money value={s.payouts} /> paid out + <Money value={s.potBalance} /> in the pot{' '}
          {reconciles(entries) ? <Badge kind="paid">Reconciled</Badge> : <Badge kind="missed">Mismatch</Badge>}
        </p>
      </section>
    </>
  )
}
