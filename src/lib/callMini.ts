/**
 * Where the small floating call window sits while the member uses the rest of
 * the app (WhatsApp-style "minimised" call). Pure, so it can be tested.
 */

export type MiniSpot = { left: number; top: number }
export type MiniBox = { width: number; height: number }
export type Viewport = { width: number; height: number; safeTop?: number; safeBottom?: number }

/** Gap kept between the window and the screen edges. */
export const MINI_MARGIN = 12

/** Keeps the window fully on screen. */
export function clampMini(spot: MiniSpot, box: MiniBox, view: Viewport): MiniSpot {
  const top0 = MINI_MARGIN + (view.safeTop ?? 0)
  const maxLeft = Math.max(MINI_MARGIN, view.width - box.width - MINI_MARGIN)
  const maxTop = Math.max(top0, view.height - box.height - MINI_MARGIN - (view.safeBottom ?? 0))
  return {
    left: Math.min(Math.max(spot.left, MINI_MARGIN), maxLeft),
    top: Math.min(Math.max(spot.top, top0), maxTop),
  }
}

/** After a drag, the window slides to the nearer side so it never covers the middle. */
export function snapMini(spot: MiniSpot, box: MiniBox, view: Viewport): MiniSpot {
  const clamped = clampMini(spot, box, view)
  const centre = clamped.left + box.width / 2
  const left = centre < view.width / 2 ? MINI_MARGIN : view.width - box.width - MINI_MARGIN
  return clampMini({ left, top: clamped.top }, box, view)
}

/** First place: top right, under the page header. */
export function startMini(box: MiniBox, view: Viewport): MiniSpot {
  return clampMini({ left: view.width - box.width - MINI_MARGIN, top: 72 + (view.safeTop ?? 0) }, box, view)
}

/** Call states where the call is still going (so it can be minimised). */
export function canMinimiseCall(status: string, direction: string | null) {
  if (status === 'ringing' && direction === 'incoming') return false
  return status === 'calling' || status === 'connecting' || status === 'connected'
}

/** Call length as 1:05 or 1:02:03. */
export function formatCallTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
