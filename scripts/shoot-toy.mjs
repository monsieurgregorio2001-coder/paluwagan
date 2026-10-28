// State matrix for the proof toy. Run: node scripts/shoot-toy.mjs <outdir>
import fs from 'node:fs'
import path from 'node:path'
import { serve } from './serve-local.mjs'
const out = path.resolve(process.argv[2] || 'docs/audits/shots/wave-2')
fs.mkdirSync(out, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT_MODULE)
const chromium = pw.chromium || pw.default.chromium
const axeSrc = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const { server, port } = await serve({})
const url = `http://127.0.0.1:${port}/paluwagan/`
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const log = { axe: [], status: [] }
const toy = (p) => p.locator('#books')
for (const [name, w, h, opts] of [['390', 390, 844, {}], ['1440', 1440, 900, {}], ['360', 360, 800, {}], ['dark', 390, 844, { colorScheme: 'dark' }], ['calm', 390, 844, { reducedMotion: 'reduce' }]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts })
  const p = await ctx.newPage()
  await p.goto(url, { waitUntil: 'networkidle' })
  const status = () => toy(p).locator('[role=status]').innerText()
  await toy(p).scrollIntoViewIfNeeded()
  await toy(p).screenshot({ path: `${out}/toy-${name}-1-default.png` })
  await p.getByRole('button', { name: 'Check the books' }).last().click()
  await p.waitForTimeout(700)
  await toy(p).screenshot({ path: `${out}/toy-${name}-2-running.png` })
  await p.waitForTimeout(2600)
  log.status.push([name, 'real', await status()])
  await toy(p).screenshot({ path: `${out}/toy-${name}-3-reconciled.png` })
  await p.getByRole('button', { name: 'Forge a line' }).click()
  await p.waitForTimeout(300)
  await toy(p).screenshot({ path: `${out}/toy-${name}-4-forge-form.png` })
  await p.getByRole('button', { name: 'Forge this line and check' }).click()
  await p.waitForTimeout(3000)
  log.status.push([name, 'forged', await status()])
  await toy(p).screenshot({ path: `${out}/toy-${name}-5-forged.png` })
  if (name === '390' || name === '1440') {
    await p.addScriptTag({ content: axeSrc })
    const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
    log.axe.push([name, 'forged state', r.violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join('|'))])
  }
  await p.getByRole('button', { name: 'Undo' }).click()
  await p.waitForTimeout(3000)
  log.status.push([name, 'undo', await status()])
  await toy(p).screenshot({ path: `${out}/toy-${name}-6-undone.png` })
  await ctx.close()
}
// Edit entry on a real line refuses.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(url + '#/g/demo-weekly/ledger', { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: /Edit entry E/ }).first().click()
  log.status.push(['ledger', 'edit refused', await p.locator('.refusal').first().innerText()])
  await p.locator('.refusal').first().scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${out}/ledger-edit-refused.png` })
  await ctx.close()
}
await browser.close(); server.close()
console.log(JSON.stringify(log, null, 1))
