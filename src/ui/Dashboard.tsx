import { formatDate } from '../domain/dates'
import { formatPHP } from '../domain/money'
import { reconciles, summarize } from '../domain/ledger'
import type { Entry, Group } from '../domain/types'
import { cycleStatus, type GroupInfo } from './groupInfo'
import { Badge, Stat } from './shared'

export function Dashboard({ group, entries, info, today }: { group: Group; entries: Entry[]; info: GroupInfo; today: string }) {
  const s = summarize(entries)
  const due = info.schedule[info.cycle - 1].dueDate
  return (
    <>
      <div className="stats">
        <Stat label="Current cycle" value={info.started ? `${info.cycle} of ${info.total}` : `Not started (first cycle ${formatDate(due)})`} />
        <Stat label="Cycle due date" value={formatDate(due)} />
        <Stat label="Receives the pot now" value={info.recipient.name} />
        <Stat label="Receives next" value={info.nextRecipient ? info.nextRecipient.name : 'Round ends after this cycle'} />
        <Stat label="Pot balance held" value={formatPHP(info.potBalance)} />
        <Stat label="Collected this cycle" value={`${info.paidCount} of ${info.total} paid, ${formatPHP(info.collected)} of ${formatPHP(info.potSize)}`} />
      </div>
      <section className="card" aria-labelledby="sched-h">
        <h2 id="sched-h">Cycle schedule</h2>
        {group.orderMethod === 'seeded' && group.seed && (
          <p className="small muted">
            Payout order drawn with seed <strong>{group.seed}</strong> from the names: {(group.seedInput ?? []).join(', ')}. Using the same seed and names gives the same order.
          </p>
        )}
        <div className="table-wrap">
          <table>
            <caption className="muted small" style={{ textAlign: 'left', paddingBottom: 6 }}>One round. Each member receives once.</caption>
            <thead>
              <tr><th scope="col">#</th><th scope="col">Due</th><th scope="col">Recipient</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {info.schedule.map((row) => {
                const st = cycleStatus(group, entries, row.cycle)
                const isCurrent = info.started && row.cycle === info.cycle
                const future = row.dueDate > today
                return (
                  <tr key={row.cycle} className={isCurrent ? 'current-row' : undefined} aria-current={isCurrent ? 'step' : undefined}>
                    <td>{row.cycle}</td>
                    <td>{formatDate(row.dueDate)}</td>
                    <td>{row.recipient.name}</td>
                    <td>
                      {st.payout ? <Badge kind="paid">Paid out {formatPHP(st.payout.amount)}</Badge>
                        : isCurrent ? <Badge kind="current">Current, {st.paid}/{info.total} paid</Badge>
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
      <section className="card" aria-labelledby="rec-h">
        <h2 id="rec-h">Ledger check</h2>
        <p className="small muted">Net contributions must equal net payouts plus the pot balance. This is computed from the append-only ledger.</p>
        <p>
          {formatPHP(s.contributions)} contributed = {formatPHP(s.payouts)} paid out + {formatPHP(s.potBalance)} in the pot{' '}
          {reconciles(entries) ? <Badge kind="paid">Reconciled</Badge> : <Badge kind="missed">Mismatch</Badge>}
        </p>
      </section>
    </>
  )
}
