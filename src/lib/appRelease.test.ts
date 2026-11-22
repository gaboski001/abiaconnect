import { describe, expect, it } from 'vitest'
import {
  ANDROID_RELEASE_NOTES,
  androidUpdateAvailable,
  GET_APP_SNOOZE_MS,
  isAndroidBrowser,
  LATEST_ANDROID_RELEASE,
  PLAY_STORE_URL,
  playStoreLink,
  shouldOfferApp,
} from './appRelease'

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'

describe('Google Play link', () => {
  it('uses the app page when admins have not saved one', () => {
    expect(playStoreLink(null)).toBe('https://play.google.com/store/apps/details?id=com.abiaconnect.app')
    expect(playStoreLink('')).toBe(PLAY_STORE_URL)
  })

  it('keeps a saved Play link but never another site', () => {
    expect(playStoreLink('https://play.google.com/store/apps/details?id=com.abiaconnect.app&hl=en')).toContain('hl=en')
    expect(playStoreLink('https://evil.example/app.apk')).toBe(PLAY_STORE_URL)
  })
})

describe('who is offered the app', () => {
  const now = Date.parse('2026-11-23T12:00:00Z')

  it('only Android browsers, never inside the app or on iPhone', () => {
    expect(isAndroidBrowser(ANDROID_UA, false)).toBe(true)
    expect(isAndroidBrowser(ANDROID_UA, true)).toBe(false)
    expect(isAndroidBrowser(IPHONE_UA, false)).toBe(false)
  })

  it('asks Android visitors without the app', () => {
    expect(shouldOfferApp({ androidBrowser: true, hasAppOnAccount: false, snoozedAt: null, now })).toBe(true)
  })

  it('never asks members who already have the app', () => {
    expect(shouldOfferApp({ androidBrowser: true, hasAppOnAccount: true, snoozedAt: null, now })).toBe(false)
  })

  it('waits a week after Not now', () => {
    expect(shouldOfferApp({ androidBrowser: true, hasAppOnAccount: false, snoozedAt: now - 1000, now })).toBe(false)
    expect(
      shouldOfferApp({ androidBrowser: true, hasAppOnAccount: false, snoozedAt: now - GET_APP_SNOOZE_MS - 1, now }),
    ).toBe(true)
  })

  it('never asks other devices', () => {
    expect(shouldOfferApp({ androidBrowser: false, hasAppOnAccount: false, snoozedAt: null, now })).toBe(false)
  })
})

describe('app updates', () => {
  it('tells older apps to update from Google Play', () => {
    expect(androidUpdateAvailable('1.0.3', '1.1.2')).toBe(true)
    expect(androidUpdateAvailable('1.1.1', '1.1.2')).toBe(true)
  })

  it('stays quiet when up to date or the version is unknown', () => {
    expect(androidUpdateAvailable('1.1.2', '1.1.2')).toBe(false)
    expect(androidUpdateAvailable('1.1.3', '1.1.2')).toBe(false)
    expect(androidUpdateAvailable(null, '1.1.2')).toBe(false)
  })

  it('has plain-words notes for the live version', () => {
    expect(ANDROID_RELEASE_NOTES[LATEST_ANDROID_RELEASE.version]).toBeTruthy()
  })
})
