import { formatDate } from '../domain/dates'
import type { Entry, Group } from '../domain/types'
import { cycleStatus, payoutState, type GroupInfo } from './groupInfo'
import { Badge, Money, Stat } from './shared'

export function Dashboard({ group, entries, info, today }: { group: Group; entries: Entry[]; info: GroupInfo; today: string }) {
  const due = info.schedule[info.cycle - 1].dueDate
  const shortCycles = new Set(info.arrears.filter((a) => a.outstanding > 0).map((a) => a.cycle)).size
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
          One round, each member receives once. If a member misses or underpays, the recipient&apos;s payout is short by that amount until it is settled.
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
                            Short by <Money value={ps.shortfall} />
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
        <h2 id="arr-h" className="card-title">Short payouts</h2>
        {info.arrearsTotal === 0 ? (
          <p className="muted">Nothing is short. Every missed or short contribution has been settled.</p>
        ) : (
          <>
            <p><strong>Short by <Money value={info.arrearsTotal} /></strong> across {shortCycles} {shortCycles === 1 ? 'cycle' : 'cycles'}.</p>
            <p className="small muted">Who owes what is in the ledger, where each amount is settled. It is not listed here.</p>
            <p><a className="btn" href={`#/g/${group.id}/ledger/arrears`}>Record arrears payment</a></p>
          </>
        )}
      </section>
    </>
  )
}
