import { useEffect, useRef, type ReactNode } from 'react'
import { formatPHP } from '../domain/money'
import type { RiskLevel } from '../domain/risk'

/** A status badge is always a dot plus text, never colour alone. */
export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge kind={level.toLowerCase()}>{level} risk</Badge>
}

/** Money in Inter with tabular figures, never mono. */
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

/** True when the house is in Calm: motion off, or the OS asks for reduced motion and nothing is stored. */
export function isCalm(): boolean {
  const m = document.documentElement.dataset.motion
  return m === 'calm' || (m !== 'full' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
}

/** A native modal dialog. The browser traps focus and returns it to the opener on close, so nothing here calls focus(). */
export function ConfirmDialog({ open, title, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, children }: {
  open: boolean
  title: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-h" onCancel={(e) => { e.preventDefault(); onCancel() }} onClose={() => { if (open) onCancel() }}>
      <h2 id="confirm-h" className="card-title">{title}</h2>
      <div className="confirm-body">{children}</div>
      <div className="row">
        <button type="button" className="btn primary" onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
      </div>
    </dialog>
  )
}
