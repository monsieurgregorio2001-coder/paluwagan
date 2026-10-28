import { formatPHP } from '../domain/money'
import type { Entry, Group } from '../domain/types'
import { formatDate } from '../domain/dates'
import type { GroupInfo } from './groupInfo'
import { Badge, Money } from './shared'

export const ROOM_LABEL = 'Demo group · No real money · Sends are simulated'

/** The dial: the pot against the full pot, from the ledger. */
export function Dial({ pot, target }: { pot: number; target: number }) {
  const r = 100
  const c = 2 * Math.PI * r
  const share = target > 0 ? Math.min(1, Math.max(0, pot / target)) : 0
  return (
    <div className="dial" role="img" aria-label={`${formatPHP(pot)} in the pot of ${formatPHP(target)}`}>
      <svg viewBox="0 0 220 220" width="220" height="220" aria-hidden="true">
        <circle cx="110" cy="110" r={r} className="dial-track" />
        <circle cx="110" cy="110" r={r} className="dial-fill" strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 110 110)" />
      </svg>
      <div className="dial-text" aria-hidden="true">
        <span className="dial-pot">{formatPHP(pot)}</span>
        <span className="dial-sub">in the pot of {formatPHP(target)}</span>
      </div>
    </div>
  )
}

export function Hero({ group, info, onCheck }: { group: Group; info: GroupInfo; onCheck: () => void }) {
  return (
    <div className="hero-block">
      <p className="house-label">{ROOM_LABEL}</p>
      <h1 className="display">{group.name}</h1>
      <p className="muted cycle-line">
        {info.started ? `Cycle ${info.cycle} of ${info.total}.` : 'Not started.'} Dates follow today in Manila.
      </p>
      <Dial pot={info.potBalance} target={info.potSize} />
      <div className="row hero-actions">
        <a className="btn primary" href={`#/g/${group.id}/ledger`}>Record a payment</a>
        <button type="button" className="btn" onClick={onCheck}>Check the books</button>
      </div>
    </div>
  )
}

const KIND: Record<Entry['type'], string> = { contribution: 'Paid', payout: 'Payout', arrears: 'Arrears paid', reversal: 'Reversal' }

/** Ruled passbook lines: the latest entries, newest first, each with a stamp. */
export function Passbook({ group, entries, limit = 8 }: { group: Group; entries: Entry[]; limit?: number }) {
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id
  const reversed = new Set(entries.filter((e) => e.type === 'reversal').map((e) => e.reverses))
  const recent = [...entries].reverse().slice(0, limit)
  return (
    <section className="sheet" aria-labelledby="pb-h">
      <h2 id="pb-h" className="section-title">Passbook</h2>
      {recent.length === 0 ? <p className="muted ruled-empty">No lines yet. Record a payment to write the first one.</p> : (
        <ol className="ruled">
          {recent.map((e) => {
            const out = e.type === 'payout' || (e.type === 'reversal' && e.reversedType !== 'payout')
            return (
              <li key={e.id} className={reversed.has(e.id) ? 'is-reversed' : undefined}>
                <span className="ruled-main">
                  <span className="ruled-who">{nameOf(e.memberId)}</span>
                  <span className="ruled-meta">{e.id}, cycle {e.cycle}, {formatDate(e.ts.slice(0, 10))}</span>
                </span>
                <span className="ruled-stamp"><Badge kind={e.type === 'reversal' ? 'reversal' : e.status === 'missed' ? 'missed' : e.status === 'late' ? 'late' : e.type === 'payout' ? 'neutral' : 'paid'}>
                  {reversed.has(e.id) ? 'Reversed' : e.type === 'contribution' && e.status === 'missed' ? 'Missed' : e.type === 'contribution' && e.status === 'late' ? 'Late' : KIND[e.type]}
                </Badge></span>
                <span className="ruled-amt">{e.amount ? <><span aria-hidden="true">{out ? '-' : '+'}</span><span className="sr-only">{out ? 'minus ' : 'plus '}</span><Money value={e.amount} /></> : <span className="muted">none</span>}</span>
              </li>
            )
          })}
        </ol>
      )}
      {entries.length > limit && <p className="small"><a href={`#/g/${group.id}/ledger`}>See all {entries.length} lines in the ledger</a></p>}
    </section>
  )
}
