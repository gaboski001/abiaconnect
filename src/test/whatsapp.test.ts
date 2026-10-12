import { describe, expect, it } from 'vitest'
import { formatWhatsAppNumber, normaliseWhatsAppNumber } from '@/lib/whatsapp'

describe('WhatsApp number', () => {
  it('accepts a Nigerian number typed the local or the international way', () => {
    for (const typed of ['0801 234 5678', '08012345678', '+234 801 234 5678', '2348012345678', '00234-801-234-5678', '+234(801)2345678']) {
      expect(normaliseWhatsAppNumber(typed)).toBe('+2348012345678')
    }
  })

  it('accepts numbers from other countries when the country code is given', () => {
    expect(normaliseWhatsAppNumber('+44 7911 123456')).toBe('+447911123456')
    expect(normaliseWhatsAppNumber('+1 (202) 555-0143')).toBe('+12025550143')
    expect(normaliseWhatsAppNumber('0044 7911 123456')).toBe('+447911123456')
  })

  it('refuses what cannot be a phone number', () => {
    for (const typed of ['', '   ', '12345', '0801234567', '7911 123456', '+0801234567', 'call me', '+234 801 234 5678 9999 000']) {
      expect(normaliseWhatsAppNumber(typed)).toBeNull()
    }
  })

  it('shows a saved number in a readable form', () => {
    expect(formatWhatsAppNumber('+2348012345678')).toBe('+234 801 234 5678')
    expect(formatWhatsAppNumber('+447911123456')).toBe('+447911123456')
  })
})
