import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { EyeOff, MessageSquareOff, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { getMyPrivacy, setMyPrivacy, type MessagePrivacy } from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{ value: MessagePrivacy; label: 'privacy.messages.everyone' | 'privacy.messages.connections' | 'privacy.messages.nobody' }> = [
  { value: 'everyone', label: 'privacy.messages.everyone' },
  { value: 'connections', label: 'privacy.messages.connections' },
  { value: 'nobody', label: 'privacy.messages.nobody' },
]

/** Privacy controls every member can use: private mode + who can message me. */
export function PrivacySettingsPanel() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['my-privacy', user?.id], queryFn: getMyPrivacy, enabled: !!user })
  const save = useMutation({
    mutationFn: setMyPrivacy,
    onSuccess: (data) => {
      qc.setQueryData(['my-privacy', user?.id], data)
      qc.invalidateQueries({ queryKey: ['relationship-feed'] })
      toast.success(t('privacy.saved'))
    },
    onError: () => toast.error('Could not save your settings. Please try again.'),
  })

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (q.error || !q.data) return <p className="text-sm text-destructive">Could not load your settings.</p>
  const s = q.data

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <EyeOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <Label htmlFor="privacy-visible" className="font-medium">
              {t('privacy.visible.label')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {s.has_connections_profile ? t('privacy.visible.help') : t('privacy.visible.needs_profile')}
            </p>
            {!s.has_connections_profile && (
              <Link to="/relationship/edit" className="text-xs font-semibold text-pink-600 hover:underline">
                {t('profile_cta.button')}
              </Link>
            )}
          </div>
        </div>
        <Switch
          id="privacy-visible"
          checked={!s.incognito}
          disabled={!s.has_connections_profile || save.isPending}
          onCheckedChange={(visible) => save.mutate({ incognito: !visible })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="flex gap-3">
          <MessageSquareOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="block text-sm font-medium">{t('privacy.messages.label')}</span>
            <span className="block text-xs text-muted-foreground">{t('privacy.messages.help')}</span>
          </span>
        </legend>
        <div className="grid grid-cols-1 gap-2 pl-8 sm:grid-cols-3" role="radiogroup">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm transition-colors',
                s.message_privacy === o.value ? 'border-primary bg-primary/10 font-semibold' : 'border-border hover:bg-muted',
              )}
            >
              <input
                type="radio"
                name="message-privacy"
                value={o.value}
                checked={s.message_privacy === o.value}
                disabled={save.isPending}
                onChange={() => save.mutate({ messagePrivacy: o.value })}
                className="sr-only"
              />
              {t(o.label)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/** Header button that opens the privacy controls. */
export function PrivacySettingsDialog({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn('size-10 rounded-full border-border bg-card p-0 shadow-sm hover:bg-muted', className)}
          aria-label={t('privacy.title')}
        >
          <ShieldCheck className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t('privacy.title')}</DialogTitle>
          <DialogDescription>Control who can find you and who can reach you.</DialogDescription>
        </DialogHeader>
        <PrivacySettingsPanel />
      </DialogContent>
    </Dialog>
  )
}

export default PrivacySettingsDialog
