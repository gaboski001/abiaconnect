import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { cn } from '@/lib/utils'

// The chat itself (with all the Help Centre answers) downloads on first open only.
const SupportChat = lazy(() => import('./SupportChat').then((m) => ({ default: m.SupportChat })))

const OPEN_EVENT = 'abia:open-support-chat'

/** Opens the support chat from anywhere (the Help page). */
export function openSupportChat() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

// Pages where a floating button would get in the way: chats, live rooms and
// forms whose Post buttons sit at the bottom of the screen.
const NO_BUTTON = [
  /^\/login/,
  /^\/register/,
  /^\/messages/,
  /^\/live\/[^/]+/,
  /^\/call/,
  /^\/create-thread/,
  /^\/contests\/new/,
  /^\/relationship\/edit/,
]

/** The Help button, and the chat once someone has opened it. */
export function SupportChatLauncher() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  // Once loaded, the chat stays mounted so the conversation is kept between opens.
  const [loaded, setLoaded] = useState(false)
  const showButton = !isNativeApp() && !NO_BUTTON.some((re) => re.test(location.pathname))

  const show = (v: boolean) => {
    if (v) setLoaded(true)
    setOpen(v)
  }

  useEffect(() => {
    const onOpen = () => {
      setLoaded(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  // A link with ?ask=1 (the app's More menu) opens the chat; following a link in an answer closes it.
  useEffect(() => {
    const ask = new URLSearchParams(location.search).get('ask') === '1'
    if (ask) setLoaded(true)
    setOpen(ask)
  }, [location.pathname, location.search])

  return (
    <>
      {showButton ? (
        // Room at the end of the page, so the last button can always scroll clear of Help.
        <div aria-hidden className="h-20" />
      ) : null}
      {showButton && !open ? <MovableHelpButton onOpen={() => show(true)} /> : null}
      {loaded ? (
        <Suspense fallback={null}>
          <SupportChat open={open} setOpen={show} />
        </Suspense>
      ) : null}
    </>
  )
}

/** Where the member last left the Help button (distance from the bottom-right corner). */
const SPOT_KEY = 'abia:help-button-spot'
const EDGE = 8 // Never closer than this to the edge of the screen.
const DRAG_START = 6 // Pixels a finger or mouse must move before it counts as a drag.

type Spot = { right: number; bottom: number }

function readSpot(): Spot {
  try {
    const saved = JSON.parse(localStorage.getItem(SPOT_KEY) ?? 'null') as Spot | null
    if (saved && typeof saved.right === 'number' && typeof saved.bottom === 'number') return saved
  } catch {
    // Storage blocked: start in the usual corner.
  }
  return { right: 24, bottom: 24 }
}

/** Keeps the whole button on screen, e.g. after the window gets smaller. */
function clampSpot(spot: Spot, el: HTMLElement | null): Spot {
  const w = el?.offsetWidth ?? 96
  const h = el?.offsetHeight ?? 48
  return {
    right: Math.min(Math.max(spot.right, EDGE), Math.max(EDGE, window.innerWidth - w - EDGE)),
    bottom: Math.min(Math.max(spot.bottom, EDGE), Math.max(EDGE, window.innerHeight - h - EDGE)),
  }
}

/**
 * The floating Help button. A tap opens the help chat; pressing and dragging
 * moves it anywhere on the screen, so it never has to sit on top of a button
 * the member needs. The spot is remembered on this device.
 */
function MovableHelpButton({ onOpen }: { onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const [spot, setSpot] = useState<Spot>(readSpot)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number; start: Spot; moved: boolean } | null>(null)
  // The click that ends a drag must not open the chat.
  const justDragged = useRef(false)

  useEffect(() => {
    const fit = () => setSpot((s) => clampSpot(s, ref.current))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, start: spot, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < DRAG_START) return
    if (!d.moved) setDragging(true)
    d.moved = true
    setSpot(clampSpot({ right: d.start.right - dx, bottom: d.start.bottom - dy }, ref.current))
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    justDragged.current = true
    setDragging(false)
    setSpot((s) => {
      try {
        localStorage.setItem(SPOT_KEY, JSON.stringify(s))
      } catch {
        // Storage blocked: it stays put for this visit.
      }
      return s
    })
  }

  return (
    <Button
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
      }}
      onClick={() => {
        if (justDragged.current) {
          justDragged.current = false
          return
        }
        onOpen()
      }}
      style={{ right: spot.right, bottom: spot.bottom }}
      // Below pop-up windows (z-50), so it never covers their buttons.
      className={cn(
        'fixed z-40 h-12 touch-none select-none gap-2 rounded-full px-4 shadow-lg',
        dragging ? 'cursor-grabbing scale-105 shadow-xl' : 'cursor-grab transition-transform',
      )}
      aria-label="Open the help chat"
      title="Help: tap to open, or drag to move it"
    >
      <HelpCircle className="size-5" /> Help
    </Button>
  )
}
