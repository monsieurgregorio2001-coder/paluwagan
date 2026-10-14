import { useMemo } from 'react'
import { useAppState } from '../data/store'
import { formatDate, todayManila } from '../domain/dates'
import type { Group } from '../domain/types'
import { Dashboard } from './Dashboard'
import { LedgerTab } from './LedgerTab'
import { RiskTab } from './RiskTab'
import { groupInfo } from './groupInfo'
import { Money } from './shared'

const FREQ = { weekly: 'weekly', biweekly: 'every 2 weeks', monthly: 'monthly' } as const
const TABS = [
  ['dashboard', 'Dashboard'],
  ['ledger', 'Ledger'],
  ['risk', 'Risk and reminders'],
] as const

export function GroupView({ group, tab, focus }: { group: Group; tab: string; focus?: string }) {
  const state = useAppState()
  const today = useMemo(() => todayManila(), [])
  const entries = state.ledgers[group.id] ?? []
  const info = groupInfo(group, entries, today)
  const active = TABS.some(([k]) => k === tab) ? tab : 'dashboard'

  return (
    <div className="page">
      <p className="back"><a href="#/">All groups</a></p>
      <h1 className="display">{group.name}</h1>
      <p className="muted meta">
        {group.members.length} members, <Money value={group.contributionCentavos} /> {FREQ[group.frequency]}. Starts {formatDate(group.startDate)}. Today is {formatDate(today)}.
      </p>
      <nav className="tabs" aria-label="Group sections">
        {TABS.map(([k, label]) => (
          <a key={k} className="tab" href={`#/g/${group.id}/${k}`} aria-current={active === k ? 'page' : undefined}>{label}</a>
        ))}
      </nav>
      {active === 'dashboard' && <Dashboard group={group} entries={entries} info={info} today={today} />}
      {active === 'ledger' && <LedgerTab group={group} entries={entries} info={info} today={today} focus={focus} />}
      {active === 'risk' && <RiskTab group={group} entries={entries} info={info} today={today} drafts={state.drafts.filter((d) => d.groupId === group.id)} />}
    </div>
  )
}
