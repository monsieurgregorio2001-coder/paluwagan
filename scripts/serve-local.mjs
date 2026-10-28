// Serves dist/ at /paluwagan/ and the pinned house at /house/ for local browser checks. Not used in CI deploys.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.md': 'text/markdown' }
export function serve({ port = 0, houseDir = process.env.HOUSE_DIR, dist = path.resolve('dist') } = {}) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    let f
    if (url.startsWith('/house/')) f = path.join(path.resolve(houseDir), url)
    else if (url.startsWith('/paluwagan/')) f = path.join(dist, url.slice('/paluwagan/'.length) || 'index.html')
    else { res.statusCode = 404; return res.end('not found') }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html')
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('not found') }
    res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream')
    res.end(fs.readFileSync(f))
  })
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, port: server.address().port })))
}
