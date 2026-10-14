import { useMemo } from 'react'
import { useAppState } from '../data/store'
import { todayManila, formatDate } from '../domain/dates'
import { formatPHP } from '../domain/money'
import { groupInfo } from './groupInfo'
import { Badge } from './shared'

const FREQ = { weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly' } as const

export function GroupList() {
  const state = useAppState()
  const today = useMemo(() => todayManila(), [])
  return (
    <>
      <section className="hero">
        <h1>Your paluwagan groups</h1>
        <p className="muted">
          A paluwagan is a rotating savings group. Every cycle each member pays a fixed amount and one member receives the whole pot until everyone has been paid once.
        </p>
        <a className="btn primary" href="#/new">Create a group</a>
      </section>
      <div className="grid">
        {state.groups.map((g) => {
          const info = groupInfo(g, state.ledgers[g.id] ?? [], today)
          const flagged = [...info.risks.values()].filter((r) => r.level !== 'Low').length
          return (
            <article className="card" key={g.id} aria-labelledby={`t-${g.id}`}>
              <h2 id={`t-${g.id}`}>{g.name}</h2>
              <p className="muted small">
                {g.members.length} members, {formatPHP(g.contributionCentavos)} {FREQ[g.frequency].toLowerCase()}
              </p>
              <p>
                {info.started ? <>Cycle {info.cycle} of {info.total}. Receiving: <strong>{info.recipient.name}</strong></> : <>Starts {formatDate(g.startDate)}. First recipient: <strong>{info.recipient.name}</strong></>}
              </p>
              <p>Pot balance: <strong>{formatPHP(info.potBalance)}</strong></p>
              <p>{flagged > 0 ? <Badge kind="medium">{flagged} flagged {flagged === 1 ? 'member' : 'members'}</Badge> : <Badge kind="low">No flagged members</Badge>}</p>
              <a className="btn" href={`#/g/${g.id}/dashboard`} aria-label={`Open ${g.name}`}>Open group</a>
            </article>
          )
        })}
      </div>
    </>
  )
}
