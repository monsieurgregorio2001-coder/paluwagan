/// <reference types="vitest" />
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

// The house Vite plugin marks /house/ external and serves it from HOUSE_DIR in dev (DIRECTION 4.2).
const houseDir = resolve(process.env.HOUSE_DIR || join(__dirname, '..', 'monsieurgregorio2001-coder.github.io'))
const pluginFile = join(houseDir, 'house', '2.0.1', 'tools', 'vite-plugin.mjs')
const plugins: PluginOption[] = [react()]
if (existsSync(pluginFile)) {
  const mod = await import(pathToFileURL(pluginFile).href)
  plugins.unshift(mod.default({ houseDir }))
} else if (!process.env.VITEST) {
  throw new Error(`house plugin not found at ${pluginFile}. Set HOUSE_DIR to a checkout of the hub.`)
}

// Vite drops external /house/ tags from index.html, so they are put back here, before the room stylesheet.
const houseTags: PluginOption = {
  name: 'house-tags',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const css = '<link rel="stylesheet" href="/house/2.0.1/tokens.css" />\n    <link rel="stylesheet" href="/house/2.0.1/house.css" />\n    '
      const js = '<script type="module" src="/house/2.0.1/house.js"></script>\n  '
      const at = html.search(/<link rel="stylesheet"[^>]*assets\//)
      const withCss = at >= 0 ? html.slice(0, at) + css + html.slice(at) : html.replace('</head>', css + '</head>')
      return withCss.replace('</head>', js + '</head>')
    },
  },
}
plugins.push(houseTags)

export default defineConfig({
  base: '/paluwagan/',
  plugins,
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
