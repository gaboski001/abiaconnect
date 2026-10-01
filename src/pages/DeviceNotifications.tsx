import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/lib/toast'
import { BellRing, Smartphone, Apple, Globe, Trash2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import {
  registerCurrentDevice,
  getCurrentWebToken,
  isNativeDevice,
  guessDeviceLabel,
} from '@/lib/deviceRegistration'
import { Capacitor } from '@capacitor/core'

type Device = {
  id: string
  token: string
  platform: 'ios' | 'android' | 'web' | string
  device_label: string | null
  user_agent: string | null
  notify_updates: boolean
  created_at: string
  updated_at: string
  last_seen_at: string
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'ios') return <Apple className="size-5" />
  if (platform === 'android') return <Smartphone className="size-5" />
  return <Globe className="size-5" />
}

export default function DeviceNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [registering, setRegistering] = useState(false)

  const currentDeviceToken = useMemo(() => {
    if (isNativeDevice()) return null // token only known after registration
    return getCurrentWebToken()
  }, [])

  const q = useQuery({
    queryKey: ['device-push-tokens', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_push_tokens')
        .select('id, token, platform, device_label, user_agent, notify_updates, created_at, updated_at, last_seen_at')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Device[]
    },
  })

  const handleRegister = async () => {
    if (!user) return
    setRegistering(true)
    try {
      const res = await registerCurrentDevice(user.id)
      if (res.status === 'registered') {
        toast.success('This device is now registered for app-update notifications.')
        qc.invalidateQueries({ queryKey: ['device-push-tokens', user.id] })
      } else {
        toast.error(res.reason)
      }
    } finally {
      setRegistering(false)
    }
  }

  const toggleUpdates = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from('device_push_tokens')
        .update({ notify_updates: value, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device-push-tokens', user?.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  })

  const removeDevice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('device_push_tokens').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Device removed')
      qc.invalidateQueries({ queryKey: ['device-push-tokens', user?.id] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not remove device'),
  })

  const devices = q.data ?? []
  const thisDeviceRegistered = devices.some(
    (d) => currentDeviceToken && d.token === currentDeviceToken,
  ) || (isNativeDevice() && devices.some((d) => d.platform === Capacitor.getPlatform()))

  // Refresh last_seen on visit for the current web device.
  useEffect(() => {
    if (!user || !currentDeviceToken) return
    void supabase
      .from('device_push_tokens')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('token', currentDeviceToken)
  }, [user, currentDeviceToken])

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold native:hidden">Notification devices</h1>
        <p className="text-sm text-muted-foreground mt-1 native:mt-0">
          Choose which of your devices get pop-up alerts for new app updates and other notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-5" /> This device
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <div className="font-medium">{guessDeviceLabel()}</div>
            <div className="text-xs text-muted-foreground">
              {isNativeDevice()
                ? 'Native app — receives system pop-up notifications when opted in.'
                : 'Web browser — receives in-app notifications; some browsers also show desktop pop-ups.'}
            </div>
          </div>
          <Button onClick={handleRegister} disabled={registering}>
            {registering ? (
              <><Loader2 className="mr-2 size-4 animate-spin" /> Enabling…</>
            ) : thisDeviceRegistered ? (
              'Re-enable notifications on this device'
            ) : (
              'Enable app update notifications on this device'
            )}
          </Button>
          {!isNativeDevice() && (
            <p className="text-xs text-muted-foreground">
              For lock-screen pop-ups, install the mobile app and enable notifications there.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your registered devices</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices yet. Tap the button above to enable notifications here.</p>
          ) : (
            <ul className="space-y-3">
              {devices.map((d) => {
                const isCurrent = currentDeviceToken === d.token
                return (
                  <li key={d.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5"><PlatformIcon platform={d.platform} /></div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {d.device_label || d.platform.toUpperCase()}
                            {isCurrent && <span className="ml-2 text-xs text-primary">(this device)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Added {format(new Date(d.created_at), 'PP')} · Last seen {format(new Date(d.last_seen_at), 'PP')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Updates</span>
                          <Switch
                            checked={d.notify_updates}
                            onCheckedChange={(v) => toggleUpdates.mutate({ id: d.id, value: v })}
                            aria-label="Notify me about app updates"
                          />
                        </label>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeDevice.mutate(d.id)}
                          aria-label="Remove device"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
