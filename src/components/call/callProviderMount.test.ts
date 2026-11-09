// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The website chat has call buttons, so the call system must start for website
// members too. When it was mounted only in the app, every web call failed with
// "Calling is not ready yet" and web members never rang.
describe('call system mount', () => {
  it('starts CallProvider for everyone, not only inside the app', () => {
    const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8')
    expect(app).toMatch(/<CallProvider \/>/)
    expect(app).not.toMatch(/isNativeApp\(\) && \(\s*<>\s*<CallProvider/)
  })
})
