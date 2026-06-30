import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'
import {
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Save,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SlideCard, type HeroSlideLike } from '@/components/forum/SlideCard'
import type { Database } from '@/integrations/supabase/types'

type HeroSlide = Database['public']['Tables']['hero_slides']['Row']

type ExpiryMode = 'default' | 'custom' | 'none'

type FormState = {
  title: string
  subtitle: string
  body: string
  badge_text: string
  cta_label: string
  cta_url: string
  cta_label_2: string
  cta_url_2: string
  bg_color_from: string
  bg_color_to: string
  image_url: string
  order: number
  is_active: boolean
  expiryMode: ExpiryMode
  customExpiry: string
}

const emptyForm = (defaultDays: number, nextOrder: number): FormState => ({
  title: '',
  subtitle: '',
  body: '',
  badge_text: '',
  cta_label: '',
  cta_url: '',
  cta_label_2: '',
  cta_url_2: '',
  bg_color_from: '#013220',
  bg_color_to: '#000000',
  image_url: '',
  order: nextOrder,
  is_active: true,
  expiryMode: 'default',
  customExpiry: '',
})

function statusOf(s: HeroSlide): { label: string; cls: string } {
  if (!s.is_active) return { label: 'Hidden', cls: 'bg-muted text-muted-foreground' }
  if (s.expires_at && new Date(s.expires_at) < new Date())
    return { label: 'Expired', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' }
  return { label: 'Active', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' }
}

export default function HeroSlidesSection() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { settings, updateSetting } = useSiteSettings()

  const durationDays = Number(settings.hero_slide_duration_days) || 30
  const intervalSeconds = Number(settings.hero_slide_interval_seconds) || 6

  const [durationInput, setDurationInput] = useState(String(durationDays))
  const [intervalInput, setIntervalInput] = useState(String(intervalSeconds))
  useEffect(() => setDurationInput(String(durationDays)), [durationDays])
  useEffect(() => setIntervalInput(String(intervalSeconds)), [intervalSeconds])

  const slidesQuery = useQuery({
    queryKey: ['admin-hero-slides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .order('order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  // Auto-deactivate expired slides on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('hero_slides')
        .update({ is_active: false })
        .lt('expires_at', nowIso)
        .eq('is_active', true)
        .select('id')
      if (cancelled) return
      if (data && data.length) {
        toast(`${data.length} expired slide${data.length === 1 ? '' : 's'} auto-deactivated`)
        qc.invalidateQueries({ queryKey: ['admin-hero-slides'] })
        qc.invalidateQueries({ queryKey: ['hero-slides'] })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slides = slidesQuery.data ?? []
  const nextOrder = useMemo(
    () => (slides.length ? Math.max(...slides.map((s) => s.order ?? 0)) + 1 : 1),
    [slides],
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HeroSlide | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm(durationDays, 1))
  const [previewing, setPreviewing] = useState<HeroSlide | null>(null)
  const [deleting, setDeleting] = useState<HeroSlide | null>(null)
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(durationDays, nextOrder))
    setDialogOpen(true)
  }

  const openEdit = (s: HeroSlide) => {
    setEditing(s)
    setForm({
      title: s.title,
      subtitle: s.subtitle ?? '',
      body: s.body ?? '',
      badge_text: s.badge_text ?? '',
      cta_label: s.cta_label ?? '',
      cta_url: s.cta_url ?? '',
      cta_label_2: s.cta_label_2 ?? '',
      cta_url_2: s.cta_url_2 ?? '',
      bg_color_from: s.bg_color_from ?? '#013220',
      bg_color_to: s.bg_color_to ?? '#000000',
      image_url: s.image_url ?? '',
      order: s.order ?? nextOrder,
      is_active: s.is_active,
      expiryMode: s.expires_at ? 'custom' : 'none',
      customExpiry: s.expires_at ? s.expires_at.slice(0, 10) : '',
    })
    setDialogOpen(true)
  }

  const computeExpiry = (): string | null => {
    if (form.expiryMode === 'none') return null
    if (form.expiryMode === 'custom') {
      if (!form.customExpiry) return null
      return new Date(form.customExpiry + 'T23:59:59').toISOString()
    }
    return new Date(Date.now() + durationDays * 86400000).toISOString()
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      body: form.body.trim() || null,
      badge_text: form.badge_text.trim() || null,
      cta_label: form.cta_label.trim() || null,
      cta_url: form.cta_url.trim() || null,
      cta_label_2: form.cta_label_2.trim() || null,
      cta_url_2: form.cta_url_2.trim() || null,
      bg_color_from: form.bg_color_from || '#013220',
      bg_color_to: form.bg_color_to || '#000000',
      image_url: form.image_url.trim() || null,
      order: form.order || nextOrder,
      is_active: form.is_active,
      expires_at: computeExpiry(),
    }

    const { error } = editing
      ? await supabase.from('hero_slides').update(payload).eq('id', editing.id)
      : await supabase.from('hero_slides').insert({ ...payload, created_by: user?.id ?? null })

    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(editing ? 'Slide updated' : 'Slide created — now live on the homepage')
    setDialogOpen(false)
    qc.invalidateQueries({ queryKey: ['admin-hero-slides'] })
    qc.invalidateQueries({ queryKey: ['hero-slides'] })
  }

  const toggleActive = useMutation({
    mutationFn: async (s: HeroSlide) => {
      const { error } = await supabase
        .from('hero_slides')
        .update({ is_active: !s.is_active })
        .eq('id', s.id)
      if (error) throw error
      return !s.is_active
    },
    onSuccess: (active) => {
      toast.success(active ? 'Slide activated' : 'Slide hidden')
      qc.invalidateQueries({ queryKey: ['admin-hero-slides'] })
      qc.invalidateQueries({ queryKey: ['hero-slides'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmDelete = async () => {
    if (!deleting) return
    const { error } = await supabase.from('hero_slides').delete().eq('id', deleting.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Slide deleted')
    setDeleting(null)
    qc.invalidateQueries({ queryKey: ['admin-hero-slides'] })
    qc.invalidateQueries({ queryKey: ['hero-slides'] })
  }

  const moveSlide = async (s: HeroSlide, dir: -1 | 1) => {
    const sorted = [...slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const i = sorted.findIndex((x) => x.id === s.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    const a = sorted[i]
    const b = sorted[j]
    await Promise.all([
      supabase.from('hero_slides').update({ order: b.order }).eq('id', a.id),
      supabase.from('hero_slides').update({ order: a.order }).eq('id', b.id),
    ])
    qc.invalidateQueries({ queryKey: ['admin-hero-slides'] })
    qc.invalidateQueries({ queryKey: ['hero-slides'] })
  }

  const saveSliderSettings = async () => {
    const days = Math.min(365, Math.max(1, Number(durationInput) || 30))
    const secs = Math.min(30, Math.max(3, Number(intervalInput) || 6))
    try {
      await updateSetting.mutateAsync({ key: 'hero_slide_duration_days', value: String(days) })
      await updateSetting.mutateAsync({
        key: 'hero_slide_interval_seconds',
        value: String(secs),
      })
      toast.success('Slider settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const formSlide: HeroSlideLike = {
    id: 'preview',
    title: form.title || 'Slide title',
    subtitle: form.subtitle || null,
    body: form.body || null,
    badge_text: form.badge_text || null,
    cta_label: form.cta_label || null,
    cta_url: form.cta_url || null,
    cta_label_2: form.cta_label_2 || null,
    cta_url_2: form.cta_url_2 || null,
    bg_color_from: form.bg_color_from,
    bg_color_to: form.bg_color_to,
    image_url: form.image_url || null,
    isDefault: false,
  }

  return (
    <div className="space-y-4">
      {/* Settings */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">Slider Settings</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Default Slide Duration</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={1}
                max={365}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              New slides expire after this many days unless overridden.
            </p>
          </div>
          <div>
            <Label>Autoplay Interval</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={3}
                max={30}
                value={intervalInput}
                onChange={(e) => setIntervalInput(e.target.value)}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Seconds between automatic slide transitions.
            </p>
          </div>
        </div>
        <Button onClick={saveSliderSettings} size="sm">
          <Save className="h-4 w-4" /> Save Slider Settings
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Hero Slides</h2>
          <p className="text-sm text-muted-foreground">
            Default hero card always shows first. Add slides to appear after it.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" /> Create New Slide
        </Button>
      </div>

      {/* Default slide info card */}
      <div className="rounded-xl border border-dashed bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400">
                Default (always first)
              </Badge>
              <span className="font-semibold">{settings.site_name || 'AbiaConnect'}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This is your main hero banner. Edit it in Site Settings.
            </p>
          </div>
        </div>
      </div>

      {/* Slide cards */}
      {slidesQuery.isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : slides.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No custom slides yet. Click "Create New Slide" to add one.
        </div>
      ) : (
        <div className="grid gap-3">
          {slides.map((s, idx) => {
            const st = statusOf(s)
            return (
              <div key={s.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${s.bg_color_from || '#013220'}, ${
                        s.bg_color_to || '#000000'
                      })`,
                    }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{s.order}</Badge>
                      <span className="font-semibold truncate">{s.title}</span>
                      <Badge className={st.cls}>{st.label}</Badge>
                    </div>
                    {s.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">{s.subtitle}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.expires_at
                        ? `Expires ${format(new Date(s.expires_at), 'PP')}`
                        : 'No expiry'}{' '}
                      · Created {format(new Date(s.created_at), 'PP')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveSlide(s, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveSlide(s, 1)}
                      disabled={idx === slides.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewing(s)}
                    >
                      Preview
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleActive.mutate(s)}
                      aria-label={s.is_active ? 'Hide slide' : 'Activate slide'}
                    >
                      {s.is_active ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleting(s)}
                      aria-label="Delete slide"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Slide' : 'Create Slide'}</DialogTitle>
            <DialogDescription>
              Slides appear after the default hero card in the order you choose.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Slide Title *" hint="Main headline shown on the slide">
              <Input
                value={form.title}
                maxLength={80}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>

            <Field label="Subtitle / Tagline" hint="Shown below the title">
              <Input
                value={form.subtitle}
                maxLength={120}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </Field>

            <Field label="Body Text" hint="1–2 short sentences max">
              <Textarea
                value={form.body}
                maxLength={250}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </Field>

            <Field label="Badge Text" hint="Small pill above the title">
              <Input
                value={form.badge_text}
                maxLength={60}
                placeholder="e.g. ✦ New in Abia"
                onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Primary Button Label">
                <Input
                  value={form.cta_label}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                />
              </Field>
              <Field label="Primary Button URL">
                <Input
                  value={form.cta_url}
                  placeholder="/path or https://..."
                  onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                />
              </Field>
              <Field label="Secondary Button Label">
                <Input
                  value={form.cta_label_2}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, cta_label_2: e.target.value })}
                />
              </Field>
              <Field label="Secondary Button URL">
                <Input
                  value={form.cta_url_2}
                  placeholder="/path or https://..."
                  onChange={(e) => setForm({ ...form, cta_url_2: e.target.value })}
                />
              </Field>
            </div>

            <div>
              <Label>Background Colours</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={form.bg_color_from}
                    onChange={(e) => setForm({ ...form, bg_color_from: e.target.value })}
                    className="w-14 h-10 p-1"
                  />
                  <Input
                    value={form.bg_color_from}
                    onChange={(e) => setForm({ ...form, bg_color_from: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={form.bg_color_to}
                    onChange={(e) => setForm({ ...form, bg_color_to: e.target.value })}
                    className="w-14 h-10 p-1"
                  />
                  <Input
                    value={form.bg_color_to}
                    onChange={(e) => setForm({ ...form, bg_color_to: e.target.value })}
                  />
                </div>
              </div>
              <div
                className="h-10 rounded-lg w-full mt-2 border border-border"
                style={{
                  background: `linear-gradient(135deg, ${form.bg_color_from}, ${form.bg_color_to})`,
                }}
              />
            </div>

            <Field label="Background Image URL" hint="Shown at 20% opacity behind text">
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt=""
                  loading="lazy"
                  className="mt-2 h-20 rounded-md object-cover border"
                />
              )}
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Display Order" hint="1 = first after the default slide">
                <Input
                  type="number"
                  min={1}
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                />
              </Field>
              <Field label="Publish immediately">
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
              </Field>
            </div>

            <div>
              <Label>Expiry</Label>
              <div className="space-y-2 mt-1 text-sm">
                {(
                  [
                    {
                      v: 'default' as const,
                      label: `Use default duration (${durationDays} days)`,
                    },
                    { v: 'custom' as const, label: 'Custom date' },
                    { v: 'none' as const, label: 'No expiry' },
                  ]
                ).map((opt) => (
                  <label key={opt.v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.expiryMode === opt.v}
                      onChange={() => setForm({ ...form, expiryMode: opt.v })}
                    />
                    {opt.label}
                  </label>
                ))}
                {form.expiryMode === 'default' && (
                  <p className="text-xs text-muted-foreground">
                    Will expire on{' '}
                    {format(
                      new Date(Date.now() + durationDays * 86400000),
                      'PP',
                    )}
                  </p>
                )}
                {form.expiryMode === 'custom' && (
                  <Input
                    type="date"
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                    value={form.customExpiry}
                    onChange={(e) => setForm({ ...form, customExpiry: e.target.value })}
                    className="w-48"
                  />
                )}
                {form.expiryMode === 'none' && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    This slide will remain until manually removed or deactivated.
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label>Live preview</Label>
              <div className="overflow-hidden rounded-xl h-[230px] border border-border mt-1">
                <div className="scale-50 origin-top-left w-[200%] pointer-events-none">
                  <SlideCard slide={formSlide} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Slide'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Slide preview</DialogTitle>
          </DialogHeader>
          {previewing && <SlideCard slide={previewing as HeroSlideLike} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this slide?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the slide from the homepage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

export function HeroSlidesExpiryAlert() {
  const { data } = useQuery({
    queryKey: ['hero-slides-expiring'],
    queryFn: async () => {
      const cutoff = new Date(Date.now() + 3 * 86400000).toISOString()
      const { data, error } = await supabase
        .from('hero_slides')
        .select('id, title, expires_at, is_active')
        .lt('expires_at', cutoff)
        .eq('is_active', true)
      if (error) throw error
      return data ?? []
    },
  })
  if (!data || data.length === 0) return null
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-700 dark:text-yellow-400">
      <p className="font-semibold mb-1">⚠️ Hero Slides Expiring Soon</p>
      <ul className="text-sm space-y-1">
        {data.map((s) => (
          <li key={s.id}>
            "{s.title}" — {s.expires_at ? `expires ${format(new Date(s.expires_at), 'PP')}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
