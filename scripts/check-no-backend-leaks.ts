/**
 * Build-output leak scanner.
 *
 * Fails the build (exit 1) if the production bundle exposes secrets or shows
 * the raw Supabase project URL as user-visible content.
 *
 * Rules:
 *  1. NO service_role JWTs anywhere in dist/ — these would let any visitor
 *     bypass RLS. They must never reach the client bundle.
 *  2. NO occurrences of obvious secret env names (SERVICE_ROLE, DB_URL,
 *     SUPABASE_SECRET_KEYS) in dist/ source text.
 *  3. The Supabase project URL (https://<ref>.supabase.co) may appear inside
 *     JS chunks — the client uses it to talk to the API — but it must NOT
 *     appear as visible text in any rendered HTML page in dist/.
 *
 * Usage:  tsx scripts/check-no-backend-leaks.ts   (run after `vite build`)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const DIST = 'dist'
const PROJECT_REF = 'tnwgnowjmrbjugheorkv'
const SUPABASE_HOST = `${PROJECT_REF}.supabase.co`

type Finding = { file: string; rule: string; detail: string }
const findings: Finding[] = []

if (!existsSync(DIST)) {
  console.error(`✗ ${DIST}/ not found. Run \`npm run build\` first.`)
  process.exit(2)
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// service_role JWTs always contain the literal "service_role" claim once
// base64-decoded, but the encoded form has a stable signature too: any JWT
// payload whose decoded body includes "service_role".
function looksLikeServiceRoleJwt(text: string): string | null {
  const jwtRe = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
  for (const match of text.match(jwtRe) ?? []) {
    try {
      const payload = match.split('.')[1]
      const json = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8')
      if (/"role"\s*:\s*"service_role"/.test(json)) return match.slice(0, 24) + '…'
    } catch {
      /* ignore */
    }
  }
  return null
}

// Strip <script>/<style> and tags to get user-visible text from HTML.
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
}

const FORBIDDEN_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL', 'SUPABASE_SECRET_KEYS']

for (const file of walk(DIST)) {
  const ext = extname(file).toLowerCase()
  if (!['.html', '.js', '.mjs', '.cjs', '.css', '.json', '.txt', '.map'].includes(ext)) continue
  const text = readFileSync(file, 'utf8')

  const sr = looksLikeServiceRoleJwt(text)
  if (sr) findings.push({ file, rule: 'service_role JWT', detail: sr })

  for (const name of FORBIDDEN_NAMES) {
    if (text.includes(name)) findings.push({ file, rule: 'secret env name', detail: name })
  }

  if (ext === '.html') {
    const vis = visibleText(text)
    if (vis.includes(SUPABASE_HOST)) {
      findings.push({
        file,
        rule: 'visible Supabase host',
        detail: SUPABASE_HOST,
      })
    }
  }
}

if (findings.length) {
  console.error('✗ Backend-leak scan failed:')
  for (const f of findings) {
    console.error(`  - [${f.rule}] ${f.file} → ${f.detail}`)
  }
  process.exit(1)
}

console.log('✓ No backend URL/service_role leaks found in dist/.')
