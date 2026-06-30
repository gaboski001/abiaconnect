import { useState } from 'react'
import { Bell, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Admin tool: send a test push notification to any user id via the
 * `send-push` edge function. Defaults to the currently signed-in user so
 * an admin can verify end-to-end delivery on their own device.
 */
export default function TestPushSection() {
  const { user } = useAuth()
  const [userId, setUserId] = useState(user?.id ?? '')
  const [title, setTitle] = useState('Test push 🚀')
  const [message, setMessage] = useState('If you see this, FCM is wired correctly.')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!userId.trim()) {
      toast.error('Enter a user id')
      return
    }
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { userId: userId.trim(), title, message, data: { url: '/notifications' } },
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

  return (
    <section className="rounded-2xl border bg-card p-6 space-y-4 max-w-xl">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-secondary/10 p-2 text-secondary">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Send Test Push</h2>
          <p className="text-xs text-muted-foreground">
            Verifies the send-push edge function and device-token pipeline end-to-end.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        <div>
          <Label htmlFor="tp-uid">User ID</Label>
          <div className="flex gap-2">
            <Input id="tp-uid" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="auth user uuid" />
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

      <Button onClick={send} disabled={sending} className="w-full">
        {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Send Test Push
      </Button>
    </section>
  )
}
