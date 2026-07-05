import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Mail, Bell } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/lib/toast'

export default function BirthdayPreview() {
  const [name, setName] = useState('Chinedu')
  const [html, setHtml] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)

  const dashboardMessage = useMemo(
    () =>
      `Happy birthday, ${name || 'friend'}! 🎉 The whole AbiaConnect family is celebrating you today — wishing you health, joy, and every blessing in the year ahead.`,
    [name],
  )

  async function loadPreview() {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('preview-email-template', {
        body: {
          templateName: 'birthday-greeting',
          templateData: { name: name || 'friend' },
        },
      })
      if (error) throw error
      if ((data as any)?.error) throw new Error((data as any).error)
      setHtml((data as any).html)
      setSubject((data as any).subject)
    } catch (e) {
      toast.error((e as Error).message || 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEO title="Birthday Preview · Admin · AbiaConnect" description="Preview the birthday email and dashboard message before sending." path="/admin/birthday-preview" />

      <div>
        <h1 className="text-2xl font-semibold">Birthday Greeting Preview</h1>
        <p className="text-sm text-muted-foreground">
          Preview the exact email and dashboard notification users receive on their birthday.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sample recipient</CardTitle>
          <CardDescription>Try different names to see how the greeting reads.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chinedu" />
          </div>
          <Button onClick={loadPreview} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Refresh preview
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Dashboard notification
          </CardTitle>
          <CardDescription>type: <code>birthday</code> · link: <code>/</code></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4 bg-muted/30">{dashboardMessage}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email
          </CardTitle>
          <CardDescription>
            Subject: <span className="font-medium">{subject || '—'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : html ? (
            <iframe
              title="Birthday email preview"
              srcDoc={html}
              sandbox=""
              /* bg-white is intentional — this iframe renders the actual
                 email HTML, which is designed for a white inbox surface. */
              className="w-full h-[640px] rounded-md border border-border bg-white"
            />
          ) : (
            <div className="text-sm text-muted-foreground">No preview loaded.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
