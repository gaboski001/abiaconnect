import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Trash2, Upload, Apple, Smartphone } from 'lucide-react'
import { format } from 'date-fns'

type Release = {
  id: string
  platform: 'android' | 'ios'
  version: string
  file_path: string
  file_size: number | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export default function AppReleasesSection() {
  const qc = useQueryClient()
  const [platform, setPlatform] = useState<'android' | 'ios'>('android')
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
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
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || (platform === 'android' ? 'apk' : 'ipa')
      const path = `${platform}/abiaconnect-${version}-${Date.now()}.${ext}`
      const up = await supabase.storage.from('app-releases').upload(path, file, {
        contentType: platform === 'android' ? 'application/vnd.android.package-archive' : 'application/octet-stream',
        upsert: false,
      })
      if (up.error) throw up.error
      const ins = await supabase.from('app_releases').insert({
        platform, version, notes: notes || null, file_path: path, file_size: file.size,
      })
      if (ins.error) throw ins.error
      toast.success('Release uploaded')
      setFile(null); setVersion(''); setNotes('')
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
            <Label>Version</Label>
            <Input placeholder="1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Release notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex items-center gap-3">
                  {r.platform === 'ios' ? <Apple className="size-5" /> : <Smartphone className="size-5" />}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.platform.toUpperCase()} v{r.version} {!r.is_active && <span className="text-xs text-muted-foreground">(hidden)</span>}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), 'PP')} · {r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle.mutate(r)}>
                    {r.is_active ? 'Hide' : 'Publish'}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(r)} aria-label="Delete">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
