import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Heart, Loader2, Upload, X } from 'lucide-react'
import { toWebP } from '@/lib/image'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SEO } from '@/components/SEO'
import { isPersonalReason, LOOKING_FOR_LABELS, LookingFor, RelationshipProfile } from '@/lib/relationship'
import { ReasonBadge } from '@/components/connect/ReasonBadge'
import { cn } from '@/lib/utils'
import { isValidHttpUrl } from '@/lib/images'

const SEX = ['male', 'female', 'other', 'prefer_not_to_say'] as const
const MARITAL = ['single', 'in_relationship', 'engaged', 'married', 'divorced', 'widowed', 'complicated', 'prefer_not_to_say'] as const

export default function RelationshipEdit() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: mine, isLoading } = useQuery({
    queryKey: ['my-relationship-profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('relationship_profiles' as never)
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      return (data as unknown as RelationshipProfile | null) ?? null
    },
  })

  const [form, setForm] = useState({
    headline: '',
    about: '',
    dob: '',
    looking_for: '' as LookingFor | '',
    interests: [] as string[],
    height_cm: '' as string,
    current_location: '',
    occupation: '',
    work_experience: '',
    business_name: '',
    services: '',
    sex: '' as string,
    marital_status: '' as string,
    lga: '',
    photos: [] as string[],
    is_active: true,
  })
  const [tagInput, setTagInput] = useState('')
  const [photoInput, setPhotoInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [useAsAvatar, setUseAsAvatar] = useState(true)
  const [prefill, setPrefill] = useState(false)

  useEffect(() => {
    if (mine) {
      setForm({
        headline: mine.headline ?? '',
        about: mine.about ?? '',
        dob: mine.dob ?? '',
        looking_for: (mine.looking_for as any) ?? '',
        interests: mine.interests ?? [],
        height_cm: mine.height_cm ? String(mine.height_cm) : '',
        current_location: mine.current_location ?? '',
        occupation: mine.occupation ?? '',
        work_experience: mine.work_experience ?? '',
        business_name: mine.business_name ?? '',
        services: mine.services ?? '',
        sex: mine.sex ?? '',
        marital_status: mine.marital_status ?? '',
        lga: mine.lga ?? '',
        photos: mine.photos ?? [],
        is_active: mine.is_active,
      })
    }
  }, [mine])

  const prefillFromProfile = async () => {
    if (!user) return
    setPrefill(true)
    try {
      const { data } = await supabase.rpc('get_my_profile')
      const p = Array.isArray(data) ? data[0] : data
      if (!p) return toast.error('Profile not found')
      setForm((f) => ({
        ...f,
        about: f.about || p.bio || '',
        dob: f.dob || p.dob || '',
        current_location: f.current_location || p.current_location || '',
        occupation: f.occupation || p.occupation || '',
        sex: f.sex || p.sex || '',
        marital_status: f.marital_status || p.marital_status || '',
        lga: f.lga || p.lga || '',
        photos: p.avatar_url ? [p.avatar_url] : f.photos,
      }))
      toast.success('Filled from your profile')
    } finally {
      setPrefill(false)
    }
  }

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').slice(0, 30)
    if (!t || form.interests.includes(t) || form.interests.length >= 12) return
    setForm((f) => ({ ...f, interests: [...f.interests, t] }))
    setTagInput('')
  }

  const setProfilePhoto = () => {
    const url = photoInput.trim()
    if (!url) {
      setForm((f) => ({ ...f, photos: [] }))
      return
    }
    if (!isValidHttpUrl(url)) {
      return toast.error('Enter a valid http(s) image URL')
    }
    setForm((f) => ({ ...f, photos: [url] }))
    setPhotoInput('')
  }

  const uploadPhoto = async (file: File) => {
    if (!user) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image')
    if (file.size > 8 * 1024 * 1024) return toast.error('Image is too large (max 8MB)')
    setUploading(true)
    try {
      const webp = await toWebP(file)
      const ext = webp.name.split('.').pop() || 'webp'
      const path = `${user.id}/rel-${Date.now()}.${ext}`
      const { uploadAndScan } = await import('@/lib/scanAttachment')
      const res = await uploadAndScan('avatars', path, webp, {
        contentType: webp.type,
        upsert: true,
      })
      if (!res.uploaded) {
        return toast.error(res.error || 'Upload blocked by security scan')
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = pub?.publicUrl
      if (!publicUrl) return toast.error('Could not resolve uploaded image URL')
      setForm((f) => ({ ...f, photos: [publicUrl] }))
      if (useAsAvatar) {
        const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', user.id)
        if (error) toast.error(`Photo uploaded but avatar update failed: ${error.message}`)
        else toast.success('Photo uploaded and set as your avatar')
      } else {
        toast.success('Photo uploaded')
      }
    } finally {
      setUploading(false)
    }
  }




  const save = async () => {
    if (!user) return
    if (!form.looking_for) return toast.error('Choose why you are here')
    if (!form.headline.trim()) return toast.error('Add a short headline')
    setSaving(true)
    const payload = {
      user_id: user.id,
      headline: form.headline.trim().slice(0, 120) || null,
      about: form.about.trim().slice(0, 2000) || null,
      dob: form.dob || null,
      looking_for: form.looking_for || null,
      interests: form.interests,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      current_location: form.current_location.trim() || null,
      occupation: form.occupation.trim() || null,
      work_experience: form.work_experience.trim().slice(0, 2000) || null,
      business_name: form.business_name.trim().slice(0, 120) || null,
      services: form.services.trim().slice(0, 1000) || null,
      sex: form.sex || null,
      marital_status: form.marital_status || null,
      lga: form.lga.trim() || null,
      photos: form.photos,
      is_active: form.is_active,
    }
    const { error } = await supabase
      .from('relationship_profiles' as never)
      .upsert(payload as never, { onConflict: 'user_id' })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Connect profile saved')
    navigate(`/relationship/${user.id}`)
  }

  if (!user) return <p className="p-6">Please sign in.</p>
  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <SEO title="Your Connect profile" description="Create or update your Connect profile on AbiaConnect." path="/relationship/edit" />
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost"><Link to="/relationship"><ArrowLeft className="size-4" /> Back</Link></Button>
        <Button type="button" variant="secondary" onClick={prefillFromProfile} disabled={prefill}>
          {prefill ? <Loader2 className="animate-spin size-4" /> : <Heart className="size-4" />}
          Fill from my profile
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold native:hidden">Your Connect profile</h1>
        <p className="text-sm text-muted-foreground">
          Say why you are here and what you do, so the right people can find you.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <Label>Why are you here?*</Label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(LOOKING_FOR_LABELS) as LookingFor[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.looking_for === k}
                onClick={() => setForm((f) => ({ ...f, looking_for: k }))}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-xl border-2 p-3 text-left text-sm font-semibold',
                  form.looking_for === k ? 'border-emerald-700 bg-emerald-700/5' : 'border-border',
                )}
              >
                {LOOKING_FOR_LABELS[k]}
                {form.looking_for === k && <ReasonBadge reason={k} className="[&>span]:hidden" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Headline*</Label>
          <Input
            value={form.headline}
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            maxLength={120}
            placeholder="e.g. Accountant with 5 years in retail, open to new roles"
          />
        </div>
        <div>
          <Label>About</Label>
          <Textarea
            value={form.about}
            onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
            rows={4}
            maxLength={2000}
            placeholder="Your work, interests and the kind of connections you are looking for"
          />
        </div>

        <div>
          <Label>Occupation</Label>
          <Input value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} placeholder="What do you do?" />
        </div>

        {!isPersonalReason(form.looking_for || null) && (
          <>
            <div>
              <Label>Work experience</Label>
              <Textarea
                value={form.work_experience}
                onChange={(e) => setForm((f) => ({ ...f, work_experience: e.target.value }))}
                rows={3}
                maxLength={2000}
                placeholder="e.g. 5 years as an accountant at a retail company in Umuahia"
              />
            </div>
            <div>
              <Label>Business or company</Label>
              <Input
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                maxLength={120}
                placeholder="Name of your business or where you work"
              />
            </div>
            <div>
              <Label>Services you offer</Label>
              <Textarea
                value={form.services}
                onChange={(e) => setForm((f) => ({ ...f, services: e.target.value }))}
                rows={2}
                maxLength={1000}
                placeholder="e.g. Tax filing, bookkeeping, business registration"
              />
            </div>
          </>
        )}

        {isPersonalReason(form.looking_for || null) && (
          <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date of birth</Label>
            <Input type="date" value={form.dob} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} />
          </div>
          <div>
            <Label>Height (cm)</Label>
            <Input type="number" min={100} max={250} value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Sex</Label>
            <Select value={form.sex || undefined} onValueChange={(v) => setForm((f) => ({ ...f, sex: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {SEX.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Marital status</Label>
            <Select value={form.marital_status || undefined} onValueChange={(v) => setForm((f) => ({ ...f, marital_status: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {MARITAL.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>LGA</Label>
            <Input value={form.lga} onChange={(e) => setForm((f) => ({ ...f, lga: e.target.value }))} placeholder="Umuahia" />
          </div>
          <div>
            <Label>Current location</Label>
            <Input value={form.current_location} onChange={(e) => setForm((f) => ({ ...f, current_location: e.target.value }))} placeholder="City, country" />
          </div>
        </div>

        <div>
          <Label>Skills and interests</Label>
          <div className="flex flex-wrap gap-1.5 mt-1 rounded-xl border border-input p-2">
            {form.interests.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs font-medium px-2.5 py-0.5">
                #{t}
                <button type="button" onClick={() => setForm((f) => ({ ...f, interests: f.interests.filter((x) => x !== t) }))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
              onBlur={addTag}
              placeholder="Add interest and press Enter"
              className="flex-1 min-w-32 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <Label>Profile picture</Label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadPhoto(f)
                  e.target.value = ''
                }}
              />
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? 'Uploading…' : 'Upload photo'}
            </label>
            <span className="text-xs text-muted-foreground">or paste an image URL below</span>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useAsAvatar}
              onChange={(e) => setUseAsAvatar(e.target.checked)}
              className="size-3.5 rounded border-input"
            />
            Also use uploaded photo as my account avatar
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              value={photoInput || form.photos[0] || ''}
              onChange={(e) => setPhotoInput(e.target.value)}
              placeholder="https://..."
            />
            <Button type="button" onClick={setProfilePhoto} variant="secondary">Set</Button>
          </div>
          {isValidHttpUrl(form.photos[0]) && (
            <div className="mt-2 relative w-32">
              <img
                src={form.photos[0]}
                alt=""
                onError={() => {
                  setForm((f) => ({ ...f, photos: [] }))
                  toast.error("That image URL couldn't be loaded")
                }}
                className="aspect-square object-cover w-32 rounded-lg border border-border bg-muted"
              />
              <button
                type="button"
                onClick={() => { setForm((f) => ({ ...f, photos: [] })); setPhotoInput('') }}
                className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5"
                aria-label="Remove photo"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">One profile picture only. Uploads are stored securely and scanned before use.</p>
        </div>



        <label className="flex items-center gap-3 text-sm">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          Profile active (turn off to pause your profile)
        </label>

        <Button onClick={save} disabled={saving} className="w-full rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white">
          {saving ? <Loader2 className="animate-spin size-4" /> : <Heart className="size-4" />}
          Save profile
        </Button>
      </div>
    </div>
  )
}
