import { useEffect, useRef, useState } from 'react'
import { actions, useAppState } from '../data/store'
import { isPersistent } from '../data/storage'
import { CreateGroup } from './CreateGroup'
import { GroupList } from './GroupList'
import { GroupView } from './GroupView'

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
  const main = useRef<HTMLElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const group = parts[0] === 'g' ? state.groups.find((g) => g.id === parts[1]) : undefined

  // Move focus to the page heading after navigation so keyboard and screen reader users land in the right place.
  useEffect(() => {
    main.current?.focus({ preventScroll: false })
    window.scrollTo(0, 0)
  }, [parts[0], parts[1]])

  let page
  if (parts[0] === 'new') page = <CreateGroup />
  else if (parts[0] === 'g' && group) page = <GroupView group={group} tab={parts[2] ?? 'dashboard'} />
  else if (parts[0] === 'g') page = <div className="card"><h1>Group not found</h1><p><a href="#/">Back to all groups</a></p></div>
  else page = <GroupList />

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>
      <div className="banner" role="note">Demo only. No real money moves and no data leaves your device.</div>
      <div className="shell">
        <header className="topbar">
          <a className="brand" href="#/">Online Paluwagan</a>
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
        </header>
        {!isPersistent() && (
          <div className="notice" role="status">Browser storage is unavailable, so your changes are kept in memory only and will be lost when you close or reload this page.</div>
        )}
        <main id="main" ref={main} tabIndex={-1} style={{ outline: 'none' }}>
          {page}
        </main>
        <footer className="muted small" style={{ marginTop: 24 }}>
          A portfolio demo by Garfield Greg Lim III. This is not a financial service and it does not hold, move or lend money.
        </footer>
      </div>
    </>
  )
}
