import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'

// The chat itself (with all the Help Centre answers) downloads on first open only.
const SupportChat = lazy(() => import('./SupportChat').then((m) => ({ default: m.SupportChat })))

const OPEN_EVENT = 'abia:open-support-chat'

/** Opens the support chat from anywhere (the Help page). */
export function openSupportChat() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

// Pages where a floating button would get in the way.
const NO_BUTTON = [/^\/login/, /^\/register/, /^\/messages\/[^/]+/, /^\/live\/[^/]+/, /^\/call/]

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
      {showButton && !open ? (
        <Button
          onClick={() => show(true)}
          className="fixed bottom-6 right-6 z-50 h-12 gap-2 rounded-full px-4 shadow-lg"
          aria-label="Open the help chat"
        >
          <HelpCircle className="size-5" /> Help
        </Button>
      ) : null}
      {loaded ? (
        <Suspense fallback={null}>
          <SupportChat open={open} setOpen={show} />
        </Suspense>
      ) : null}
    </>
  )
}
