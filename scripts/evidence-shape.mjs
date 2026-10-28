// Shape check for evidence.json schema 1 (DIRECTION 4.4). Usable as a module or CLI: node scripts/evidence-shape.mjs [file]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const str = (v) => typeof v === 'string' && v.length > 0
const int = (v) => Number.isInteger(v) && v >= 0

export function validateEvidence(e) {
  const p = []
  const need = (ok, msg) => { if (!ok) p.push(msg) }
  need(e && typeof e === 'object', 'not an object')
  if (p.length) return p
  need(e.schema === 1, 'schema must be 1')
  need(e.room === 'paluwagan', 'room must be "paluwagan"')
  need(/^[0-9a-f]{7,40}$/.test(e.commit ?? ''), 'commit must be a hex sha')
  need(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(e.ran_at ?? ''), 'ran_at must be UTC ISO seconds')
  need(str(e.runner), 'runner required')
  const list = (k, f) => {
    if (!Array.isArray(e[k])) return p.push(`${k} must be an array`)
    e[k].forEach((r, i) => f(r, `${k}[${i}]`))
  }
  list('tests', (r, w) => {
    need(str(r.id) && str(r.label) && str(r.command), `${w}: id, label, command required`)
    need(int(r.passed) && int(r.total) && r.passed <= r.total, `${w}: passed/total invalid`)
  })
  list('evals', (r, w) => {
    need(str(r.id) && str(r.label) && str(r.command), `${w}: id, label, command required`)
    need(int(r.passed) && int(r.total) && r.passed <= r.total, `${w}: passed/total invalid`)
  })
  list('figures', (r, w) => {
    need(str(r.id) && str(r.unit) && str(r.label) && str(r.source), `${w}: id, unit, label, source required`)
    need(typeof r.value === 'number' && Number.isFinite(r.value), `${w}: value must be a number`)
  })
  list('budgets', (r, w) => {
    need(str(r.id) && int(r.limit) && int(r.actual), `${w}: id, limit, actual required`)
  })
  need(Array.isArray(e.limits) && e.limits.every(str), 'limits must be an array of strings')
  const ids = (k) => (e[k] ?? []).map((r) => r.id)
  for (const k of ['tests', 'evals', 'figures', 'budgets']) need(new Set(ids(k)).size === ids(k).length, `${k}: duplicate id`)
  return p
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = validateEvidence(JSON.parse(readFileSync(process.argv[2] ?? 'dist/evidence.json', 'utf8')))
  if (problems.length) { console.error('evidence shape FAILED:\n- ' + problems.join('\n- ')); process.exit(1) }
  console.log('evidence shape ok')
}
