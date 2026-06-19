// Posts a newly created thread to the configured Facebook Page.
// Triggered by a Postgres AFTER INSERT trigger on public.threads via pg_net.
import { requireServiceRole } from "../_shared/service-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://abiaconnect.com'
const FB_GRAPH = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const denied = await requireServiceRole(req)
  if (denied) return denied

  try {

    const pageId = Deno.env.get('FACEBOOK_PAGE_ID')
    const pageToken = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')
    if (!pageId || !pageToken) {
      return json({ error: 'Facebook credentials not configured' }, 500)
    }

    const body = await req.json().catch(() => ({}))
    const { thread_id, title, is_anonymous } = body as {
      thread_id?: string
      title?: string
      is_anonymous?: boolean
    }

    if (!thread_id || !title) return json({ error: 'thread_id and title required' }, 400)
    if (is_anonymous) return json({ skipped: 'anonymous thread' }, 200)

    const targetPageId = await resolvePageId(pageId, pageToken)
    const link = `${SITE_URL}/thread/${thread_id}`
    const message = `${title}\n\nJoin the conversation on AbiaConnect:\n${link}`

    const res = await fetch(`${FB_GRAPH}/${targetPageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, link, access_token: pageToken }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Facebook API error', safeFacebookError(data))
      return json({ error: 'Facebook API error', details: safeFacebookError(data) }, 502)
    }
    return json({ ok: true, fb: data })
  } catch (err) {
    console.error('post-thread-to-facebook error', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function resolvePageId(configuredPageId: string, pageToken: string) {
  const res = await fetch(
    `${FB_GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(pageToken)}`,
  )
  const data = await res.json().catch(() => ({})) as { id?: string; name?: string; error?: unknown }

  if (!res.ok || !data.id) {
    console.error('Unable to resolve Facebook Page from token', safeFacebookError(data))
    return configuredPageId
  }

  if (data.id !== configuredPageId) {
    console.log('Using Facebook Page ID resolved from page token')
  }

  return data.id
}

function safeFacebookError(data: unknown) {
  const error = (data as { error?: { message?: string; type?: string; code?: number; fbtrace_id?: string } })?.error
  if (!error) return data
  return {
    error: {
      message: error.message,
      type: error.type,
      code: error.code,
      fbtrace_id: error.fbtrace_id,
    },
  }
}
