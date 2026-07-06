/**
 * Contrast/color regression test for the chat composer.
 *
 * Guards against the "invisible typing text" bug where the composer's
 * text color and background collapse into the same tone (light theme
 * especially). Verifies:
 *   1. The <Textarea> in src/pages/Messages.tsx uses `bg-background` and
 *      `text-foreground` (solid, tokenized surface + ink pair).
 *   2. The WCAG contrast between --background and --foreground in both
 *      :root (light) and .dark exceeds AA (>= 4.5).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

// ---------- oklch -> sRGB -> WCAG contrast ----------
function oklchToLinearRgb(L: number, C: number, hDeg: number) {
  const h = (hDeg * Math.PI) / 180
  const a = Math.cos(h) * C
  const b = Math.sin(h) * C
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
const srgbEncode = (c: number) => {
  const x = Math.max(0, Math.min(1, c))
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
}
const relLum = (r: number, g: number, b: number) => {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrastFromOklch(fg: number[], bg: number[]) {
  const toLum = ([L, C, h]: number[]) => {
    const [lr, lg, lb] = oklchToLinearRgb(L, C, h).map((c) =>
      Math.max(0, Math.min(1, srgbEncode(c))),
    )
    return relLum(lr, lg, lb)
  }
  const l1 = toLum(fg), l2 = toLum(bg)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

function parseOklch(css: string, block: RegExp, name: string): number[] {
  const b = css.match(block)?.[0] ?? ''
  const m = b.match(new RegExp(`--${name}:\\s*oklch\\(\\s*([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)`))
  if (!m) throw new Error(`Missing --${name} in block`)
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
}

describe('chat composer contrast', () => {
  const messages = read('src/pages/Messages.tsx')

  it('composer textarea uses tokenized background + foreground pair', () => {
    // Locate the composer textarea (placeholder is our anchor).
    const idx = messages.indexOf('placeholder="Write a message..."')
    expect(idx).toBeGreaterThan(-1)
    // Grab a window around it and check the className.
    const chunk = messages.slice(Math.max(0, idx - 800), idx + 400)
    expect(chunk).toMatch(/bg-background/)
    expect(chunk).toMatch(/text-foreground/)
    expect(chunk).toMatch(/placeholder:text-muted-foreground/)
    // Regression guard: don't reintroduce the muted-only fill.
    expect(chunk).not.toMatch(/bg-muted\/60/)
  })

  it('light theme --foreground vs --background meets WCAG AA (>= 4.5)', () => {
    const css = read('src/index.css')
    const bg = parseOklch(css, /:root\s*\{[^}]+\}/s, 'background')
    const fg = parseOklch(css, /:root\s*\{[^}]+\}/s, 'foreground')
    const ratio = contrastFromOklch(fg, bg)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('dark theme --foreground vs --background meets WCAG AA (>= 4.5)', () => {
    const css = read('src/index.css')
    const bg = parseOklch(css, /\.dark\s*\{[^}]+\}/s, 'background')
    const fg = parseOklch(css, /\.dark\s*\{[^}]+\}/s, 'foreground')
    const ratio = contrastFromOklch(fg, bg)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})
