// Writes dist/evidence.json (DIRECTION 4.4, schema 1). Run after `npm run build`.
// Exits non-zero if any test fails or a budget is exceeded.
import { execSync, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { validateEvidence } from './evidence-shape.mjs'

const JS_GZ_LIMIT = 70000
const PROPERTY_TEST = 'src/domain/ledger.test.ts'
const dist = 'dist'
if (!existsSync(join(dist, 'assets'))) { console.error('dist/assets missing: run npm run build first'); process.exit(1) }

const tmp = mkdtempSync(join(tmpdir(), 'evidence-'))
const resultsFile = join(tmp, 'vitest.json')
const opsFile = join(tmp, 'ops.json')
const run = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${resultsFile}`], {
  env: { ...process.env, EVIDENCE_OPS_FILE: opsFile }, stdio: ['ignore', 'inherit', 'inherit'],
})
if (!existsSync(resultsFile)) { console.error('vitest produced no JSON report'); process.exit(1) }
const res = JSON.parse(readFileSync(resultsFile, 'utf8'))
const passed = res.numPassedTests, total = res.numTotalTests
if (!existsSync(opsFile)) { console.error('property test did not report its operation count'); process.exit(1) }
const operations = JSON.parse(readFileSync(opsFile, 'utf8')).operations

const jsGz = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
  .reduce((n, f) => n + gzipSync(readFileSync(join(dist, 'assets', f))).length, 0)

const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim() } catch { return '' } }
const commit = (process.env.GITHUB_SHA || sh('git rev-parse HEAD')).slice(0, 7)
const runner = process.env.GITHUB_ACTIONS
  ? `GitHub Actions ${process.env.ImageOS || 'ubuntu'}, Node ${process.versions.node.split('.')[0]}`
  : `local, Node ${process.versions.node.split('.')[0]}`

const evidence = {
  schema: 1,
  room: 'paluwagan',
  commit,
  ran_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  runner,
  tests: [{ id: 'unit', label: 'Unit and property tests', passed, total, command: 'npx vitest run' }],
  evals: [],
  figures: [{ id: 'ops', value: operations, unit: 'operations', label: 'random ledger operations, 0 mismatches', source: PROPERTY_TEST }],
  budgets: [{ id: 'js-gz', limit: JS_GZ_LIMIT, actual: jsGz }],
  limits: ['No real money moves. Sends are simulated.', 'No real group has used this yet.'],
}

const problems = validateEvidence(evidence)
if (run.status !== 0 || passed !== total || res.numFailedTests > 0) problems.push(`tests failed (${passed}/${total})`)
if (jsGz > JS_GZ_LIMIT) problems.push(`js-gz budget exceeded: ${jsGz} > ${JS_GZ_LIMIT}`)

// Only publish evidence when everything is green.
if (problems.length) { console.error('evidence FAILED:\n- ' + problems.join('\n- ')); process.exit(1) }
writeFileSync(join(dist, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify(evidence, null, 2))
