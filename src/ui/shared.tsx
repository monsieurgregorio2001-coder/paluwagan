import type { ReactNode } from 'react'
import type { RiskLevel } from '../domain/risk'

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge kind={level.toLowerCase()}>{level} risk</Badge>
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
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
