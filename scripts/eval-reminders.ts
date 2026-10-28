// Scores every reminder draft the app can produce on four rules. Run: npm run eval:reminders [-- --json out.json]
// Seeded groups at a fixed date, plus randomized member states. Exits 1 if any draft fails or a negative control passes.
import { writeFileSync } from 'node:fs'
import { buildSeed } from '../src/data/seed'
import { allDraftsFor, reminderTargets, scoreDraft, type RubricResult } from '../src/domain/reminderPlan'
import { randomGroup } from '../src/domain/simulate'
import type { Entry, Group } from '../src/domain/types'

const SEED_DATE = '2026-06-10'
const RANDOM_GROUPS = 300
const RULES = ['amount', 'language', 'noExtraFacts', 'nameAndCycle'] as const
const perRule: Record<(typeof RULES)[number], number> = { amount: 0, language: 0, noExtraFacts: 0, nameAndCycle: 0 }
let drafts = 0
let passed = 0
const failures: string[] = []

function score(label: string, group: Group, entries: readonly Entry[], today: string) {
  for (const t of reminderTargets(group, entries, today)) {
    for (const d of allDraftsFor(group, t)) {
      drafts++
      const r: RubricResult = scoreDraft(group, t, d)
      for (const k of RULES) if (r[k]) perRule[k]++
      if (RULES.every((k) => r[k])) passed++
      else failures.push(`${label} ${d.id} ${d.lang}/${d.tone}: ${RULES.filter((k) => !r[k]).join(', ')}`)
    }
  }
}

const seed = buildSeed(SEED_DATE)
for (const g of seed.groups) score(`seed ${g.name}`, g, seed.ledgers[g.id], SEED_DATE)
const seededDrafts = drafts
for (let i = 1; i <= RANDOM_GROUPS; i++) {
  const s = randomGroup(i)
  score(`random ${i}`, s.group, s.entries, s.today)
}

// Negative controls: a broken draft must fail the rule it breaks, or the rubric cannot be trusted.
const g = seed.groups[0]
const t = reminderTargets(g, seed.ledgers[g.id], SEED_DATE)[0]
const good = allDraftsFor(g, t).find((d) => d.lang === 'en' && d.tone === 'firm')!
const controls: [string, (typeof RULES)[number], ReturnType<typeof scoreDraft>][] = [
  ['wrong amount', 'amount', scoreDraft(g, t, { ...good, text: good.text.replace(/₱[\d,]+\.\d{2}/, '₱1.00') })],
  ['wrong language tag', 'language', scoreDraft(g, t, { ...good, lang: 'fil' })],
  ['invented fact', 'noExtraFacts', scoreDraft(g, t, { ...good, text: good.text + ' You missed 3 cycles in a row.' })],
  ['wrong name', 'nameAndCycle', scoreDraft(g, t, { ...good, text: good.text.replace(t.member.name, 'Someone Else') })],
]
const controlFailures = controls.filter(([, rule, r]) => r[rule]).map(([name]) => `negative control passed: ${name}`)

console.log(`Reminder rubric: ${passed} of ${drafts} drafts pass all four rules (${seededDrafts} from seeded groups, ${drafts - seededDrafts} from ${RANDOM_GROUPS} randomized groups).`)
for (const k of RULES) console.log(`  ${k}: ${perRule[k]} of ${drafts}`)
console.log(`Negative controls: ${controls.length - controlFailures.length} of ${controls.length} broken drafts were caught.`)
for (const f of [...failures.slice(0, 10), ...controlFailures]) console.error('  FAIL ' + f)
const out = process.argv.indexOf('--json')
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify({ passed, total: drafts, seeded: seededDrafts, randomGroups: RANDOM_GROUPS, perRule }, null, 2))
process.exit(failures.length || controlFailures.length ? 1 : 0)
