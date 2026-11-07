import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PushNotifications } from '@capacitor/push-notifications'
import {
  ArrowRight,
  Bell,
  Check,
  Grid2x2,
  Handshake,
  Home,
  MessageCircle,
  Moon,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { PUSH_PERMISSION_EVENT } from '@/hooks/usePushNotifications'
import { APP_HEADER_GRADIENT } from '@/lib/mobileBrand'
import { cn } from '@/lib/utils'

const DONE_KEY = 'abia:first-run-done'
const ONBOARDING_KEY = 'hasSeenOnboarding'
/** Sign-in screens have their own questions; wait until they are finished. */
const WAIT_ON = ['/login', '/register', '/forgot-password', '/reset-password']

type Step = 'theme' | 'notifications' | 'tour'

const TOUR: { icon: LucideIcon; name: string; text: string; tone: string }[] = [
  { icon: Home, name: 'Home', text: 'Today’s news, questions and quick links.', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { icon: Users, name: 'Community', text: 'Your LGA group and people from home.', tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  { icon: MessageCircle, name: 'Messages', text: 'Chat and make voice or video calls.', tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  { icon: Handshake, name: 'Connect', text: 'Swipe right to connect, left to skip.', tone: 'bg-pink-500/15 text-pink-700 dark:text-pink-300' },
  { icon: Grid2x2, name: 'More', text: 'Rewards, contests, events and settings.', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
]

function ThemeCard({ dark, selected, onSelect }: { dark: boolean; selected: boolean; onSelect: () => void }) {
  const Icon = dark ? Moon : Sun
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative flex-1 rounded-3xl border-2 bg-card p-3 text-left shadow-sm transition-all active:scale-[0.98]',
        selected ? 'border-amber-500' : 'border-border',
      )}
    >
      <div className={cn('overflow-hidden rounded-2xl', dark ? 'bg-[#071207]' : 'bg-[#F1F6F2]')} aria-hidden>
        <div className="h-7" style={{ background: APP_HEADER_GRADIENT }} />
        <div className="space-y-2 p-2.5">
          <div className={cn('h-8 rounded-lg', dark ? 'bg-[#142414]' : 'bg-white')} />
          <div className={cn('h-8 rounded-lg', dark ? 'bg-[#142414]' : 'bg-white')} />
          <div className="ml-auto h-5 w-2/3 rounded-lg bg-emerald-700" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 px-1 pb-1 text-base font-semibold text-foreground">
        <Icon className="size-4" />
        {dark ? 'Dark' : 'Light'}
      </div>
      {selected && (
        <span className="absolute bottom-4 right-4 flex size-7 items-center justify-center rounded-full bg-amber-500 text-black">
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

/**
 * Shown once in the installed app after the first sign-in or sign-up: choose
 * light or dark, decide about notifications, and see where things are.
 */
export function FirstRunWelcome() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  const [done, setDone] = useState(() => localStorage.getItem(DONE_KEY) === 'true')
  const [step, setStep] = useState<Step>('theme')
  const [needsPermission, setNeedsPermission] = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!user || done) return
    PushNotifications.checkPermissions()
      .then((p) => setNeedsPermission(p.receive !== 'granted'))
      .catch(() => setNeedsPermission(false))
  }, [user, done])

  const waiting = !user || loading || WAIT_ON.some((path) => pathname.startsWith(path))
  if (done || waiting) return null

  function finish() {
    localStorage.setItem(DONE_KEY, 'true')
    // Whoever reaches this has been through the app's intro too.
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setDone(true)
  }

  async function askForNotifications() {
    setAsking(true)
    try {
      await PushNotifications.requestPermissions()
      window.dispatchEvent(new Event(PUSH_PERMISSION_EVENT))
    } catch {
      // The member can still turn them on later in Settings.
    } finally {
      setAsking(false)
      setStep('tour')
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-background pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div
        className="px-6 pb-7 pt-8 text-white"
        style={{ background: APP_HEADER_GRADIENT }}
      >
        {step === 'theme' && (
          <>
            <h1 className="text-[28px] font-extrabold leading-tight">Choose your look</h1>
            <p className="mt-1.5 text-[15px] text-white/85">Pick what feels easier on your eyes.</p>
          </>
        )}
        {step === 'notifications' && (
          <>
            <h1 className="text-[28px] font-extrabold leading-tight">Don&apos;t miss a message</h1>
            <p className="mt-1.5 text-[15px] text-white/85">We&apos;ll let you know when someone reaches out.</p>
          </>
        )}
        {step === 'tour' && (
          <>
            <h1 className="text-[28px] font-extrabold leading-tight">Find your way around</h1>
            <p className="mt-1.5 text-[15px] text-white/85">Five buttons at the bottom take you everywhere.</p>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pt-6">
        {step === 'theme' && (
          <>
            <div className="flex gap-3">
              <ThemeCard dark={false} selected={theme === 'light'} onSelect={() => setTheme('light')} />
              <ThemeCard dark selected={theme === 'dark'} onSelect={() => setTheme('dark')} />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">You can change this any time in More.</p>
            <div className="mt-auto pt-6">
              <Button
                className="h-14 w-full rounded-full text-base font-bold"
                onClick={() => setStep(needsPermission ? 'notifications' : 'tour')}
              >
                Continue <ArrowRight className="ml-1 size-5" />
              </Button>
            </div>
          </>
        )}

        {step === 'notifications' && (
          <>
            <div className="mx-auto mt-2 flex size-24 items-center justify-center rounded-[28px] bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <Bell className="size-12" />
            </div>
            <ul className="mt-6 space-y-3">
              {['New messages and calls', 'Replies to your posts', 'People who want to connect'].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-2xl bg-card p-4 text-[15px] font-medium text-foreground shadow-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Your phone will ask next. If alerts ever come late, set AbiaConnect to &quot;Unrestricted&quot; in your phone&apos;s battery settings.
            </p>
            <div className="mt-auto space-y-2 pt-6">
              <Button className="h-14 w-full rounded-full text-base font-bold" disabled={asking} onClick={() => void askForNotifications()}>
                Turn on notifications
              </Button>
              <Button variant="ghost" className="h-12 w-full rounded-full text-base" disabled={asking} onClick={() => setStep('tour')}>
                Not now
              </Button>
            </div>
          </>
        )}

        {step === 'tour' && (
          <>
            <ul className="space-y-2.5">
              {TOUR.map(({ icon: Icon, name, text, tone }) => (
                <li key={name} className="flex items-center gap-3.5 rounded-2xl bg-card p-3.5 shadow-sm">
                  <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', tone)}>
                    <Icon className="size-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-foreground">{name}</span>
                    <span className="block text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <Button className="h-14 w-full rounded-full text-base font-bold" onClick={finish}>
                Start exploring <ArrowRight className="ml-1 size-5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
