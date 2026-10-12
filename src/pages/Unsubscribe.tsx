import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { supabase } from '@/lib/supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type State = 'none' | 'working' | 'done' | 'failed'

const MESSAGES: Record<State, string> = {
  none: "To stop receiving emails from AbiaConnect, use the unsubscribe link at the bottom of any email we've sent you.",
  working: 'One moment…',
  done: 'You will not receive any more of these emails. Emails about your account, such as password resets, are not affected.',
  failed:
    'We could not confirm this link. Please open the unsubscribe link from the email again, or write to support@abiaconnect.com.',
}

export default function Unsubscribe() {
  const [params] = useSearchParams()
  // Premium invitation and support appeal emails carry the member's own link
  // (?t=..., with k=support for the support appeal).
  const token = params.get('t') ?? ''
  const optOut = params.get('k') === 'support' ? 'support_appeal_opt_out' : 'premium_invite_opt_out'
  const valid = UUID.test(token)
  const [state, setState] = useState<State>(valid ? 'working' : 'none')

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    // The functions are newer than the generated Supabase types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).rpc(optOut, { _token: token }).then(
      ({ data, error }: { data: boolean | null; error: unknown }) => {
        if (!cancelled) setState(!error && data === true ? 'done' : 'failed')
      },
      () => {
        if (!cancelled) setState('failed')
      },
    )
    return () => {
      cancelled = true
    }
  }, [token, valid, optOut])

  return (
    <>
      <SEO title="Unsubscribe" description="Unsubscribe from AbiaConnect emails" path="/unsubscribe" />
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">{state === 'done' ? 'You are unsubscribed' : 'Unsubscribe'}</h1>
          <p className="text-muted-foreground" role="status">
            {MESSAGES[state]}
          </p>
        </div>
      </div>
    </>
  )
}
