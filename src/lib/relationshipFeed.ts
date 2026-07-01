/**
 * Pure selection helper for the Relationship feed.
 *
 * - When filters are active: return the full ranked/paginated list unchanged
 *   (no shuffle, no 10-cap).
 * - When no filters are active: return up to `randomCap` items in a
 *   deterministic seeded Fisher–Yates order.
 */
export function selectRelationshipCards<T>(
  all: T[],
  hasActiveFilters: boolean,
  seed: number,
  randomCap = 10,
): T[] {
  if (hasActiveFilters) return all
  const rng = (i: number) => {
    const x = Math.sin((i + 1) * 9999 * seed) * 10000
    return x - Math.floor(x)
  }
  const arr = [...all]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng(i) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, randomCap)
}
