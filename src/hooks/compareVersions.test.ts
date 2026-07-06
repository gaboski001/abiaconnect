import { describe, it, expect } from 'vitest'
import { compareVersions } from './useAppUpdate'

/**
 * Semantic-version edge-case coverage for the update banner. Every case here
 * mirrors a value that could realistically come from `app_releases.version`
 * or `@capacitor/app` `App.getInfo().version`. The goal: the "Update
 * available" banner must ONLY light up when compareVersions(latest, installed)
 * is strictly positive.
 */

const newer = (a: string, b: string) => compareVersions(a, b) > 0
const equal = (a: string, b: string) => compareVersions(a, b) === 0
const older = (a: string, b: string) => compareVersions(a, b) < 0

describe('compareVersions — plain semver', () => {
  it('detects strictly newer patch / minor / major', () => {
    expect(newer('1.2.4', '1.2.3')).toBe(true)
    expect(newer('1.3.0', '1.2.9')).toBe(true)
    expect(newer('2.0.0', '1.99.99')).toBe(true)
  })
  it('treats identical versions as equal', () => {
    expect(equal('4.0.1', '4.0.1')).toBe(true)
  })
  it('treats older versions as older', () => {
    expect(older('1.2.3', '1.2.4')).toBe(true)
    expect(older('4.0.0', '4.0.1')).toBe(true)
  })
  it('handles missing trailing segments (1.2 vs 1.2.0)', () => {
    expect(equal('1.2', '1.2.0')).toBe(true)
    expect(newer('1.2.1', '1.2')).toBe(true)
  })
})

describe('compareVersions — pre-release tags', () => {
  it('release version is newer than its pre-release (1.2.3 > 1.2.3-beta)', () => {
    expect(newer('1.2.3', '1.2.3-beta')).toBe(true)
    expect(older('1.2.3-beta', '1.2.3')).toBe(true)
  })
  it('does NOT flag banner when installed release matches pre-release core', () => {
    // Installed 1.2.3, latest release row is 1.2.3-beta → must NOT show update.
    expect(newer('1.2.3-beta', '1.2.3')).toBe(false)
  })
  it('compares two pre-release tags lexicographically', () => {
    expect(newer('1.2.3-beta.2', '1.2.3-beta.1')).toBe(true)
    expect(older('1.2.3-alpha', '1.2.3-beta')).toBe(true)
    expect(equal('1.2.3-rc.1', '1.2.3-rc.1')).toBe(true)
  })
  it('a newer core beats any pre-release tag on an older core', () => {
    expect(newer('1.2.4', '1.2.3-rc.9')).toBe(true)
    expect(newer('1.2.4-alpha', '1.2.3')).toBe(true)
  })
})

describe('compareVersions — build metadata (must be ignored)', () => {
  it('same core with different +build metadata is equal', () => {
    expect(equal('1.2.3+build.1', '1.2.3+build.2')).toBe(true)
    expect(equal('4.0.1+ci.42', '4.0.1')).toBe(true)
  })
  it('build metadata never turns older into newer', () => {
    expect(newer('1.2.3+build.999', '1.2.4')).toBe(false)
    expect(older('1.2.3+build.999', '1.2.4')).toBe(true)
  })
  it('build metadata is stripped before pre-release comparison', () => {
    expect(equal('1.2.3-beta+build.1', '1.2.3-beta+build.9')).toBe(true)
    expect(newer('1.2.3+build.1', '1.2.3-beta+build.9')).toBe(true)
  })
})

describe('compareVersions — banner-safety scenarios', () => {
  // These are the exact checks the useAppUpdate hook runs before showing the
  // "Update available" card. Each row asserts we do NOT nag the user for a
  // version that isn't actually newer than what they have installed.
  const cases: Array<[string, string, boolean]> = [
    ['4.0.1', '4.0.1', false], // same version → no banner
    ['4.0.1', '4.0.2', false], // installed newer than release → no banner
    ['4.0.2', '4.0.1', true], // release newer → banner
    ['4.0.1-beta', '4.0.1', false], // pre-release row vs released install → no banner
    ['4.0.1', '4.0.1-beta', true], // released row vs pre-release install → banner
    ['4.0.1+build.5', '4.0.1+build.4', false], // build metadata only → no banner
    ['4.1.0', '4.0.9-rc.1', true], // real minor bump over rc → banner
  ]
  it.each(cases)('release=%s installed=%s → showBanner=%s', (release, installed, expected) => {
    expect(compareVersions(release, installed) > 0).toBe(expected)
  })
})
