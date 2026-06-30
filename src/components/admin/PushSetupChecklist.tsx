import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Smartphone,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type Status = 'ok' | 'fail' | 'warn' | 'pending' | 'skip'

interface CheckRow {
  id: string
  title: string
  status: Status
  detail: string
  hint?: string
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'pending')
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  if (status === 'ok') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
  if (status === 'fail') return <XCircle className="h-5 w-5 text-destructive" />
  if (status === 'warn') return <AlertCircle className="h-5 w-5 text-amber-500" />
  return <AlertCircle className="h-5 w-5 text-muted-foreground/60" />
}

/**
 * In-app verification checklist for the native push pipeline:
 *  - Native platform detected?
 *  - Notification permission granted?
 *  - FCM/APNs registration succeeded (token received)?
 *  - Token persisted to `device_push_tokens` for the signed-in user?
 *
 * On web, the checks are marked "skip" with guidance to open the build on
 * a physical device. `google-services.json` cannot be inspected from JS;
 * we infer its presence from whether registration produces a token (a
 * missing or wrong config file is the #1 cause of silent registration
 * failures on Android).
 */
export default function PushSetupChecklist() {
  const { user } = useAuth()
  const [running, setRunning] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [checks, setChecks] = useState<CheckRow[]>([])

  const isNative = Capacitor.isNativePlatform()
  const platform = Capacitor.getPlatform()

  const run = useCallback(async () => {
    if (!user) {
      toast.error('Sign in to run the checklist')
      return
    }
    setRunning(true)
    setToken(null)
    const rows: CheckRow[] = []

    // 1. Platform
    if (!isNative) {
      rows.push({
        id: 'platform',
        title: 'Running inside native app',
        status: 'skip',
        detail: `Detected platform: ${platform}. Push registration only runs in the Capacitor Android/iOS build.`,
        hint: 'Build with `npx cap run android` (or iOS) and open this page inside the installed app.',
      })
      setChecks(rows)
      setRunning(false)
      return
    }
    rows.push({
      id: 'platform',
      title: 'Running inside native app',
      status: 'ok',
      detail: `Platform: ${platform}`,
    })
    setChecks([...rows])

    // 2. Permission
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') {
      rows.push({
        id: 'perm',
        title: 'Notification permission granted',
        status: 'fail',
        detail: `Permission state: ${perm.receive}`,
        hint:
          platform === 'android'
            ? 'Android 13+ requires POST_NOTIFICATIONS. Open system Settings → Apps → AbiaConnect → Notifications and allow.'
            : 'Open iOS Settings → AbiaConnect → Notifications and allow.',
      })
      setChecks([...rows])
      setRunning(false)
      return
    }
    rows.push({
      id: 'perm',
      title: 'Notification permission granted',
      status: 'ok',
      detail: 'OS will allow push delivery.',
    })
    setChecks([...rows])

    // 3. Registration → token (proxy for google-services.json on Android)
    const tokenPromise = new Promise<string | null>((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      }, 12000)
      PushNotifications.addListener('registration', (t) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(t.value)
      }).catch(() => {})
      PushNotifications.addListener('registrationError', () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(null)
      }).catch(() => {})
    })

    try {
      await PushNotifications.register()
    } catch {
      // ignore — error surfaces via registrationError below
    }
    const t = await tokenPromise

    if (!t) {
      rows.push({
        id: 'token',
        title: 'FCM/APNs token received',
        status: 'fail',
        detail: 'No registration token arrived within 12 seconds.',
        hint:
          platform === 'android'
            ? 'Most common cause: `android/app/google-services.json` is missing, has the wrong package name, or the Google Services Gradle plugin is not applied. Re-download it from Firebase Console → Project settings → Your apps and run `npx cap sync android`.'
            : 'Most common cause: APNs key not uploaded to Firebase, or the app is running on the iOS Simulator (push only works on a physical device).',
      })
      setChecks([...rows])
      setRunning(false)
      return
    }

    setToken(t)
    rows.push({
      id: 'token',
      title: 'FCM/APNs token received',
      status: 'ok',
      detail:
        platform === 'android'
          ? 'Token issued — google-services.json is wired correctly.'
          : 'Token issued — APNs is wired correctly.',
    })
    setChecks([...rows])

    // 4. Token saved to backend
    try {
      const { data, error } = await supabase
        .from('device_push_tokens')
        .select('token, updated_at')
        .eq('user_id', user.id)
        .eq('token', t)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        rows.push({
          id: 'persist',
          title: 'Token saved to backend',
          status: 'warn',
          detail: 'Token not yet found in device_push_tokens — try again in a moment.',
          hint: 'Re-run the checklist; the upsert from usePushNotifications may still be in flight.',
        })
      } else {
        rows.push({
          id: 'persist',
          title: 'Token saved to backend',
          status: 'ok',
          detail: `Stored in device_push_tokens (updated ${new Date(
            data.updated_at as string,
          ).toLocaleString()}).`,
        })
      }
    } catch (e) {
      rows.push({
        id: 'persist',
        title: 'Token saved to backend',
        status: 'fail',
        detail: String(e),
      })
    }

    setChecks([...rows])
    setRunning(false)
  }, [user, isNative, platform])

  useEffect(() => {
    // Auto-run once on mount so the admin sees status immediately.
    void run()
  }, [run])

  const copyToken = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      toast.success('Token copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 space-y-4 max-w-xl">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Push Setup Checklist</h2>
            <p className="text-xs text-muted-foreground">
              Verifies google-services.json placement and FCM token registration end-to-end.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={running}>
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Re-run
        </Button>
      </header>

      <ul className="space-y-2">
        {checks.length === 0 && (
          <li className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Running checks…
          </li>
        )}
        {checks.map((c) => (
          <li
            key={c.id}
            className={cn(
              'rounded-xl border p-3 flex gap-3 items-start',
              c.status === 'fail' && 'border-destructive/40 bg-destructive/5',
              c.status === 'warn' && 'border-amber-500/40 bg-amber-500/5',
              c.status === 'ok' && 'border-emerald-500/30 bg-emerald-500/5',
            )}
          >
            <StatusIcon status={c.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{c.title}</p>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {c.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 break-words">{c.detail}</p>
              {c.hint && (
                <p className="text-xs mt-2 rounded-md bg-muted/60 p-2">
                  <span className="font-medium">Fix: </span>
                  {c.hint}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {token && (
        <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Device token</p>
            <Button size="sm" variant="ghost" onClick={copyToken}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>
          <p className="text-[11px] font-mono break-all leading-snug">{token}</p>
        </div>
      )}
    </section>
  )
}
