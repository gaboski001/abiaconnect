import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'
import { saveProfile, SEX_OPTIONS, MARITAL_STATUS_OPTIONS } from '@/lib/profileUpdate'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BioField } from '@/components/profile/BioField'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { NotificationSoundToggle } from '@/components/notifications/NotificationSoundToggle'
import { CallRingtoneSettings } from '@/components/notifications/CallRingtoneSettings'
import { NativeAppDownload } from '@/components/pwa/NativeAppDownload'
import { toWebP } from '@/lib/image'
import { GOLD_GRADIENT, GOLD_SHADOW, PREMIUM_SHADOW } from '@/lib/mobileBrand'

export interface SettingsProfile {
  id?: string
  display_name?: string | null
  username?: string | null
  bio?: string | null
  lga?: string | null
  current_location?: string | null
  occupation?: string | null
  sex?: string | null
  marital_status?: string | null
  avatar_url?: string | null
  reputation?: number | null
}

const SEX_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
}
const MARITAL_LABELS: Record<string, string> = {
  single: 'Single',
  married: 'Married',
  in_relationship: 'In a relationship',
  engaged: 'Engaged',
  divorced: 'Divorced',
  widowed: 'Widowed',
  separated: 'Separated',
  prefer_not_to_say: 'Prefer not to say',
}

export default function SettingsPanel({
  profile,
  onSaved,
}: {
  profile: SettingsProfile
  onSaved: () => void
}) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    display_name: profile.display_name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    lga: profile.lga ?? '',
    current_location: profile.current_location ?? '',
    occupation: profile.occupation ?? '',
    sex: profile.sex ?? '',
    marital_status: profile.marital_status ?? '',
  })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setForm({
      display_name: profile.display_name ?? '',
      username: profile.username ?? '',
      bio: profile.bio ?? '',
      lga: profile.lga ?? '',
      current_location: profile.current_location ?? '',
      occupation: profile.occupation ?? '',
      sex: profile.sex ?? '',
      marital_status: profile.marital_status ?? '',
    })
  }, [
    profile.display_name,
    profile.username,
    profile.bio,
    profile.lga,
    profile.current_location,
    profile.occupation,
    profile.sex,
    profile.marital_status,
  ])

  const save = async () => {
    if (!user) return
    const { error } = await saveProfile(user.id, form)
    if (error) return toast.error(error.message)
    toast.success('Profile updated')
    onSaved()
  }

  const updatePassword = async () => {
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return toast.error(error.message)
    setPassword('')
    toast.success('Password updated')
  }

  const uploadAvatar = async (file: File) => {
    if (!user) return
    setUploading(true)
    const webp = await toWebP(file)
    const ext = webp.name.split('.').pop() || 'webp'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { uploadAndScan } = await import('@/lib/scanAttachment')
    const res = await uploadAndScan('avatars', path, webp, {
      contentType: webp.type,
      upsert: true,
    })
    if (!res.uploaded) {
      setUploading(false)
      return toast.error(res.error || 'Avatar blocked by security scan')
    }
    const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', user.id)
    setUploading(false)
    if (error) return toast.error(error.message)
    toast.success('Avatar updated')
    onSaved()
  }

  const deleteAccount = async () => {
    if (confirm !== 'DELETE' || !user) return
    const { error } = await supabase.from('profiles').delete().eq('id', user.id)
    if (error) return toast.error(error.message)
    await signOut()
    toast.success('Account deleted')
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">Profile settings</h2>
        <p className="mt-1 text-sm text-slate-300/68">Edit how you appear across the community while keeping the mobile form cleaner and easier to scan.</p>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar avatarUrl={profile.avatar_url} displayName={form.display_name || user?.email || 'User'} size="lg" className="h-20 w-20 border border-white/15" />
          <label className="text-sm">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <span className="inline-flex cursor-pointer items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 font-semibold text-slate-100 hover:bg-white/[0.08]">
              {uploading ? 'Uploading…' : 'Change avatar'}
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Display name"><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" /></Field>
          <Field label="Username"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" /></Field>
          <div className="sm:col-span-2">
            <BioField value={form.bio} onChange={(v: string) => setForm({ ...form, bio: v })} />
          </div>
          <Field label="LGA"><Input value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" /></Field>
        </div>
        <Button onClick={save} disabled={!profile.id} className="mt-5 rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
          Save changes
        </Button>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">Notifications</h2>
        <p className="mt-1 text-sm text-slate-300/68">Choose how your device alerts you without losing the premium Android feel.</p>
        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
          <NotificationSoundToggle />
        </div>
        <div className="mt-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
          <CallRingtoneSettings />
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">App tools</h2>
        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
          <NativeAppDownload />
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">Change password</h2>
        <div className="mt-4 space-y-3">
          <Input type="password" placeholder="New password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" />
          <Button variant="secondary" onClick={updatePassword} className="rounded-2xl">Update password</Button>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-rose-400/25 bg-rose-400/8 p-5 backdrop-blur-2xl">
        <h2 className="text-lg font-black text-rose-200">Danger zone</h2>
        <p className="mt-1 text-sm text-rose-100/76">Permanently delete your account and associated data.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4 rounded-2xl">Delete account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone. Type <strong>DELETE</strong> below to confirm.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirm('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={confirm !== 'DELETE'} onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300/76">{label}</Label>
      {children}
    </div>
  )
}
