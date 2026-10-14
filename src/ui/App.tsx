import { useEffect, useRef, useState } from 'react'
import { actions, useAppState } from '../data/store'
import { isPersistent } from '../data/storage'
import { CreateGroup } from './CreateGroup'
import { GroupList } from './GroupList'
import { GroupView } from './GroupView'

const PORTFOLIO = 'https://monsieurgregorio2001-coder.github.io/'
const CODE = 'https://github.com/monsieurgregorio2001-coder/paluwagan'

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
  else if (parts[0] === 'g' && group) page = <GroupView group={group} tab={parts[2] ?? 'dashboard'} focus={parts[3]} />
  else if (parts[0] === 'g') page = <div className="card"><h1>Group not found</h1><p><a href="#/">Back to all groups</a></p></div>
  else page = <GroupList />

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>
      <header className="site-header">
        <div className="wrap bar">
          <nav className="crumbs" aria-label="Site">
            <a className="owner" href={PORTFOLIO}>Garfield Lim</a>
            <span className="slash" aria-hidden="true">/</span>
            <a className="project" href="#/">Online Paluwagan</a>
          </nav>
          <a className="code-link" href={CODE}>Code</a>
        </div>
      </header>
      <aside className="banner" aria-label="Demo notice">
        <div className="wrap">Demo only. No real money moves and no data leaves your device.</div>
      </aside>
      <div className="wrap shell">
        {!isPersistent() && (
          <div className="notice" role="status">Browser storage is unavailable, so your changes are kept in memory only and will be lost when you close or reload this page.</div>
        )}
        <main id="main" ref={main} tabIndex={-1}>
          {page}
        </main>
      </div>
      <footer className="site-footer">
        <div className="wrap">
          <p className="disclaimer">
            This is a portfolio demo and not a financial service. It does not hold, move, or lend money. The reminder drafts are pre-written templates and nothing is ever sent.
          </p>
          <p className="credits">
            Built by Garfield Greg Lim III <span aria-hidden="true">·</span>{' '}
            <a href={PORTFOLIO}>Portfolio</a> <span aria-hidden="true">·</span>{' '}
            <a href="https://github.com/monsieurgregorio2001-coder">GitHub</a> <span aria-hidden="true">·</span>{' '}
            <a href="https://www.linkedin.com/in/garfield-lim-8239242a9">LinkedIn</a> <span aria-hidden="true">·</span>{' '}
            <a href="mailto:lim.ggreg@outlook.com">lim.ggreg@outlook.com</a>
          </p>
          <div className="reset">
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
        </div>
      </footer>
    </>
  )
}
