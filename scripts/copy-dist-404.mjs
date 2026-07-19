/* global process */
import { copyFileSync, existsSync } from 'node:fs'

// SPA history-mode fallback: CloudBase static hosting serves 404.html on
// unmatched routes, so a direct hit / refresh of /cheer or /checkin resolves
// to index.html instead of a hard 404.
const src = 'dist/index.html'
const dest = 'dist/404.html'
if (!existsSync(src)) {
  console.error('[copy-dist-404] dist/index.html not found, run vite build first')
  process.exit(1)
}
copyFileSync(src, dest)
console.log('[copy-dist-404] copied dist/index.html -> dist/404.html')
