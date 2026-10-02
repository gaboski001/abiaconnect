// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  RELEASE_MAX_BYTES,
  checkReleasePackage,
  extensionMatches,
  releaseStoragePath,
  safeEqual,
} from '../../supabase/functions/_shared/release-package'
import { buildCallPush, parseCallRequest, sanitizeFreePush } from '../../supabase/functions/_shared/push-policy'

/** Minimal ZIP writer (stored entries) so tests can build real and fake packages. */
function zip(entries: Array<[string, string | Uint8Array]>, padTo = 8192): Uint8Array {
  const enc = new TextEncoder()
  const parts: number[] = []
  const central: number[] = []
  const push16 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff)
  const push32 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff)
  for (const [name, body] of entries) {
    const n = enc.encode(name)
    const data = typeof body === 'string' ? enc.encode(body) : body
    const offset = parts.length
    push32(parts, 0x04034b50); push16(parts, 20); push16(parts, 0); push16(parts, 0)
    push16(parts, 0); push16(parts, 0); push32(parts, 0)
    push32(parts, data.length); push32(parts, data.length)
    push16(parts, n.length); push16(parts, 0)
    parts.push(...n, ...data)
    push32(central, 0x02014b50); push16(central, 20); push16(central, 20); push16(central, 0); push16(central, 0)
    push16(central, 0); push16(central, 0); push32(central, 0)
    push32(central, data.length); push32(central, data.length)
    push16(central, n.length); push16(central, 0); push16(central, 0); push16(central, 0); push16(central, 0)
    push32(central, 0); push32(central, offset)
    central.push(...n)
  }
  // Pad the last entry's data region so the package passes the minimum size.
  const pad = Math.max(0, padTo - parts.length - central.length - 22)
  const dirOffset = parts.length + pad
  const out: number[] = [...parts, ...new Array(pad).fill(0), ...central]
  push32(out, 0x06054b50); push16(out, 0); push16(out, 0)
  push16(out, entries.length); push16(out, entries.length)
  push32(out, central.length); push32(out, dirOffset); push16(out, 0)
  return Uint8Array.from(out)
}

const apk = () => zip([['AndroidManifest.xml', 'manifest'], ['classes.dex', 'dex\n035'], ['res/x.png', 'png']])
const ipa = () => zip([['Payload/AbiaConnect.app/Info.plist', 'plist'], ['Payload/AbiaConnect.app/AbiaConnect', 'bin']])

