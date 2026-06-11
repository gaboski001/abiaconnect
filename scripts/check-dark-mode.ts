/**
 * Dark-mode hygiene check (no browser required).
 *
 * Run:  bun scripts/check-dark-mode.ts
 *
 * Fails (exit 1) when any of these regressions appear:
 *   1. src/index.css `body` does not bind to var(--background) / var(--foreground)
 *   2. .dark token lightness is wrong (foreground too dark, background too light, etc.)
 *   3. Audited pages contain hardcoded light-only Tailwind classes
 *      (bg-white, text-gray-XXX, text-black, border-gray-XXX, etc.)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dir ?? process.cwd(), '..')
const failures: string[] = []

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

// ---------- 1. body uses semantic tokens ----------
const css = read('src/index.css')
if (!/body\s*\{[^}]*background-color:\s*var\(--background\)/s.test(css)) {
  failures.push('src/index.css: body must set `background-color: var(--background)`')
}
if (!/body\s*\{[^}]*color:\s*var\(--foreground\)/s.test(css)) {
  failures.push('src/index.css: body must set `color: var(--foreground)`')
}

// ---------- 2. .dark token sanity ----------
const darkBlock = css.match(/\.dark\s*\{([^}]+)\}/s)?.[1] ?? ''
const oklch = (name: string) => {
  const m = darkBlock.match(new RegExp(`--${name}:\\s*oklch\\(([0-9.]+)`))
  return m ? parseFloat(m[1]) : NaN
}
const checks: Array<[string, (l: number) => boolean, string]> = [
  ['background', (l) => l < 0.25, 'must be dark (< 0.25)'],
  ['foreground', (l) => l > 0.85, 'must be light (> 0.85)'],
  ['card', (l) => l < 0.3, 'must be dark (< 0.30)'],
  ['card-foreground', (l) => l > 0.85, 'must be light (> 0.85)'],
  ['muted-foreground', (l) => l > 0.6, 'must be readable (> 0.60)'],
]
for (const [name, ok, msg] of checks) {
  const l = oklch(name)
  if (Number.isNaN(l)) failures.push(`.dark is missing --${name}`)
  else if (!ok(l)) failures.push(`.dark --${name} lightness ${l} ${msg}`)
}

// ---------- 3. hardcoded light-only classes in audited pages ----------
const PAGES = [
  'src/pages/Dashboard.tsx',
  'src/pages/Profile.tsx',
  'src/pages/Thread.tsx',
  'src/pages/Category.tsx',
  'src/pages/admin/AdminDashboard.tsx',
  'src/components/layout/Navbar.tsx',
  'src/components/layout/Footer.tsx',
]
// Match only inside className="..." / className={`...`} attribute values
const banned = /\b(bg-white|bg-gray-(?:50|100|200)|text-gray-[5-9]00|text-black|border-gray-(?:200|300)|divide-gray-200)\b/
for (const file of PAGES) {
  const src = read(file)
  // Strip multi-line strings literal-by-literal: only inspect className regions
  const classNames = [...src.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)]
  for (const m of classNames) {
    const value = m[1] ?? m[2] ?? ''
    const hit = value.match(banned)
    if (hit) failures.push(`${file}: hardcoded "${hit[0]}" in className — use semantic token`)
  }
}

if (failures.length) {
  console.error('❌ Dark-mode check failed:\n')
  failures.forEach((f) => console.error('  • ' + f))
  process.exit(1)
}
console.log('✅ Dark-mode check passed')
