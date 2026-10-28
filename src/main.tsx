import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './styles.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The static shell in index.html is the first paint. Once React is on screen it fades out and leaves the layout.
const shell = document.getElementById('room-hero')
if (shell) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    shell.setAttribute('aria-hidden', 'true')
    shell.classList.add('is-leaving')
    window.setTimeout(() => shell.remove(), 400)
  }))
}

// Back restores scroll against the short shell, then React makes the page tall and the view jumps. The last height of this
// route is remembered per tab and reserved by the inline script in index.html, so the browser restores scroll against the real height.
const stage = document.querySelector<HTMLElement>('.stage')
const hKey = () => `pal.h:${location.pathname}${location.hash}`
const saveHeight = () => {
  try {
    if (stage && !document.getElementById('room-hero')) sessionStorage.setItem(hKey(), String(Math.round(stage.getBoundingClientRect().height)))
  } catch { /* no storage */ }
}
addEventListener('pagehide', saveHeight)
window.setTimeout(() => document.documentElement.style.removeProperty('--stage-h'), 500)
