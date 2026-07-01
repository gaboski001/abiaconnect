import { describe, it, expect } from 'vitest'
import { selectRelationshipCards } from './relationshipFeed'

const makeCards = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, rank: i }))

describe('selectRelationshipCards — filter behaviour', () => {
  it('returns the full ranked/paginated list unchanged when filters are active (no shuffle, no 10-cap)', () => {
    const all = makeCards(24)
    const out = selectRelationshipCards(all, true, 0.42)

    // Same reference-order as input: no shuffle
    expect(out).toEqual(all)
    // No 10-cap when filters are active
    expect(out.length).toBe(24)
    expect(out.length).toBeGreaterThan(10)
    // Order preserved exactly
    expect(out.map((c) => c.id)).toEqual(all.map((c) => c.id))
  })

  it('preserves ranked order across many pages when filters are active', () => {
    const all = makeCards(120)
    const out = selectRelationshipCards(all, true, Math.random())
    expect(out.map((c) => c.rank)).toEqual(all.map((c) => c.rank))
  })

  it('caps at 10 and shuffles when no filters are active', () => {
    const all = makeCards(24)
    const out = selectRelationshipCards(all, false, 0.42)
    expect(out.length).toBe(10)
    // With this seed the order is not identical to input
    expect(out.map((c) => c.id)).not.toEqual(all.slice(0, 10).map((c) => c.id))
  })

  it('does not cap when the input is already smaller than the cap', () => {
    const all = makeCards(5)
    const filtered = selectRelationshipCards(all, true, 0.1)
    const random = selectRelationshipCards(all, false, 0.1)
    expect(filtered.length).toBe(5)
    expect(random.length).toBe(5)
  })
})
