import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { checkBooks, forgeLine, shortBy, type Books } from '../domain/books'
import { formatPHP, parsePesos } from '../domain/money'
import type { Entry, Group } from '../domain/types'
import { isCalm, Money } from './shared'

const STEP_MS = 260
const plain = (c: number) => formatPHP(c).replace(/,/g, '').replace('₱', '')

/** Counts a number of centavos toward a target. Jumps in Calm. */
function useCount(target: number): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (isCalm() || from.current === target) { from.current = target; setShown(target); return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (STEP_MS - 40))
      setShown(Math.round(a + (target - a) * t))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = target }
  }, [target])
  return shown
}

export function BooksToy({ group, entries, books, runKey }: { group: Group; entries: Entry[]; books: Books; runKey: number }) {
  const [forged, setForged] = useState<{ entries: Entry[]; id: string; was: number; now: number } | null>(null)
  const [forging, setForging] = useState(false)
  const [pick, setPick] = useState('')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [shown, setShown] = useState(0)
  const [started, setStarted] = useState(false)
  const [restored, setRestored] = useState(false)

  const current = forged ? forged.entries : entries
  const check = useMemo(() => checkBooks(current, books), [current, books])
  const stopAt = check.failure ? check.cycles.indexOf(check.failure) + 1 : check.cycles.length
  const finished = started && shown >= stopAt
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id
  const lines = entries.filter((e) => e.amount > 0)
  const pickEntry = lines.find((e) => e.id === pick) ?? lines[lines.length > 3 ? 2 : 0]

  // Steps through the cycles one at a time. In Calm every cycle shows at once.
  useEffect(() => {
    if (!started) return
    if (isCalm()) { setShown(stopAt); return }
    if (shown >= stopAt) return
    const t = window.setTimeout(() => setShown((n) => n + 1), STEP_MS)
    return () => window.clearTimeout(t)
  }, [started, shown, stopAt])

  const run = () => { setRestored(false); setShown(0); setStarted(true) }
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (runKey > 0) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  const leftToCheck = check.cycles.slice(0, started ? shown : 0).reduce((t, c) => t - c.moved, check.cycles.reduce((t, c) => t + c.moved, 0))
  const counted = useCount(started ? leftToCheck : check.cycles.reduce((t, c) => t + c.moved, 0))
  const fail = finished && check.failure ? shortBy(check.failure) : null

  const forge = (e: FormEvent) => {
    e.preventDefault()
    if (!pickEntry) return
    const pesos = parsePesos(amount === '' ? plain(Math.max(0, pickEntry.amount - 10_000)) : amount)
    if (pesos === null) return setFormError('Enter the amount in pesos, for example 900.00.')
    if (pesos === pickEntry.amount) return setFormError('That is the real amount. Change it to forge the line.')
    setFormError(null)
    setForged({ entries: forgeLine(entries, { id: pickEntry.id, patch: { amount: pesos } }), id: pickEntry.id, was: pickEntry.amount, now: pesos })
    setForging(false)
    run()
  }
  const undo = () => { setForged(null); setFormError(null); setRestored(true); setShown(0); setStarted(true) }

  let status = 'Difference: not checked yet. Press Check the books.'
  if (finished) {
    status = fail
      ? fail.word === 'Mismatch'
        ? `Difference: ₱0.00 in money, but line ${check.failure!.mismatched[0]} does not match its stub in cycle ${check.failure!.cycle}. The books do not balance.`
        : `Difference: ${formatPHP(fail.centavos)} ${fail.word === 'Short' ? 'short' : 'over'} in cycle ${check.failure!.cycle}. The books do not balance.`
      : `${restored ? 'Books restored. ' : ''}Difference: ₱0.00. The books balance.`
  }

  return (
    <section className="card toy" id="books" aria-labelledby="toy-h">
      <h2 id="toy-h" className="section-title">Check the books, then try to cheat them</h2>
      <p className="muted">
        Every line is written three times when it is added: in the ledger, in the cycle state, and in the stub of the member it belongs to. The check compares the three, cycle by cycle.
      </p>
      <div className="row toy-actions">
        <button type="button" className="btn primary" onClick={run} disabled={entries.length === 0}>Check the books</button>
        <button type="button" className="btn" aria-expanded={forging} aria-controls="forge-form" onClick={() => setForging((f) => !f)} disabled={lines.length === 0}>Forge a line</button>
        {forged && <button type="button" className="btn" onClick={undo}>Undo</button>}
      </div>

      {forging && lines.length > 0 && (
        <form id="forge-form" className="forge" onSubmit={forge} noValidate>
          <div className="grid form-grid">
            <div className="field">
              <label htmlFor="forge-line">Line to edit</label>
              <select id="forge-line" value={pickEntry.id} onChange={(e) => { setPick(e.target.value); setAmount(''); setFormError(null) }}>
                {lines.map((e) => <option key={e.id} value={e.id}>{`${e.id}, ${nameOf(e.memberId)}, cycle ${e.cycle}, ${e.type}, ${formatPHP(e.amount)}`}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="forge-amt">New amount in PHP</label>
              <input id="forge-amt" inputMode="decimal" value={amount} placeholder={plain(Math.max(0, pickEntry.amount - 10_000))} onChange={(e) => { setAmount(e.target.value); setFormError(null) }} />
            </div>
          </div>
          {formError && <div className="error" role="alert">{formError}</div>}
          <button type="submit" className="btn">Forge this line and check</button>
          <p className="small muted">This edits a copy. The real ledger is not touched.</p>
        </form>
      )}

      {forged && (
        <p className="forged-line">
          <span className="forge-tag">Forged, on your copy only</span>{' '}
          {forged.id}, {nameOf(entries.find((e) => e.id === forged.id)?.memberId ?? '')}, cycle {entries.find((e) => e.id === forged.id)?.cycle}:{' '}
          <s><Money value={forged.was} /></s> <Money value={forged.now} className="forge-ink" />
        </p>
      )}

      <div className="tally" aria-hidden="true">
        <span className="tally-label">Left to check</span>
        <span className="tally-num money">{formatPHP(counted)}</span>
      </div>

      <ol className="cycles" aria-label="Cycles checked">
        {check.cycles.slice(0, started ? shown : 0).map((c) => {
          const bad = !c.ok
          return (
            <li key={c.cycle} className={`cyc${bad ? ' bad' : ' good'}`}>
              <div className="cyc-head">
                <strong>Cycle {c.cycle}</strong>
                {bad
                  ? <span className="cyc-result bad"><span aria-hidden="true">✕</span> {shortBy(c).word === 'Mismatch' ? 'Line does not match its stub' : `${shortBy(c).word === 'Short' ? 'Short' : 'Over'} by ${formatPHP(shortBy(c).centavos)}`}</span>
                  : <span className="cyc-result good"><span aria-hidden="true">✓</span> Matches</span>}
              </div>
              <dl className="three">
                {([['Ledger', c.flows.ledger], ['Cycle state', c.flows.state], ['Member stubs', c.flows.stubs]] as const).map(([label, f]) => (
                  <div key={label}><dt>{label}</dt><dd className={bad && label === 'Ledger' ? 'forge-ink' : undefined}>In <Money value={f.in} />, out <Money value={f.out} /></dd></div>
                ))}
              </dl>
            </li>
          )
        })}
      </ol>

      {finished && !fail && check.cycles.length > 0 && (
        <p className="stamp" aria-hidden="true"><span className="stamp-mark">✓</span> RECONCILED</p>
      )}
      {finished && fail && (
        <p className="fail-line"><span aria-hidden="true">✕</span> {fail.word === 'Mismatch' ? `Line ${check.failure!.mismatched[0]} does not match its stub in cycle ${check.failure!.cycle}` : `${fail.word === 'Short' ? 'Short' : 'Over'} by ${formatPHP(fail.centavos)} in cycle ${check.failure!.cycle}`}</p>
      )}

      <div className="toy-status" role="status">{status}</div>
    </section>
  )
}