describe('release upload validation (server side)', () => {
  it('accepts a genuine Android and iOS package', () => {
    expect(checkReleasePackage('android', apk()).ok).toBe(true)
    expect(checkReleasePackage('ios', ipa()).ok).toBe(true)
  })

  const realApk = resolve(__dirname, '../../android/app/build/outputs/apk/debug/app-debug.apk')
  it.skipIf(!existsSync(realApk))('accepts the real AbiaConnect APK built from this project', () => {
    const r = checkReleasePackage('android', new Uint8Array(readFileSync(realApk)))
    expect(r).toMatchObject({ ok: true })
  })

  it('rejects an oversized file', () => {
    const big = new Uint8Array(RELEASE_MAX_BYTES + 1)
    big.set(apk())
    expect(checkReleasePackage('android', big)).toEqual({ ok: false, reason: 'file is larger than 100 MB' })
  })

  it('rejects a Windows executable renamed to .apk (spoofed type)', () => {
    const exe = new Uint8Array(16384)
    exe.set([0x4d, 0x5a, 0x90, 0x00]) // "MZ" header
    expect(checkReleasePackage('android', exe)).toMatchObject({ ok: false, reason: 'not a ZIP-based app package' })
  })

  it('rejects a script or HTML page renamed to .apk', () => {
    const script = new TextEncoder().encode('#!/bin/sh\nrm -rf /\n'.padEnd(8192, '#'))
    const html = new TextEncoder().encode('<script>alert(1)</script>'.padEnd(8192, ' '))
    expect(checkReleasePackage('android', script).ok).toBe(false)
    expect(checkReleasePackage('android', html).ok).toBe(false)
  })

  it('rejects an ordinary ZIP that is not an app', () => {
    const plain = zip([['malware.exe', 'MZ'], ['readme.txt', 'hi']])
    expect(checkReleasePackage('android', plain)).toMatchObject({ ok: false, reason: 'not an Android app (APK) package' })
    expect(checkReleasePackage('ios', plain)).toMatchObject({ ok: false, reason: 'not an iOS app (IPA) package' })
  })

  it('rejects an APK uploaded as iOS and vice versa', () => {
    expect(checkReleasePackage('ios', apk()).ok).toBe(false)
    expect(checkReleasePackage('android', ipa()).ok).toBe(false)
  })

  it('rejects malformed / truncated packages', () => {
    const good = apk()
    expect(checkReleasePackage('android', good.slice(0, good.length - 30)).ok).toBe(false) // index cut off
    const corrupt = good.slice()
    corrupt[corrupt.length - 6] = 0xff // directory offset points past the end
    expect(checkReleasePackage('android', corrupt).ok).toBe(false)
    expect(checkReleasePackage('android', new Uint8Array(10)).ok).toBe(false) // too small
  })

  it('rejects packages containing path traversal entries', () => {
    for (const bad of ['../../etc/passwd', '/abs/file', 'C:/win.ini', 'a\\..\\b']) {
      const z = zip([['AndroidManifest.xml', 'm'], ['classes.dex', 'd'], [bad, 'x']])
      expect(checkReleasePackage('android', z), bad).toMatchObject({ ok: false, reason: 'package contains unsafe file paths' })
    }
  })

  it('requires the right extension on the client file name', () => {
    expect(extensionMatches('android', 'AbiaConnect.APK')).toBe(true)
    expect(extensionMatches('android', 'evil.exe')).toBe(false)
    expect(extensionMatches('android', 'evil.apk.exe')).toBe(false)
    expect(extensionMatches('ios', 'app.apk')).toBe(false)
  })

  it('stores files under server-chosen names only (no traversal, no overwrite)', () => {
    const id = '3f1c2a9e-1111-4222-8333-944455556666'
    expect(releaseStoragePath('android', '1.0.3', id)).toBe(`android/abiaconnect-1.0.3-${id}.apk`)
    expect(() => releaseStoragePath('android', '../../x', id)).toThrow()
    expect(() => releaseStoragePath('android', '1.0.3', '../other')).toThrow()
  })

  it('compares the upload token in constant time and rejects near misses', () => {
    const t = 'a'.repeat(40)
    expect(safeEqual(t, t)).toBe(true)
    expect(safeEqual(t, 'a'.repeat(39) + 'b')).toBe(false)
    expect(safeEqual(t, '')).toBe(false)
    expect(safeEqual('', '')).toBe(false)
  })
})

describe('push alert rules', () => {
  it('only treats well-formed call alerts as member-to-member pushes', () => {
    const current = { userId: 'x', title: 'Hi', message: 'm', data: { type: 'call', callId: 'c-1727000000000-abc1234', callType: 'video' } }
    expect(parseCallRequest(current)).toEqual({ callId: 'c-1727000000000-abc1234', callType: 'video' })
    expect(parseCallRequest({ title: 'You won a prize', message: 'click here' })).toBeNull()
    expect(parseCallRequest({ data: { type: 'call', callId: 'c-1', callType: 'voice' } })).toBeNull() // id too short
    expect(parseCallRequest({ data: { type: 'call', callId: 'c-1727000000000-abc1234', callType: 'sms' } })).toBeNull()
    expect(parseCallRequest({ data: { type: 'call', callId: 'c-17270000/../x', callType: 'voice' } })).toBeNull()
  })

  it('writes call alert text on the server, ignoring anything the caller sent', () => {
    const p = buildCallPush({ callerId: 'u1', callerName: 'Ada\nOkafor', callId: 'c-1727000000000-abc1234', callType: 'voice', conversationId: 'conv1' })
    expect(p.title).toBe('Incoming call')
    expect(p.message).toBe('Ada Okafor is calling you on AbiaConnect')
    expect(p.data).toMatchObject({ type: 'call', url: '/messages/conv1', conversationId: 'conv1' })
  })

  it('limits free-text alerts and keeps links inside the app', () => {
    const p = sanitizeFreePush({ title: 'T'.repeat(500), message: 'M', data: { url: 'https://phish.example', extra: 1, title: 'x' } })!
    expect(p.title).toHaveLength(100)
    expect(p.data.url).toBeUndefined()
    expect(p.data.title).toBeUndefined()
    expect(sanitizeFreePush({ title: 'T', message: 'M', data: { url: '//evil.example' } })!.data.url).toBeUndefined()
    expect(sanitizeFreePush({ title: 'T', message: 'M', data: { url: '/notifications' } })!.data.url).toBe('/notifications')
    expect(sanitizeFreePush({ title: '', message: 'M' })).toBeNull()
  })
})
