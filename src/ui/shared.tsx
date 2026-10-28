import type { ReactNode } from 'react'
import { formatPHP } from '../domain/money'
import type { RiskLevel } from '../domain/risk'

/** A status badge is always a dot plus text, never colour alone. */
export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge kind={level.toLowerCase()}>{level} risk</Badge>
}

/** Money in JetBrains Mono with tabular figures. */
export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={`money${className ? ` ${className}` : ''}`}>{formatPHP(value)}</span>
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function ErrorMsg({ message }: { message: string | null }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null
}

export function About() {
  return (
    <section className="about" aria-labelledby="about-h">
      <h2 id="about-h" className="section-title">About this project</h2>
      <dl className="case">
        <div>
          <dt>Problem</dt>
          <dd>Paluwagan groups run on chat threads and memory, so late payments and disputes are common.</dd>
        </div>
        <div>
          <dt>Build</dt>
          <dd>Append-only ledger in integer centavos, seeded payout draw, rule-based risk flags, and pre-written reminder templates a person approves, in English and Filipino.</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>{ABOUT_RESULT}</dd>
        </div>
      </dl>
    </section>
  )
}

export const ABOUT_RESULT = '53 tests, including 12,000 randomized ledger operations that always reconcile.'
