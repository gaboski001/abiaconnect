// Posts a newly created thread to the configured Facebook Page.
// Triggered by a Postgres AFTER INSERT trigger on public.threads via pg_net.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://abiaconnect.com'
const FB_GRAPH = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

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

    const link = `${SITE_URL}/thread/${thread_id}`
    const message = `${title}\n\nJoin the conversation on AbiaConnect:\n${link}`

    const res = await fetch(`${FB_GRAPH}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, link, access_token: pageToken }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Facebook API error', data)
      return json({ error: 'Facebook API error', details: data }, 502)
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
