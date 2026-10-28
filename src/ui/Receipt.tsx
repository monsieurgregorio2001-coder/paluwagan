import { useEffect, useState } from 'react'

interface Evidence {
  commit: string
  tests: { id: string; label: string; passed: number; total: number; command: string }[]
  evals: { id: string; label: string; passed: number; total: number; command: string; labelled_by: string; limits: string }[]
  figures: { id: string; value: number; unit: string; label: string; source: string }[]
  budgets: { id: string; limit: number; actual: number }[]
  limits: string[]
}

const MISSING = 'not measured yet'
const kb = (n: number) => `${(n / 1000).toFixed(1)} KB`

/** Every number here is read from evidence.json, written by CI. Without the file the page says so. */
export function Receipt() {
  const [ev, setEv] = useState<Evidence | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}evidence.json`).then((r) => (r.ok ? r.json() : null)).then((j) => live && setEv(j), () => live && setEv(null))
    return () => { live = false }
  }, [])
  const unit = ev?.tests.find((t) => t.id === 'unit')
  const rubric = ev?.evals.find((t) => t.id === 'reminder-rubric')
  const js = ev?.budgets.find((b) => b.id === 'js-gz')
  const ops = ev?.figures.find((f) => f.id === 'ops')
  return (
    <section className="house-receipt receipt" aria-labelledby="receipt-h">
      <div className="house-receipt-head">
        <h2 id="receipt-h" className="house-receipt-name">Receipt</h2>
        <span className="house-label">Written by CI{ev ? `, commit ${ev.commit}` : ''}</span>
      </div>
      <dl className="house-receipt-rows">
        <div><dt>Tests</dt><dd>{unit ? `${unit.passed} of ${unit.total} pass. ${unit.label}, run with ${unit.command}.` : MISSING}{ops && ` Includes ${ops.value.toLocaleString('en-US')} ${ops.label}.`} Any single forged line is caught, including a forged reversal. Nothing sends without approval.</dd></div>
        <div><dt>Evals</dt><dd>{rubric ? `${rubric.passed} of ${rubric.total} reminder drafts pass all four rules. Run with ${rubric.command}. Labelled by ${rubric.labelled_by}. ${rubric.limits}` : MISSING}</dd></div>
        <div><dt>Budgets</dt><dd>{js ? `JavaScript ${kb(js.actual)} gzipped, against a limit of ${kb(js.limit)}.` : MISSING}</dd></div>
        <div><dt>What this does not do</dt><dd>{ev ? ev.limits.join(' ') : MISSING} It does not hold, move, or lend money. It has no server and makes no model call.</dd></div>
      </dl>
    </section>
  )
}

const COLUMNS: { title: string; items: { text: string; source: string; proposed?: boolean }[] }[] = [
  {
    title: 'What AI did',
    items: [
      { text: 'Fixed the ledger word breaks, the clipped phone row, the wrong amount in reminders, and the odd stat cell.', source: 'Pull request 2, honesty sweep' },
      { text: 'Wrote the evidence file that CI publishes with this page.', source: 'Pull request 3, evidence.json' },
      { text: 'Built the books check and the reminder rubric on this branch.', source: 'Branch phase-3b/passbook' },
    ],
  },
  {
    title: 'What I decided',
    items: [
      { text: 'Money is whole centavos, never floats. Text like 1,000.50 is parsed with string and integer math.', source: 'README, money-safety design decisions' },
      { text: 'The ledger only appends. A mistake is fixed with a reversal, and a reversal cannot be reversed.', source: 'README, money-safety design decisions' },
      { text: 'A person approves every reminder, and approved text cannot be edited.', source: 'README, money-safety design decisions' },
      { text: 'Three records written together, so a forged line cannot match the other two.', source: 'Proposed by Claude, waiting for Garfield’s review', proposed: true },
      { text: 'The four-rule reminder rubric, and leaving tone unscored.', source: 'Proposed by Claude, waiting for Garfield’s review', proposed: true },
    ],
  },
  {
    title: 'What I rejected or corrected',
    items: [
      { text: 'Rejected calling the reminders AI-drafted. They are pre-written templates a person approves.', source: 'Commit 1eb0565' },
      { text: 'Removed Lighthouse figures nobody had measured.', source: 'Commit 1eb0565' },
      { text: 'Caught that reminders quoted the full contribution instead of the amount still owed.', source: 'Commit f9f5538' },
    ],
  },
]

export function HowBuilt() {
  return (
    <section className="built" aria-labelledby="built-h">
      <h2 id="built-h" className="section-title">How this was built</h2>
      <p className="muted">AI-assisted development with Claude Code and Cursor. Entries come from this repository’s commits, pull requests, and README.</p>
      <div className="built-cols">
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h3>{c.title}</h3>
            <ul className="plain">
              {c.items.map((i) => (
                <li key={i.text}>
                  <p>{i.text}</p>
                  <p className={`small ${i.proposed ? 'proposed' : 'muted'}`}>{i.source}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
