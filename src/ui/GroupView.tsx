import { useMemo, useState } from 'react'
import { useAppState } from '../data/store'
import { formatDate, todayManila } from '../domain/dates'
import type { Group } from '../domain/types'
import { Dashboard } from './Dashboard'
import { BooksToy } from './BooksToy'
import { Hero, Passbook, ROOM_LABEL } from './Hero'
import { LedgerTab } from './LedgerTab'
import { RiskTab } from './RiskTab'
import { groupInfo } from './groupInfo'
import { Money } from './shared'

const FREQ = { weekly: 'weekly', biweekly: 'every 2 weeks', monthly: 'monthly' } as const
const TABS = [
  ['dashboard', 'Overview'],
  ['ledger', 'Ledger'],
  ['risk', 'Risk'],
] as const

export function GroupView({ group, tab, focus, home }: { group: Group; tab: string; focus?: string; home?: boolean }) {
  const state = useAppState()
  const today = useMemo(() => todayManila(), [])
  const [runKey, setRunKey] = useState(0)
  const entries = state.ledgers[group.id] ?? []
  const info = groupInfo(group, entries, today)
  const active = TABS.some(([k]) => k === tab) ? tab : 'dashboard'
  const tabs = (
    <nav className="tabs" aria-label="Group sections">
      {TABS.map(([k, label]) => (
        <a key={k} className="tab" href={k === 'dashboard' && home ? '#/' : `#/g/${group.id}/${k}`} aria-current={active === k ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
  )
  const checkBooks = () => {
    setRunKey((n) => n + 1)
    document.getElementById('books')?.scrollIntoView({ block: 'start', behavior: document.documentElement.dataset.motion === 'full' ? 'smooth' : 'auto' })
  }

  return (
    <div className="page">
      {active === 'dashboard' ? (
        <>
          <div className="spread">
            <div className="spread-left">
              {!home && <p className="back"><a href="#/groups">All groups</a></p>}
              <Hero group={group} info={info} onCheck={checkBooks} />
              {tabs}
            </div>
            <Passbook group={group} entries={entries} />
          </div>
          <BooksToy group={group} entries={entries} books={state.books[group.id] ?? { cycles: [], stubs: {} }} runKey={runKey} />
          <Dashboard group={group} entries={entries} info={info} today={today} />
        </>
      ) : (
        <>
          <p className="back"><a href="#/groups">All groups</a></p>
          <p className="house-label">{ROOM_LABEL}</p>
          <h1 className="display">{group.name}</h1>
          <p className="muted meta">
            {group.members.length} members, <Money value={group.contributionCentavos} /> {FREQ[group.frequency]}. Starts {formatDate(group.startDate)}. Today is {formatDate(today)}.
          </p>
          {tabs}
          {active === 'ledger' && <LedgerTab group={group} entries={entries} info={info} today={today} focus={focus} />}
          {active === 'risk' && <RiskTab group={group} entries={entries} info={info} today={today} drafts={state.drafts.filter((d) => d.groupId === group.id)} />}
        </>
      )}
    </div>
  )
}
