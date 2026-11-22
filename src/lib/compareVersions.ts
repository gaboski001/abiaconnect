/**
 * Compare two version strings numerically, segment by segment.
 *
 * Handles SemVer-style pre-release and build-metadata suffixes so we never
 * treat `1.2.3-beta` or `1.2.3+build.7` as a "newer" version than `1.2.3`.
 * Rules:
 *   - Strip build metadata (everything after `+`) — SemVer says it's ignored.
 *   - Split off the pre-release tag (everything after `-`).
 *   - Compare numeric MAJOR.MINOR.PATCH first.
 *   - If those are equal, a version WITHOUT a pre-release tag is greater
 *     than one WITH a pre-release tag (1.2.3 > 1.2.3-beta).
 *   - Two pre-release tags compare lexicographically (1.2.3-beta.2 > 1.2.3-beta.1).
 * Returns negative if a<b, positive if a>b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const noBuild = v.split('+')[0] ?? ''
    const [core, ...preParts] = noBuild.split('-')
    const pre = preParts.join('-') // preserve dashes inside pre-release tag
    const nums = (core || '').split('.').map((n) => parseInt(n, 10) || 0)
    return { nums, pre }
  }
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.nums.length, pb.nums.length)
  for (let i = 0; i < len; i++) {
    const d = (pa.nums[i] || 0) - (pb.nums[i] || 0)
    if (d !== 0) return d
  }
  // Numeric core is equal — apply SemVer pre-release rule.
  if (!pa.pre && pb.pre) return 1 // 1.2.3 > 1.2.3-beta
  if (pa.pre && !pb.pre) return -1 // 1.2.3-beta < 1.2.3
  if (pa.pre && pb.pre) return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0
  return 0
}
