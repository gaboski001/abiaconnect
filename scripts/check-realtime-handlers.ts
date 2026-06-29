/**
 * Lint gate: forbid `invalidateQueries(...)` inside `useRealtimeChannel({...})`
 * realtime handlers.
 *
 * Realtime handlers fire once per row change and will flood React Query with
 * refetches if they call `invalidateQueries` directly. The project rule is:
 *
 *   - Wrap the invalidator in `useThrottledCallback(..., <ms>)` and call the
 *     throttled function from the handler.
 *
 * This script does a balanced-brace scan to find each `useRealtimeChannel({ ... })`
 * call expression and fails CI if the literal string `invalidateQueries(` appears
 * anywhere inside that argument object.
 *
 * Usage:  tsx scripts/check-realtime-handlers.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const EXTS = new Set(['.ts', '.tsx'])

type Finding = { file: string; line: number; snippet: string }
const findings: Finding[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (EXTS.has(extname(full))) out.push(full)
  }
  return out
}

/** Find the matching `)` for a `(` at startIdx, respecting strings / templates / comments. */
function findMatchingParen(src: string, startIdx: number): number {
  let depth = 0
  let i = startIdx
  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]
    // line comment
    if (ch === '/' && next === '/') {
      const nl = src.indexOf('\n', i)
      i = nl === -1 ? src.length : nl + 1
      continue
    }
    // block comment
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    // string / template
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === quote) { i++; break }
        // template substitution
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          // skip to matching } using paren-style scan
          let braceDepth = 1
          i += 2
          while (i < src.length && braceDepth > 0) {
            if (src[i] === '{') braceDepth++
            else if (src[i] === '}') braceDepth--
            i++
          }
          continue
        }
        i++
      }
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

function lineOf(src: string, idx: number): number {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

for (const file of walk(SRC)) {
  // Don't lint the hook implementation itself or its tests.
  if (file.endsWith('useRealtimeChannel.ts')) continue
  const src = readFileSync(file, 'utf8')
  const needle = 'useRealtimeChannel('
  let from = 0
  while (true) {
    const hit = src.indexOf(needle, from)
    if (hit === -1) break
    const parenOpen = hit + needle.length - 1
    const parenClose = findMatchingParen(src, parenOpen)
    if (parenClose === -1) break
    const body = src.slice(parenOpen + 1, parenClose)
    const bad = body.indexOf('invalidateQueries(')
    if (bad !== -1) {
      const absIdx = parenOpen + 1 + bad
      findings.push({
        file: relative(ROOT, file),
        line: lineOf(src, absIdx),
        snippet: src.slice(Math.max(0, absIdx - 30), absIdx + 60).replace(/\s+/g, ' '),
      })
    }
    from = parenClose + 1
  }
}

if (findings.length) {
  console.error(
    `\n✖ check-realtime-handlers: ${findings.length} forbidden invalidateQueries usage(s) inside useRealtimeChannel:\n`,
  )
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`)
    console.error(`    …${f.snippet}…`)
  }
  console.error(
    `\nWrap the invalidator in useThrottledCallback(..., 600-800) and call the throttled function from the handler.\n`,
  )
  process.exit(1)
}

console.log('✓ check-realtime-handlers: no invalidateQueries inside useRealtimeChannel handlers')
