import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { Trash2, Upload, Apple, Smartphone } from 'lucide-react'
import { format } from 'date-fns'

type Release = {
  id: string
  platform: 'android' | 'ios'
  version: string
  file_path: string
  file_size: number | null
  notes: string | null
  changelog: string | null
  is_active: boolean
  created_at: string
}

/** The server's reason for refusing an upload (e.g. "rejected: not an Android app (APK) package"). */
async function functionErrorMessage(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return String(body.error)
    } catch {
      /* not JSON */
    }
  }
  return err instanceof Error ? err.message : 'Upload failed'
}

export default function AppReleasesSection() {
  const qc = useQueryClient()
  const [platform, setPlatform] = useState<'android' | 'ios'>('android')
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [changelog, setChangelog] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const q = useQuery({
    queryKey: ['app-releases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_releases')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Release[]
    },
  })

  const upload = async () => {
    if (!file || !version) return toast.error('Pick a file and version')
    if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
      return toast.error('Version must be semver (e.g. 1.2.3)')
    }
    const ext = platform === 'android' ? 'apk' : 'ipa'
    if (!file.name.toLowerCase().endsWith(`.${ext}`)) return toast.error(`Pick a .${ext} file for ${platform}`)
    if (file.size > 100 * 1024 * 1024) return toast.error('File is larger than 100 MB')
    setUploading(true)
    try {
      // The server checks the file (size, type, real package contents) and
      // stores it; the bucket no longer accepts direct browser uploads.
      const form = new FormData()
      form.append('platform', platform)
      form.append('version', version)
      if (changelog) form.append('changelog', changelog)
      if (notes) form.append('notes', notes)
      form.append('file', file, file.name)
      const { error: upErr } = await supabase.functions.invoke('upload-release', { body: form })
      if (upErr) throw new Error(await functionErrorMessage(upErr))
      toast.success('Release uploaded')

      // Fire-and-forget: notify users with a push + in-app notification.
      try {
        const { data: notifyRes, error: notifyErr } = await supabase.functions.invoke('notify-release', {
          body: { platform, version, changelog: changelog || null },
        })
        if (notifyErr) throw notifyErr
        toast.success(`Notified ${notifyRes?.sent ?? 0} device(s) about v${version}`)
      } catch (e) {
        toast.error(`Release saved, but notification failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }

      setFile(null); setVersion(''); setNotes(''); setChangelog('')
      qc.invalidateQueries({ queryKey: ['app-releases'] })
      qc.invalidateQueries({ queryKey: ['app-releases-public'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const del = useMutation({
    mutationFn: async (r: Release) => {
      await supabase.storage.from('app-releases').remove([r.file_path])
      const { error } = await supabase.from('app_releases').delete().eq('id', r.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Deleted')
      qc.invalidateQueries({ queryKey: ['app-releases'] })
      qc.invalidateQueries({ queryKey: ['app-releases-public'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  })

  const toggle = useMutation({
    mutationFn: async (r: Release) => {
      const { error } = await supabase.from('app_releases').update({ is_active: !r.is_active }).eq('id', r.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-releases'] }),
  })

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Upload className="size-4" /> Upload Native App Release</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as 'android' | 'ios')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="android">Android (.apk)</SelectItem>
                <SelectItem value="ios">iOS (.ipa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Version (semver)</Label>
            <Input placeholder="1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
            <p className="text-xs text-muted-foreground">Format: MAJOR.MINOR.PATCH (e.g. 1.2.3)</p>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Changelog (shown to users)</Label>
            <Textarea rows={4} placeholder="- Fixed login crash&#10;- New dashboard layout" value={changelog} onChange={(e) => setChangelog(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Internal notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>App file</Label>
            <Input type="file" accept=".apk,.ipa" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <Button onClick={upload} disabled={uploading || !file || !version}>
          {uploading ? 'Uploading…' : 'Upload Release'}
        </Button>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <h2 className="font-bold">Releases</h2>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !q.data?.length ? (
          <p className="text-sm text-muted-foreground">No releases yet.</p>
        ) : (
          <ul className="space-y-2">
            {q.data.map((r) => (
              <li key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    {r.platform === 'ios' ? <Apple className="size-5" /> : <Smartphone className="size-5" />}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.platform.toUpperCase()} v{r.version} {!r.is_active && <span className="text-xs text-muted-foreground">(hidden)</span>}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), 'PP')} · {r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => toggle.mutate(r)}>
                      {r.is_active ? 'Hide' : 'Publish'}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(r)} aria-label="Delete">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {r.changelog && (
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted/40 rounded p-2 max-h-32 overflow-auto">{r.changelog}</pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
