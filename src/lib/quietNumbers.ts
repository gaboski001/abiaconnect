/**
 * While the community is still small, low numbers ("1 member online", "0 views")
 * make busy pages look empty. Below these thresholds we show nothing, or invite a reply.
 */
export const SHOW_ONLINE_FROM = 5
export const SHOW_COUNT_FROM = 10

/** The count if it's worth showing, otherwise null (hide it). */
export function shownCount(n: number | null | undefined, from = SHOW_COUNT_FROM): number | null {
  return n != null && n >= from ? n : null
}
