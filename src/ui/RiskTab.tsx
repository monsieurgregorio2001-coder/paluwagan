import { arrearsItems } from '../domain/ledger'
import { formatPHP } from '../domain/money'
import type { Draft } from '../domain/reminders'
import type { Entry, Group, Member } from '../domain/types'
import type { RiskAssessment, RiskLevel } from '../domain/risk'
import type { GroupInfo } from './groupInfo'
import { ReminderInbox } from './ReminderInbox'
import { Money, RiskBadge } from './shared'

interface Props { group: Group; entries: Entry[]; info: GroupInfo; today: string; drafts: Draft[] }

const ORDER: RiskLevel[] = ['High', 'Medium', 'Low']

export function RiskTab({ group, entries, info, today, drafts }: Props) {
  const rows = group.members.map((m) => ({ m, risk: info.risks.get(m.id)! as RiskAssessment }))
  const flagged = ORDER.slice(0, 2).flatMap((lvl) => rows.filter((r) => r.risk.level === lvl))
  const low = rows.filter((r) => r.risk.level === 'Low')
  const items = arrearsItems(entries)
  const shortOf = (m: Member) => items.filter((a) => a.memberId === m.id && a.outstanding > 0)
  return (
    <>
      <section className="card" aria-labelledby="risk-h">
        <h2 id="risk-h" className="card-title">Late-payment risk</h2>
        <p className="small muted">
          Rule-based, from the last 4 due cycles. High means 2 or more missed, 1 missed plus 1 late, 3 or more late, or 7 or more days overdue now. Medium means 1 missed, 2 late, any delay of 7 or more days, or overdue now. Everything else is Low.
        </p>
      </section>
      {flagged.length > 0 && (
        <div className="grid risk-grid">
          {flagged.map(({ m, risk }) => {
            const owing = shortOf(m)
            const total = owing.reduce((t, a) => t + a.outstanding, 0)
            return (
              <section className="card risk-card" key={m.id} aria-labelledby={`r-${m.id}`}>
                <div className="card-head">
                  <h3 id={`r-${m.id}`}>{m.name}</h3>
                  <RiskBadge level={risk.level} />
                </div>
                <ul className="reasons">{risk.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                {total > 0 && (
                  <div className="arrears-box">
                    <div>
                      <div className="label">Short by</div>
                      <div className="value"><Money value={total} /></div>
                      <div className="small muted">{owing.map((a) => `cycle ${a.cycle}`).join(', ')}</div>
                    </div>
                    <a className="btn small" href={`#/g/${group.id}/ledger/arrears-${m.id}`} aria-label={`Record payment for ${m.name}, short by ${formatPHP(total)}`}>Record payment</a>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
      <section className="card" aria-labelledby="low-h">
        <h2 id="low-h" className="card-title">Low risk</h2>
        {low.length === 0 ? <p className="muted">No member is at low risk.</p> : (
          <ul className="compact">
            {low.map(({ m, risk }) => <li key={m.id}><span>{m.name}</span><RiskBadge level={risk.level} /><span className="small muted">{risk.reasons[0]}</span></li>)}
          </ul>
        )}
      </section>
      <ReminderInbox group={group} entries={entries} today={today} drafts={drafts} />
    </>
  )
}
