import { useMemo } from 'react'
import { useAppState } from '../data/store'
import { todayManila, formatDate } from '../domain/dates'
import { groupInfo } from './groupInfo'
import { About, Badge, Money } from './shared'

const FREQ = { weekly: 'weekly', biweekly: 'every 2 weeks', monthly: 'monthly' } as const

export function GroupList() {
  const state = useAppState()
  const today = useMemo(() => todayManila(), [])
  return (
    <div className="page">
      <section className="hero">
        <h1 className="display">A paluwagan you can audit</h1>
        <p className="lead">
          A paluwagan is a Filipino savings circle where each member pays a fixed amount every cycle and one member takes the whole pot.
        </p>
        <p className="lead">
          This demo runs two sample groups so you can see the payout schedule, an append-only ledger, late-payment risk, and reminder drafts.
        </p>
      </section>
      <div className="section-head">
        <h2 className="section-title">Sample groups</h2>
        <a className="btn" href="#/new">Create a group</a>
      </div>
      <div className="grid">
        {state.groups.map((g) => {
          const info = groupInfo(g, state.ledgers[g.id] ?? [], today)
          const flagged = [...info.risks.values()].filter((r) => r.level !== 'Low').length
          return (
            <article className="card group-card" key={g.id} aria-labelledby={`t-${g.id}`}>
              <h3 id={`t-${g.id}`}>{g.name}</h3>
              <p className="muted small">
                {g.members.length} members, <Money value={g.contributionCentavos} /> {FREQ[g.frequency]}
              </p>
              <dl className="facts">
                <div>
                  <dt>{info.started ? `Receiving, cycle ${info.cycle} of ${info.total}` : `First recipient, starts ${formatDate(g.startDate)}`}</dt>
                  <dd>{info.recipient.name}</dd>
                </div>
                <div>
                  <dt>Pot held</dt>
                  <dd><Money value={info.potBalance} /></dd>
                </div>
                <div>
                  <dt>Arrears owed</dt>
                  <dd><Money value={info.arrearsTotal} /></dd>
                </div>
              </dl>
              <div className="card-foot">
                {flagged > 0 ? <Badge kind="medium">{flagged} flagged {flagged === 1 ? 'member' : 'members'}</Badge> : <Badge kind="low">No flagged members</Badge>}
                <a className="btn primary" href={`#/g/${g.id}/dashboard`} aria-label={`Open ${g.name}`}>Open group</a>
              </div>
            </article>
          )
        })}
      </div>
      <About />
    </div>
  )
}
