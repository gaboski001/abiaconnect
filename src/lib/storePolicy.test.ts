import { describe, expect, it } from 'vitest'
import { isPaymentLink } from './storePolicy'

describe('isPaymentLink', () => {
  it('spots links to the donate and Premium pages', () => {
    expect(isPaymentLink('/donate')).toBe(true)
    expect(isPaymentLink('https://abiaconnect.com/donate?ref=banner')).toBe(true)
    expect(isPaymentLink('https://www.abiaconnect.com/relationship/premium')).toBe(true)
  })

  it('leaves other links alone', () => {
    expect(isPaymentLink('/create-thread')).toBe(false)
    expect(isPaymentLink('/donate-blood-drive')).toBe(false)
    expect(isPaymentLink('https://example.com/donate')).toBe(false)
    expect(isPaymentLink(null)).toBe(false)
  })
})
