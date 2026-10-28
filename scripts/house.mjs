// Runs the pinned house tools. HOUSE_DIR is a checkout of the hub (CI) or the sibling folder (local).
//   node scripts/house.mjs sync | check | 404 | lock
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const houseDir = resolve(process.env.HOUSE_DIR || join(root, '..', 'monsieurgregorio2001-coder.github.io'))
const version = existsSync(join(root, 'house.lock.json')) ? JSON.parse(readFileSync(join(root, 'house.lock.json'), 'utf8')).version : '2.0.1'
const tool = join(houseDir, 'house', version, 'tools', 'house-sync.mjs')
if (!existsSync(tool)) { console.error(`house: ${tool} not found. Set HOUSE_DIR to a checkout of the hub at the pinned commit.`); process.exit(1) }
const room = ['--room', 'paluwagan']
const cmd = process.argv[2]
const argv = { sync: [...room, 'index.html'], check: ['--check', ...room, 'index.html'], 404: [...room, '--404', 'dist/404.html'], lock: ['--lock', version] }[cmd]
if (!argv) { console.error('usage: node scripts/house.mjs sync|check|404|lock'); process.exit(2) }
const r = spawnSync('node', [tool, ...argv], { cwd: root, stdio: 'inherit', env: { ...process.env, HOUSE_DIR: houseDir } })
process.exit(r.status ?? 1)
