import { useEffect, useState } from 'react'
import { Bell, Send, Loader2, Smartphone, Zap } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Admin tool: verify FCM/APNs delivery end-to-end.
 *
 * Includes a one-tap "Send to this device now" action so an admin can quickly
 * confirm the heads-up notification appears on the phone they're holding.
 */
export default function TestPushSection() {
  const { user } = useAuth()
  const [userId, setUserId] = useState(user?.id ?? '')
  const [title, setTitle] = useState('Test push 🚀')
  const [message, setMessage] = useState('If you see this, FCM is wired correctly.')
  const [sending, setSending] = useState<false | 'quick' | 'custom'>(false)
  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const [thisPlatform, setThisPlatform] = useState<string>('web')

  useEffect(() => {
    setThisPlatform(Capacitor.getPlatform())
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { count } = await supabase
        .from('device_push_tokens')
        .select('token', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setDeviceCount(count ?? 0)
    })()
  }, [user, sending])

  const sendPush = async (payload: {
    title: string
    message: string
    which: 'quick' | 'custom'
  }) => {
    const target = payload.which === 'quick' ? user?.id : userId.trim()
    if (!target) {
      toast.error('Enter a user id')
      return
    }
    setSending(payload.which)
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          userId: target,
          title: payload.title,
          message: payload.message,
          data: { url: '/notifications' },
        },
      })
      if (error) throw error
      const sent = (data as { sent?: number })?.sent ?? 0
      if (sent > 0) toast.success(`Push delivered to ${sent} device(s)`)
      else toast.warning('No registered devices for that user yet')
    } catch (e) {
      toast.error('Failed to send push', { description: String(e) })
    } finally {
      setSending(false)
    }
  }

  const quickSend = () =>
    sendPush({
      title: '🔔 Heads-up test',
      message: `Sent from Admin at ${new Date().toLocaleTimeString()}`,
      which: 'quick',
    })

  const customSend = () => sendPush({ title, message, which: 'custom' })

  return (
    <section className="space-y-6 max-w-xl">
      {/* Quick send — verify heads-up on this device */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <header className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Send test push to this device</h2>
            <p className="text-xs text-muted-foreground">
              Fires a heads-up notification to every device signed in as you.
              Lock your screen first to verify wake + lockscreen behaviour.
            </p>
          </div>
        </header>

        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs flex items-center gap-2 text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" />
          <span>
            Platform: <span className="font-medium text-foreground">{thisPlatform}</span>
            {' · '}
            {deviceCount === null
              ? 'Checking registered devices…'
              : `${deviceCount} device${deviceCount === 1 ? '' : 's'} registered for your account`}
          </span>
        </div>

        {thisPlatform === 'web' && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You're on the web preview — push only fires on the installed native
            app. Open AbiaConnect on your phone (signed in as you) and press this
            button from any browser.
          </p>
        )}

        <Button onClick={quickSend} disabled={!!sending || !user} className="w-full" size="lg">
          {sending === 'quick' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          Send test push to me now
        </Button>
      </div>

      {/* Advanced: send to any user */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <header className="flex items-center gap-3">
          <div className="rounded-xl bg-secondary/10 p-2 text-secondary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Send to a specific user</h2>
            <p className="text-xs text-muted-foreground">
              Advanced: custom title/message and target user id.
            </p>
          </div>
        </header>

        <div className="space-y-3">
          <div>
            <Label htmlFor="tp-uid">User ID</Label>
            <div className="flex gap-2">
              <Input
                id="tp-uid"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="auth user uuid"
              />
              {user && (
                <Button type="button" variant="outline" onClick={() => setUserId(user.id)}>
                  Me
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="tp-title">Title</Label>
            <Input id="tp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tp-msg">Message</Label>
            <Input id="tp-msg" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        <Button onClick={customSend} disabled={!!sending} variant="secondary" className="w-full">
          {sending === 'custom' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send custom push
        </Button>
      </div>
    </section>
  )
}
