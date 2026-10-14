import { useMemo, useState, type FormEvent } from 'react'
import { actions } from '../data/store'
import { isValidDate, todayManila, formatDate } from '../domain/dates'
import { formatPHP, parsePesos } from '../domain/money'
import { shuffleWithSeed, cycleDueDate } from '../domain/rotation'
import type { Frequency, Group } from '../domain/types'
import { ErrorMsg } from './shared'

function newSeed(): string {
  const words = ['mangga', 'saging', 'bayabas', 'kalamansi', 'ube', 'langka', 'santol', 'atis']
  const w = words[Math.floor(Math.random() * words.length)]
  return `${w}-${Math.random().toString(36).slice(2, 6)}`
}

export function CreateGroup() {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('1,000')
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const [startDate, setStartDate] = useState(todayManila())
  const [members, setMembers] = useState<string[]>(['', ''])
  const [draftName, setDraftName] = useState('')
  const [method, setMethod] = useState<'manual' | 'seeded'>('manual')
  const [seed, setSeed] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cleaned = members.map((m) => m.trim()).filter(Boolean)
  const order = useMemo(
    () => (method === 'seeded' && seed.trim() ? shuffleWithSeed(cleaned, seed.trim()) : cleaned),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [method, seed, cleaned.join('\u0000')],
  )
  const centavos = parsePesos(amount)

  const setMember = (i: number, v: string) => setMembers((m) => m.map((x, j) => (j === i ? v : x)))
  const move = (i: number, d: -1 | 1) =>
    setMembers((m) => {
      const j = i + d
      if (j < 0 || j >= m.length) return m
      const c = m.slice()
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })
  const addMember = () => {
    const v = draftName.trim()
    if (!v) return
    setMembers((m) => [...m.filter((x) => x.trim()), v])
    setDraftName('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter a group name.')
    if (centavos === null || centavos <= 0) return setError('Please enter a contribution amount in pesos, for example 1,000 or 1,000.50.')
    if (!isValidDate(startDate)) return setError('Please choose a valid start date.')
    if (cleaned.length < 2) return setError('A group needs at least 2 members.')
    if (new Set(cleaned.map((c) => c.toLowerCase())).size !== cleaned.length) return setError('Each member name must be different.')
    if (method === 'seeded' && !seed.trim()) return setError('Enter a seed or press Randomize order.')
    const id = `g-${Date.now().toString(36)}`
    const group: Group = {
      id,
      name: name.trim(),
      members: order.map((n, i) => ({ id: `${id}-m${i + 1}`, name: n })),
      contributionCentavos: centavos,
      frequency,
      startDate,
      orderMethod: method,
      ...(method === 'seeded' ? { seed: seed.trim(), seedInput: cleaned } : {}),
    }
    actions.addGroup(group)
    window.location.hash = `#/g/${id}/dashboard`
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="create-h">
      <h1 id="create-h">Create a group</h1>
      <p><a href="#/">Back to all groups</a></p>
      <div className="card">
        <div className="field">
          <label htmlFor="g-name">Group name</label>
          <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div className="grid">
          <div className="field">
            <label htmlFor="g-amt">Contribution per member, in PHP</label>
            <input id="g-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-describedby="g-amt-h" />
            <div id="g-amt-h" className="muted small">{centavos !== null && centavos > 0 ? `Stored as ${formatPHP(centavos)}` : 'Whole pesos or up to 2 decimals'}</div>
          </div>
          <div className="field">
            <label htmlFor="g-freq">Frequency</label>
            <select id="g-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="g-start">First due date</label>
            <input id="g-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
      </div>

      <fieldset>
        <legend>Members</legend>
        <ul className="plain">
          {members.map((m, i) => (
            <li className="list-item" key={i}>
              <div className="grow">
                <label htmlFor={`mem-${i}`} className="small muted">Member {i + 1}</label>
                <input id={`mem-${i}`} value={m} onChange={(e) => setMember(i, e.target.value)} autoComplete="off" />
              </div>
              <div className="row">
                <button type="button" className="btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move member ${i + 1} up`}>Up</button>
                <button type="button" className="btn small" onClick={() => move(i, 1)} disabled={i === members.length - 1} aria-label={`Move member ${i + 1} down`}>Down</button>
                <button type="button" className="btn small danger" onClick={() => setMembers((x) => x.filter((_, j) => j !== i))} aria-label={`Remove member ${i + 1}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field" style={{ flex: '1 1 180px', margin: 0 }}>
            <label htmlFor="new-mem" className="small muted">Add a member</label>
            <input id="new-mem" value={draftName} onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember() } }} autoComplete="off" />
          </div>
          <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={addMember}>Add</button>
          <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={() => setMembers((m) => [...m, ''])}>Add blank row</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Payout order</legend>
        <label className="radio"><input type="radio" name="method" checked={method === 'manual'} onChange={() => setMethod('manual')} /> Manual (use the list order above)</label>
        <label className="radio"><input type="radio" name="method" checked={method === 'seeded'} onChange={() => { setMethod('seeded'); if (!seed) setSeed(newSeed()) }} /> Randomize with a seed</label>
        {method === 'seeded' && (
          <div className="field">
            <label htmlFor="seed">Seed</label>
            <div className="row">
              <input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ flex: '1 1 160px', width: 'auto' }} autoComplete="off" />
              <button type="button" className="btn" onClick={() => setSeed(newSeed())}>Randomize order</button>
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>
              Seed in use: <strong>{seed || 'none'}</strong>. Anyone with the same seed and the same list of names gets the same order, so the draw can be checked for fairness. The seed is saved with the group.
            </p>
          </div>
        )}
        <h2 className="card-title">Payout order preview</h2>
        {order.length === 0 ? <p className="muted">Add member names to see the order.</p> : (
          <ol style={{ margin: 0, paddingLeft: '1.4rem' }}>
            {order.map((n, i) => (
              <li key={n + i}>{n} <span className="muted small">receives on {formatDate(isValidDate(startDate) ? cycleDueDate(startDate, frequency, i) : todayManila())}</span></li>
            ))}
          </ol>
        )}
      </fieldset>

      <ErrorMsg message={error} />
      <button type="submit" className="btn primary">Create group</button>
    </form>
  )
}
