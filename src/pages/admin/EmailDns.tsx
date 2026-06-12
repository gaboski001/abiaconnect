import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import SEO from '@/components/SEO'

type Status = 'pass' | 'warn' | 'fail' | 'info'

interface CheckResult {
  label: string
  host: string
  status: Status
  record?: string
  notes: string[]
}

const DOH = 'https://dns.google/resolve'

async function fetchTxt(name: string): Promise<string[]> {
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=TXT`)
    const json = await res.json()
    if (!json.Answer) return []
    return json.Answer
      .filter((a: any) => a.type === 16)
      .map((a: any) => (a.data as string).replace(/^"|"$/g, '').replace(/"\s*"/g, ''))
  } catch {
    return []
  }
}

function parseKv(record: string): Record<string, string> {
  const out: Record<string, string> = {}
  record.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=')
    if (k && rest.length) out[k.trim().toLowerCase()] = rest.join('=').trim()
  })
  return out
}

async function checkDmarc(domain: string): Promise<CheckResult> {
  const host = `_dmarc.${domain}`
  const records = await fetchTxt(host)
  const record = records.find((r) => r.toLowerCase().startsWith('v=dmarc1'))
  if (!record) {
    return { label: 'DMARC', host, status: 'fail', notes: ['No DMARC record found.'] }
  }
  const kv = parseKv(record)
  const p = (kv['p'] || '').toLowerCase()
  const pct = kv['pct'] ? parseInt(kv['pct'], 10) : 100
  const notes: string[] = [`p=${p || '(missing)'}`, `pct=${pct}`]
  if (kv['rua']) notes.push(`rua=${kv['rua']}`)
  if (kv['sp']) notes.push(`sp=${kv['sp']}`)
  let status: Status = 'fail'
  if (p === 'reject' && pct === 100) {
    status = 'pass'
    notes.push('Fully enforcing. BIMI eligible.')
  } else if (p === 'quarantine' && pct === 100) {
    status = 'pass'
    notes.push('Enforcing. BIMI eligible.')
  } else if (p === 'quarantine' || p === 'reject') {
    status = 'warn'
    notes.push(`Partial enforcement (pct=${pct}). Raise pct to 100 for BIMI.`)
  } else if (p === 'none') {
    status = 'warn'
    notes.push('Monitoring only. Change p to quarantine or reject for BIMI.')
  }
  return { label: 'DMARC', host, status, record, notes }
}

async function checkSpf(domain: string): Promise<CheckResult> {
  const records = await fetchTxt(domain)
  const record = records.find((r) => r.toLowerCase().startsWith('v=spf1'))
  if (!record) {
    return { label: 'SPF', host: domain, status: 'fail', notes: ['No SPF record on root domain.'] }
  }
  const notes: string[] = []
  const lower = record.toLowerCase()
  const ending = lower.match(/([~\-+?])all\b/)
  if (ending) {
    const q = ending[1]
    if (q === '-') notes.push('Hard fail (-all). Strict.')
    else if (q === '~') notes.push('Soft fail (~all). Recommended.')
    else notes.push(`Weak qualifier (${q}all). Use ~all or -all.`)
  } else {
    notes.push('Missing all mechanism.')
  }
  const status: Status = ending && (ending[1] === '-' || ending[1] === '~') ? 'pass' : 'warn'
  return { label: 'SPF (root)', host: domain, status, record, notes }
}

async function checkDkim(domain: string, selector: string): Promise<CheckResult> {
  const host = `${selector}._domainkey.${domain}`
  const records = await fetchTxt(host)
  const record = records.find((r) => r.toLowerCase().includes('v=dkim1') || r.toLowerCase().includes('k='))
  if (!record) {
    return {
      label: `DKIM (${selector})`,
      host,
      status: 'fail',
      notes: ['No DKIM record at this selector.'],
    }
  }
  const kv = parseKv(record)
  const notes: string[] = []
  if (kv['p']) notes.push(`Public key present (${kv['p'].length} chars)`)
  if (kv['k']) notes.push(`k=${kv['k']}`)
  const status: Status = kv['p'] && kv['p'].length > 50 ? 'pass' : 'warn'
  return { label: `DKIM (${selector})`, host, status, record, notes }
}

function StatusBadge({ status }: { status: Status }) {
  const map = {
    pass: { icon: CheckCircle2, label: 'Pass', cls: 'bg-green-100 text-green-800 border-green-300' },
    warn: { icon: AlertTriangle, label: 'Warning', cls: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
    fail: { icon: XCircle, label: 'Fail', cls: 'bg-red-100 text-red-800 border-red-300' },
    info: { icon: AlertTriangle, label: 'Info', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  } as const
  const { icon: Icon, label, cls } = map[status]
  return (
    <Badge variant="outline" className={cls}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  )
}

export default function EmailDns() {
  const [domain, setDomain] = useState('abiaconnect.com')
  const [sendingSubdomain, setSendingSubdomain] = useState('notify.abiaconnect.com')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CheckResult[]>([])

  async function run() {
    setLoading(true)
    setResults([])
    const checks = await Promise.all([
      checkDmarc(domain),
      checkSpf(domain),
      checkSpf(sendingSubdomain),
      checkDkim(sendingSubdomain, 'mailo'),
      checkDkim(sendingSubdomain, 'k1'),
      checkDkim(sendingSubdomain, 'smtp'),
    ])
    setResults(checks)
    setLoading(false)
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <SEO title="Email DNS Verification" description="Check DMARC, SPF, and DKIM records" />
      <div>
        <h1 className="text-3xl font-bold mb-2">Email DNS Verification</h1>
        <p className="text-muted-foreground">
          Live DNS lookup via Google Public DNS. Confirms DMARC enforcement (BIMI prerequisite), SPF,
          and DKIM are correctly published.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Domains to check</CardTitle>
          <CardDescription>Root domain holds DMARC/SPF; subdomain handles outbound mail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Root domain</label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value.trim())} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Sending subdomain</label>
              <Input
                value={sendingSubdomain}
                onChange={(e) => setSendingSubdomain(e.target.value.trim())}
              />
            </div>
          </div>
          <Button onClick={run} disabled={loading || !domain}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Run checks
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.map((r) => (
        <Card key={r.label}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{r.label}</CardTitle>
                <CardDescription className="font-mono text-xs">{r.host}</CardDescription>
              </div>
              <StatusBadge status={r.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.record && (
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {r.record}
              </pre>
            )}
            <ul className="text-sm space-y-1">
              {r.notes.map((n, i) => (
                <li key={i} className="text-muted-foreground">• {n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {results.length > 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">BIMI readiness</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              BIMI requires DMARC <code>p=quarantine</code> or <code>p=reject</code> with{' '}
              <code>pct=100</code> on the organisational domain, plus a Verified Mark Certificate.
            </p>
            <p>
              Current DMARC status:{' '}
              <strong>
                {results.find((r) => r.label === 'DMARC')?.status === 'pass'
                  ? 'Eligible'
                  : 'Not yet eligible'}
              </strong>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
