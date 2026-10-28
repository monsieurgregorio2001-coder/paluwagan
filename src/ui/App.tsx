import { useEffect, useState } from 'react'
import { actions, useAppState } from '../data/store'
import { isPersistent } from '../data/storage'
import { CreateGroup } from './CreateGroup'
import { GroupCards, GroupList } from './GroupList'
import { GroupView } from './GroupView'
import { HowBuilt, Receipt } from './Receipt'

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export function App() {
  const state = useAppState()
  const hash = useHash()
  const [confirmReset, setConfirmReset] = useState(false)

  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const group = parts[0] === 'g' ? state.groups.find((g) => g.id === parts[1]) : undefined
  const featured = state.groups.find((g) => g.id === 'demo-weekly') ?? state.groups[0]

  // A new page starts at the top. Focus is never moved: the skip link and the browser own it.
  useEffect(() => { window.scrollTo(0, 0) }, [parts[0], parts[1]])

  let page
  if (parts[0] === 'new') page = <CreateGroup />
  else if (parts[0] === 'groups') page = <GroupList />
  else if (parts[0] === 'g' && group) page = <GroupView group={group} tab={parts[2] ?? 'dashboard'} focus={parts[3]} home={group.id === featured?.id && !parts[2]} />
  else if (parts[0] === 'g') page = <div className="card"><h1>Group not found</h1><p><a href="#/groups">All groups</a></p></div>
  else page = featured ? <GroupView group={featured} tab="dashboard" home /> : <GroupList />

  const home = !parts.length
  return (
    <div className="wrap shell">
      {!isPersistent() && (
        <div className="notice" role="status">Browser storage is unavailable, so your changes are kept in memory only and will be lost when you close or reload this page.</div>
      )}
      {page}
      {home && (
        <>
          <section className="others" aria-labelledby="others-h">
            <div className="section-head">
              <h2 id="others-h" className="section-title">Other groups</h2>
              <a className="btn" href="#/groups">All groups</a>
            </div>
            <GroupCards groups={state.groups.filter((g) => g.id !== featured?.id)} />
          </section>
          <Receipt />
          <HowBuilt />
        </>
      )}
      <section className="reset-area" aria-label="Demo data">
        <p className="small muted">This is a portfolio demo and not a financial service. It does not hold, move, or lend money. Reminder drafts are pre-written templates and nothing is ever sent.</p>
        <div className="row">
          {confirmReset ? (
            <>
              <span className="small">Replace all data with the demo groups?</span>
              <button className="btn small danger" onClick={() => { actions.resetDemo(); setConfirmReset(false); window.location.hash = '#/' }}>Yes, reset</button>
              <button className="btn small" onClick={() => setConfirmReset(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn small" onClick={() => setConfirmReset(true)}>Reset demo data</button>
          )}
        </div>
      </section>
    </div>
  )
}
