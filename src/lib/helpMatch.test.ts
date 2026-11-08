import { describe, expect, it } from 'vitest'
import { findAnswers, intentOf } from './helpMatch'

const top = (q: string) => findAnswers(q)[0]?.item.q

describe('findAnswers', () => {
  it('finds the right answer in everyday words', () => {
    expect(top('how do i change my pic')).toBe('How do I change my profile picture?')
    expect(top('I want to sign up')).toBe('How do I create an AbiaConnect account?')
    expect(top("didn't get the verification email")).toBe('I did not receive my verification email. What should I do?')
    expect(top('someone is bullying me')).toBe('I am being harassed by another member. What should I do?')
    expect(top('my post was hidden')).toBe('One of my posts was hidden. What can I do?')
    expect(top('how can I volunteer')).toBe('How do I volunteer with AbiaConnect?')
    expect(top('add an event')).toBe('How do I add an event to the Events Calendar?')
    expect(top('nominate my friend for member of the month')).toBe('How do I nominate someone for Member of the Month?')
    expect(top('delete my account')).toBe('How do I delete my account?')
  })

  it('returns nothing when the Help Centre has no answer', () => {
    expect(findAnswers('what is the price of garri in Aba market')).toEqual([])
    expect(findAnswers('???')).toEqual([])
  })

  it('offers at most three answers', () => {
    expect(findAnswers('account email post report event').length).toBeLessThanOrEqual(3)
  })
})

describe('intentOf', () => {
  it('spots greetings, thanks and asking for a person', () => {
    expect(intentOf('Hello')).toBe('hello')
    expect(intentOf('good evening')).toBe('hello')
    expect(intentOf('thank you')).toBe('thanks')
    expect(intentOf('can I talk to a real person')).toBe('human')
    expect(intentOf('how do I post')).toBeNull()
  })
})
