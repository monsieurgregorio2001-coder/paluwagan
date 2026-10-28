// Browser checks against a local build: screenshots, axe, overflow, keyboard. Run: node scripts/shoot.mjs <outdir>
// Needs HOUSE_DIR, CHROME (a chromium binary), PLAYWRIGHT_MODULE and AXE_PATH (paths to playwright and axe-core).
import fs from 'node:fs'
import path from 'node:path'
import { serve } from './serve-local.mjs'
const out = path.resolve(process.argv[2] || 'docs/audits/shots/wave-2')
fs.mkdirSync(out, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT_MODULE)
const chromium = pw.chromium || pw.default.chromium
const axeSrc = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const { server, port } = await serve({})
const base = `http://127.0.0.1:${port}/paluwagan/`
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const results = { axe: [], overflow: [], errors: [] }
const only = process.argv[3]

async function open(ctxOpts, hash = '') {
  const ctx = await browser.newContext(ctxOpts)
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && results.errors.push(`${hash} ${m.text()}`))
  page.on('pageerror', (e) => results.errors.push(String(e)))
  await page.goto(base + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  return { ctx, page }
}
const settle = (page) => page.waitForTimeout(3200)

for (const w of [360, 390, 1024, 1440]) {
  for (const mode of ['light', 'dark', 'calm', 'nojs']) {
    if (only && !`${w}-${mode}`.includes(only)) continue
    const h = w < 700 ? 844 : 900
    const { ctx, page } = await open({ viewport: { width: w, height: h }, colorScheme: mode === 'dark' ? 'dark' : 'light', reducedMotion: mode === 'calm' ? 'reduce' : 'no-preference', javaScriptEnabled: mode !== 'nojs' })
    if (mode === 'calm') await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/home-${w}-${mode}.png` })
    if (mode !== 'nojs') {
      results.overflow.push([w, mode, await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)])
      await page.screenshot({ path: `${out}/home-${w}-${mode}-full.png`, fullPage: true })
      if ((w === 390 || w === 1440) && (mode === 'light' || mode === 'dark')) {
        await page.addScriptTag({ content: axeSrc })
        for (const hash of ['', '#/g/demo-weekly/ledger', '#/g/demo-weekly/risk', '#/groups']) {
          await page.evaluate((h) => { location.hash = h }, hash)
          await page.waitForTimeout(400)
          const r = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }))
          results.axe.push([w, mode, hash || 'home', r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)])
        }
      }
    }
    await ctx.close()
  }
}
await browser.close(); server.close()
console.log(JSON.stringify(results, null, 1))
