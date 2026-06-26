/**
 * Static security gate for CI.
 *
 * Catches the two finding classes the live security scanner flags most often,
 * but does it from the repo alone so it can run in GitHub Actions without
 * network access to Supabase:
 *
 *  1. Sensitive-key exposure
 *     - Hardcoded service_role JWTs anywhere in the repo (outside of
 *       node_modules / dist / build artifacts).
 *     - Forbidden secret env names referenced from frontend (`src/`) code.
 *       Backend Edge Functions and scripts are allowed to read these.
 *
 *  2. RLS exposure in NEW migrations
 *     - Any `CREATE TABLE public.<name>` introduced in a migration must be
 *       followed (in the SAME file) by `ALTER TABLE ... ENABLE ROW LEVEL
 *       SECURITY` and at least one `CREATE POLICY` for that table.
 *     - Any `CREATE TABLE public.<name>` must also have a `GRANT ... ON
 *       public.<name>` in the same file (PostgREST needs it; otherwise the
 *       table is effectively dead but the API surface is still considered
 *       a misconfiguration).
 *
 * Exits 1 on any finding so the CI job fails.
 *
 * Usage:  tsx scripts/check-security.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

type Finding = { file: string; rule: string; detail: string }
const findings: Finding[] = []

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  'android',
  'ios',
  'coverage',
  '.next',
  '.turbo',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue
    const p = join(dir, name)
    let s
    try {
      s = statSync(p)
    } catch {
      continue
    }
    if (s.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// ────────────────────────────────────────────────────────────────
// 1. Service-role JWT scan
// ────────────────────────────────────────────────────────────────
function isServiceRoleJwt(text: string): string | null {
  const jwtRe = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
  for (const match of text.match(jwtRe) ?? []) {
    try {
      const json = Buffer.from(
        match.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8')
      if (/"role"\s*:\s*"service_role"/.test(json)) {
        return match.slice(0, 24) + '…'
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

// Names that must never be read by code shipped to the browser.
const FRONTEND_FORBIDDEN = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'SUPABASE_SECRET_KEYS',
  'FCM_SERVICE_ACCOUNT',
]

const SCANNABLE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.html',
  '.css',
  '.md',
  '.sql',
  '.yml',
  '.yaml',
])

const allFiles = walk('.').filter((f) => SCANNABLE_EXT.has(extname(f).toLowerCase()))

for (const file of allFiles) {
  const rel = relative('.', file)
  // Skip self and the leak scanner that intentionally mentions the names.
  if (rel === 'scripts/check-security.ts' || rel === 'scripts/check-no-backend-leaks.ts') continue

  const text = readFileSync(file, 'utf8')

  const sr = isServiceRoleJwt(text)
  if (sr) {
    findings.push({ file: rel, rule: 'service_role JWT hardcoded', detail: sr })
  }

  // Forbidden env-name reads from frontend code only.
  if (rel.startsWith('src/')) {
    for (const name of FRONTEND_FORBIDDEN) {
      if (text.includes(name)) {
        findings.push({
          file: rel,
          rule: 'sensitive secret referenced in frontend',
          detail: name,
        })
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 2. RLS / GRANT regression scan on every migration
// ────────────────────────────────────────────────────────────────
const MIGRATIONS_DIR = 'supabase/migrations'
function listMigrations(): string[] {
  try {
    return readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => join(MIGRATIONS_DIR, f))
  } catch {
    return []
  }
}

const CREATE_TABLE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["]?([a-zA-Z_][a-zA-Z0-9_]*)["]?/gi

for (const mig of listMigrations()) {
  const sql = readFileSync(mig, 'utf8')
  const lower = sql.toLowerCase()
  const rel = relative('.', mig)

  for (const m of sql.matchAll(CREATE_TABLE_RE)) {
    const table = m[1].toLowerCase()
    // Skip non-public schemas explicitly referenced.
    const full = m[0].toLowerCase()
    if (/\b(auth|storage|realtime|pgmq|vault|supabase_functions)\./.test(full)) continue

    const hasRls = new RegExp(
      String.raw`alter\s+table\s+(?:public\.)?["]?${table}["]?\s+enable\s+row\s+level\s+security`,
      'i',
    ).test(sql)
    const hasPolicy = new RegExp(
      String.raw`create\s+policy[\s\S]*?on\s+(?:public\.)?["]?${table}["]?`,
      'i',
    ).test(sql)
    const hasGrant = new RegExp(
      String.raw`grant\s+[^;]+\s+on\s+(?:table\s+)?(?:public\.)?["]?${table}["]?`,
      'i',
    ).test(sql)

    if (!hasRls) {
      findings.push({
        file: rel,
        rule: 'RLS not enabled on new public table',
        detail: `public.${table}`,
      })
    }
    if (!hasPolicy) {
      findings.push({
        file: rel,
        rule: 'No CREATE POLICY for new public table',
        detail: `public.${table}`,
      })
    }
    if (!hasGrant) {
      findings.push({
        file: rel,
        rule: 'No GRANT for new public table',
        detail: `public.${table}`,
      })
    }
  }

  // Catch explicit RLS disables.
  if (/disable\s+row\s+level\s+security/i.test(lower)) {
    findings.push({
      file: rel,
      rule: 'Migration disables RLS',
      detail: 'DISABLE ROW LEVEL SECURITY found',
    })
  }
}

// ────────────────────────────────────────────────────────────────
// Report
// ────────────────────────────────────────────────────────────────
if (findings.length) {
  console.error('✗ Security gate failed:\n')
  for (const f of findings) {
    console.error(`  - [${f.rule}] ${f.file} → ${f.detail}`)
  }
  console.error(`\n${findings.length} issue(s) must be fixed before this build can ship.`)
  process.exit(1)
}

console.log('✓ Security gate passed: no sensitive-key or RLS exposure detected.')
