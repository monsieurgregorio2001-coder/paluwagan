import { useMemo } from 'react'
import { useAppState } from '../data/store'
import { formatDate, todayManila } from '../domain/dates'
import { formatPHP } from '../domain/money'
import type { Group } from '../domain/types'
import { Dashboard } from './Dashboard'
import { LedgerTab } from './LedgerTab'
import { RiskTab } from './RiskTab'
import { groupInfo } from './groupInfo'

const FREQ = { weekly: 'weekly', biweekly: 'every 2 weeks', monthly: 'monthly' } as const
const TABS = [
  ['dashboard', 'Dashboard'],
  ['ledger', 'Ledger'],
  ['risk', 'Risk and reminders'],
] as const

export function GroupView({ group, tab }: { group: Group; tab: string }) {
  const state = useAppState()
  const today = useMemo(() => todayManila(), [])
  const entries = state.ledgers[group.id] ?? []
  const info = groupInfo(group, entries, today)
  const active = TABS.some(([k]) => k === tab) ? tab : 'dashboard'

  return (
    <>
      <p><a href="#/">All groups</a></p>
      <h1>{group.name}</h1>
      <p className="muted">
        {group.members.length} members, {formatPHP(group.contributionCentavos)} {FREQ[group.frequency]}. Starts {formatDate(group.startDate)}. Today is {formatDate(today)}.
      </p>
      <nav className="tabs" aria-label="Group sections">
        {TABS.map(([k, label]) => (
          <a key={k} className="tab" href={`#/g/${group.id}/${k}`} aria-current={active === k ? 'page' : undefined}>{label}</a>
        ))}
      </nav>
      {active === 'dashboard' && <Dashboard group={group} entries={entries} info={info} today={today} />}
      {active === 'ledger' && <LedgerTab group={group} entries={entries} info={info} today={today} />}
      {active === 'risk' && <RiskTab group={group} entries={entries} info={info} today={today} drafts={state.drafts.filter((d) => d.groupId === group.id)} />}
    </>
  )
}
