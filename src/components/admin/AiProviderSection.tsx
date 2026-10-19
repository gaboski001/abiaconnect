import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CheckCircle2, KeyRound, Loader2, PlugZap, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { loose } from '@/lib/journey'
import { cn } from '@/lib/utils'

type Provider = 'lovable' | 'claude' | 'gemini' | 'deepseek'
type Keyed = Exclude<Provider, 'lovable'>

const INFO: Record<Provider, { name: string; blurb: string; keyHelp?: { label: string; url: string }; models: { id: string; label: string }[] }> = {
  lovable: {
    name: 'Lovable AI',
    blurb: 'Uses your Lovable credit. Good as a backup.',
    models: [{ id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (via Lovable)' }],
  },
  claude: {
    name: 'Claude (Anthropic)',
    blurb: 'Excellent at careful moderation and clear writing. Pay as you go.',
    keyHelp: { label: 'Get a key at console.anthropic.com → API keys', url: 'https://console.anthropic.com/settings/keys' },
    models: [
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest and cheapest (recommended)' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — balanced' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — most capable, costs most' },
    ],
  },
  gemini: {
    name: 'Gemini (Google)',
    blurb: 'Google AI Studio has a free tier with a daily limit, then pay as you go.',
    keyHelp: { label: 'Get a key at aistudio.google.com → Get API key', url: 'https://aistudio.google.com/app/apikey' },
    // Google retires model versions; AbiaConnect switches to the newest stable Flash model the key can use.
    models: [{ id: 'gemini-2.5-flash', label: 'Newest stable Gemini Flash (picked automatically)' }],
  },
  deepseek: {
    name: 'DeepSeek',
    blurb: 'Very low prices. Top up credit on your DeepSeek account.',
    keyHelp: { label: 'Get a key at platform.deepseek.com → API keys', url: 'https://platform.deepseek.com/api_keys' },
    models: [{ id: 'deepseek-chat', label: 'DeepSeek Chat (recommended)' }],
  },
}
const ORDER: Provider[] = ['claude', 'gemini', 'deepseek', 'lovable']
const FEATURES: Record<string, string> = { newsdesk: 'Newsdesk', moderation: 'Ugo moderation', test: 'Tests' }

interface Settings {
  provider: Provider
  models: Partial<Record<Provider, string>>
  fallback: boolean
}

/**
 * Choose which AI runs the Newsdesk and Ugo moderation: your own Claude,
 * Gemini or DeepSeek account, or Lovable AI. Keys are stored encrypted and are
 * never shown again; only a short preview is.
 */
export function AiProviderSection() {
  const qc = useQueryClient()
  const settingsQ = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const [{ data: s, error }, { data: keys }] = await Promise.all([
        loose.from('ai_provider_settings').select('provider, models, fallback').maybeSingle(),
        loose.from('ai_provider_keys').select('provider, preview, updated_at'),
      ])
      if (error) throw new Error(error.message)
      const previews: Partial<Record<Keyed, string>> = {}
      for (const row of (keys ?? []) as { provider: Keyed; preview: string }[]) previews[row.provider] = row.preview
      return {
        settings: ((s as Settings | null) ?? { provider: 'lovable', models: {}, fallback: true }) as Settings,
        previews,
      }
    },
  })
  const usageQ = useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const { data, error } = await loose.rpc('admin_ai_usage', { _days: 7 })
      if (error) throw new Error(error.message)
      return (data ?? []) as { feature: string; provider: Provider; calls: number; failed: number; fell_back: number }[]
    },
  })

  const [provider, setProvider] = useState<Provider>('lovable')
  const [models, setModels] = useState<Partial<Record<Provider, string>>>({})
  const [fallback, setFallback] = useState(true)
  const [keyDrafts, setKeyDrafts] = useState<Partial<Record<Keyed, string>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const s = settingsQ.data?.settings
    if (!s) return
    setProvider(s.provider)
    setModels(s.models ?? {})
    setFallback(s.fallback)
  }, [settingsQ.data])

  const previews = settingsQ.data?.previews ?? {}
  const saved = settingsQ.data?.settings
  const dirty = !!saved && (saved.provider !== provider || saved.fallback !== fallback || JSON.stringify(saved.models ?? {}) !== JSON.stringify(models))
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['ai-settings'] }), qc.invalidateQueries({ queryKey: ['ai-usage'] })])

  async function saveKey(p: Keyed) {
    const value = keyDrafts[p]?.trim()
    if (!value) return
    setBusy(`key-${p}`)
    try {
      const { error } = await loose.rpc('admin_set_ai_key', { _provider: p, _value: value })
      if (error) throw new Error(error.message)
      setKeyDrafts((d) => ({ ...d, [p]: '' }))
      toast.success(`${INFO[p].name} key saved securely.`)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the key.')
    } finally {
      setBusy(null)
    }
  }

  async function removeKey(p: Keyed) {
    setBusy(`remove-${p}`)
    try {
      const { error } = await loose.rpc('admin_clear_ai_key', { _provider: p })
      if (error) throw new Error(error.message)
      toast.success(`${INFO[p].name} key removed.`)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove the key.')
    } finally {
      setBusy(null)
    }
  }

  async function saveChoice() {
    setBusy('save')
    try {
      const { error } = await loose.rpc('admin_set_ai_settings', { _provider: provider, _models: models, _fallback: fallback })
      if (error) throw new Error(error.message)
      toast.success(`Saved. The Newsdesk and Ugo now use ${INFO[provider].name}.`)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  async function runTest(p: Provider) {
    setBusy(`test-${p}`)
    setTest(null)
    try {
      const { data, error } = await supabase.functions.invoke('ai-provider-test', { body: { provider: p } })
      if (error) throw new Error(error.message)
      const r = data as { ok: boolean; model: string; seconds: number; message: string | null; problem: string | null }
      setTest(
        r.ok
          ? { ok: true, text: `${INFO[p].name} works (${r.model}, ${r.seconds}s): “${r.message ?? 'OK'}”` }
          : { ok: false, text: r.problem ?? `${INFO[p].name} did not answer.` },
      )
    } catch (e) {
      setTest({ ok: false, text: e instanceof Error ? e.message : 'The test could not run.' })
    } finally {
      setBusy(null)
    }
  }

  // The model in use may have been picked automatically (e.g. a newer Gemini): always offer it.
  const currentModel = models[provider] ?? saved?.models?.[provider] ?? INFO[provider].models[0]!.id
  const modelOptions = INFO[provider].models.some((m) => m.id === currentModel)
    ? INFO[provider].models
    : [{ id: currentModel, label: `${currentModel} (in use)` }, ...INFO[provider].models]

  const usage = usageQ.data ?? []
  const totalCalls = usage.reduce((sum, row) => sum + Number(row.calls), 0)
  const lovableCalls = usage.filter((row) => row.provider === 'lovable').reduce((sum, row) => sum + Number(row.calls), 0)

  if (settingsQ.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />
  if (settingsQ.isError) {
    return (
      <section className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        The AI provider settings appear once the AI provider database update has been applied.
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-5 w-5 text-primary" /> AI provider
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which AI writes the <strong>Newsdesk</strong> posts and runs <strong>Ugo moderation</strong>. Using your own Claude,
          Gemini or DeepSeek account means these no longer use your Lovable credit.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ORDER.map((p) => {
            const hasKey = p === 'lovable' || !!previews[p as Keyed]
            const on = provider === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                disabled={!hasKey}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  on ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/30' : 'hover:border-primary/40',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{INFO[p].name}</span>
                  {on ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{INFO[p].blurb}</span>
                {!hasKey ? <span className="mt-1 block text-xs font-medium text-amber-600">Add its API key below first</span> : null}
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Model</span>
            <select
              value={currentModel}
              onChange={(e) => setModels((m) => ({ ...m, [provider]: e.target.value }))}
              className="h-10 w-full rounded-lg border bg-background px-3"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
            <Switch checked={fallback} onCheckedChange={setFallback} className="mt-0.5" disabled={provider === 'lovable'} />
            <span>
              <span className="block font-medium">Use Lovable AI as a backup</span>
              <span className="text-xs text-muted-foreground">
                Only if your chosen AI fails (no credit, down). Keeps moderation and the Newsdesk running.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void saveChoice()} disabled={!dirty || busy !== null}>
            {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save choice
          </Button>
          <Button variant="outline" onClick={() => void runTest(provider)} disabled={busy !== null || (provider !== 'lovable' && !previews[provider as Keyed])}>
            {busy === `test-${provider}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Test {INFO[provider].name}
          </Button>
          {dirty ? <span className="text-xs text-muted-foreground">You have unsaved changes.</span> : null}
        </div>
        {test ? (
          <p className={cn('mt-3 rounded-lg p-3 text-sm', test.ok ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'bg-destructive/10 text-destructive')}>
            {test.text}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> API keys
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Stored encrypted. Nobody can see a key again after saving, only its first and last few characters.
        </p>
        <div className="mt-4 space-y-4">
          {(['claude', 'gemini', 'deepseek'] as Keyed[]).map((p) => (
            <div key={p} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{INFO[p].name}</span>
                {previews[p] ? (
                  <span className="flex items-center gap-2 text-xs">
                    <code className="rounded bg-muted px-2 py-0.5">{previews[p]}</code>
                    <Button size="sm" variant="ghost" onClick={() => void runTest(p)} disabled={busy !== null}>
                      {busy === `test-${p}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Test'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void removeKey(p)} disabled={busy !== null} aria-label={`Remove the ${INFO[p].name} key`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No key saved</span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={previews[p] ? 'Paste a new key to replace it' : 'Paste the API key'}
                  value={keyDrafts[p] ?? ''}
                  onChange={(e) => setKeyDrafts((d) => ({ ...d, [p]: e.target.value }))}
                />
                <Button onClick={() => void saveKey(p)} disabled={!keyDrafts[p]?.trim() || busy !== null}>
                  {busy === `key-${p}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
              {INFO[p].keyHelp ? (
                <a href={INFO[p].keyHelp!.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-xs text-primary hover:underline">
                  {INFO[p].keyHelp!.label}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold">AI use in the last 7 days</h3>
        {usageQ.isLoading ? (
          <div className="mt-3 h-20 animate-pulse rounded-lg bg-muted" />
        ) : !usage.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No AI calls recorded yet. They appear here as the Newsdesk runs and posts are checked.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalCalls.toLocaleString()} calls, of which <strong>{lovableCalls.toLocaleString()}</strong> used Lovable credit.
            </p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5">Feature</th>
                  <th className="py-1.5">AI</th>
                  <th className="py-1.5 text-right">Calls</th>
                  <th className="py-1.5 text-right">Failed</th>
                  <th className="py-1.5 text-right">Backup used</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={`${row.feature}-${row.provider}`} className="border-t">
                    <td className="py-1.5">{FEATURES[row.feature] ?? row.feature}</td>
                    <td className="py-1.5">{INFO[row.provider]?.name ?? row.provider}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(row.calls).toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(row.failed).toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(row.fell_back).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  )
}
