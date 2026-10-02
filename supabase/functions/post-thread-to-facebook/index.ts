// Posts approved threads to the AbiaConnect Facebook Page, and takes them down
// again when the thread is removed.
//
// Called only by the database (scheduler token, see _shared/cron-auth.ts):
//   - when an admin presses "Share to Facebook" (share_thread_to_facebook),
//   - when a thread becomes popular (queue_popular_threads_for_facebook),
//   - when a shared thread is removed (facebook_unshare_removed_thread).
// Body: { thread_id, action?: 'post' | 'remove', fb_post_id? }
//
// A thread is posted only if it is queued in facebook_shares, and the function
// re-checks it first: never anonymous threads, private-group threads or
// removed threads. The text comes from the database, never from the request.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireScheduler } from '../_shared/cron-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
}

const SITE_URL = 'https://abiaconnect.com'
// FACEBOOK_GRAPH_URL is only set by local tests (a fake Facebook); production uses the real one.
const FB_GRAPH = Deno.env.get('FACEBOOK_GRAPH_URL') || 'https://graph.facebook.com/v21.0'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const denied = await requireScheduler(req)
  if (denied) return denied

  try {
    const pageId = Deno.env.get('FACEBOOK_PAGE_ID')
    const pageToken = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')
    if (!pageId || !pageToken) {
      return json({ error: 'Facebook credentials not configured' }, 500)
    }

    const body = await req.json().catch(() => ({}))
    const { thread_id, action = 'post', fb_post_id, is_anonymous } = body as {
      thread_id?: string
      action?: string
      fb_post_id?: string
      is_anonymous?: boolean
    }
    // Connection test used by admins: proves the scheduler got in, posts nothing.
    if (is_anonymous === true) return json({ skipped: 'anonymous thread' }, 200)
    if (!thread_id || !UUID_RE.test(thread_id)) return json({ error: 'thread_id required' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    if (action === 'remove') return await removePost(db, thread_id, fb_post_id, pageToken)
    if (action !== 'post') return json({ error: 'unknown action' }, 400)

    // Claim the queued share (only approved threads, and only once).
    const { data: claimed } = await db
      .from('facebook_shares')
      .update({ status: 'posting', updated_at: new Date().toISOString() })
      .eq('thread_id', thread_id)
      .eq('status', 'queued')
      .select('thread_id, attempts')
      .maybeSingle()
    if (!claimed) return json({ skipped: 'not approved for Facebook' }, 200)

    const { data: blocker } = await db.rpc('facebook_share_blocker', { _thread_id: thread_id })
    if (blocker) {
      await setShare(db, thread_id, { status: 'skipped', note: String(blocker) })
      return json({ skipped: blocker }, 200)
    }

    const { data: thread } = await db.from('threads').select('id, title').eq('id', thread_id).maybeSingle()
    if (!thread) {
      await setShare(db, thread_id, { status: 'skipped', note: 'thread not found' })
      return json({ skipped: 'thread not found' }, 200)
    }

    // Make sure the saved token really is the AbiaConnect Page's own token,
    // so threads can never go out as a person or to a different Page.
    const tokenCheck = await checkPageToken(pageId, pageToken)
    if (!tokenCheck.ok) {
      await setShare(db, thread_id, { status: 'failed', note: tokenCheck.reason, attempts: (claimed.attempts ?? 0) + 1 })
      return json({ error: tokenCheck.reason }, 409)
    }
    const targetPageId = pageId
    const link = `${SITE_URL}/thread/${thread.id}`
    const message = `${thread.title}\n\nJoin the conversation on AbiaConnect:\n${link}`

    const res = await fetch(`${FB_GRAPH}/${targetPageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, link, access_token: pageToken }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.id) {
      const err = safeFacebookError(data)
      console.error('Facebook API error', err)
      await setShare(db, thread_id, {
        status: 'failed',
        note: errorText(err),
        attempts: (claimed.attempts ?? 0) + 1,
      })
      return json({ error: 'Facebook API error', details: err }, 502)
    }

    await setShare(db, thread_id, {
      status: 'posted',
      fb_post_id: String(data.id),
      posted_at: new Date().toISOString(),
      note: null,
      attempts: (claimed.attempts ?? 0) + 1,
    })
    return json({ ok: true, fb_post_id: data.id })
  } catch (err) {
    console.error('post-thread-to-facebook error', err instanceof Error ? err.message : String(err))
    return json({ error: 'internal error' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function removePost(db: any, threadId: string, postIdFromDb: string | undefined, pageToken: string) {
  const { data: share } = await db.from('facebook_shares').select('fb_post_id').eq('thread_id', threadId).maybeSingle()
  // The row is gone when the thread was hard-deleted; the trigger passes the post id along then.
  const postId: string | undefined = share?.fb_post_id ?? postIdFromDb
  if (!postId || !/^[0-9_]+$/.test(postId)) return json({ skipped: 'nothing to remove' }, 200)

  const res = await fetch(`${FB_GRAPH}/${postId}?access_token=${encodeURIComponent(pageToken)}`, { method: 'DELETE' })
  const data = await res.json().catch(() => ({}))
  // Already gone on Facebook (deleted by hand) counts as removed.
  const gone = res.ok || (data as { error?: { code?: number } })?.error?.code === 100
  if (share) {
    await setShare(db, threadId, gone ? { status: 'removed' } : { status: 'failed', note: `remove: ${errorText(safeFacebookError(data))}` })
  }
  if (!gone) {
    console.error('Facebook delete error', safeFacebookError(data))
    return json({ error: 'Facebook API error' }, 502)
  }
  return json({ ok: true, removed: postId })
}

// deno-lint-ignore no-explicit-any
async function setShare(db: any, threadId: string, fields: Record<string, unknown>) {
  await db.from('facebook_shares').update({ ...fields, updated_at: new Date().toISOString() }).eq('thread_id', threadId)
}

function errorText(err: unknown) {
  const e = (err as { error?: { message?: string; code?: number } })?.error
  return (e?.message ? `${e.message}${e.code ? ` (code ${e.code})` : ''}` : 'unknown Facebook error').slice(0, 300)
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** The saved token must be a Page token for exactly the configured Page. */
async function checkPageToken(pageId: string, pageToken: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const res = await fetch(`${FB_GRAPH}/me?fields=id,name&metadata=1&access_token=${encodeURIComponent(pageToken)}`)
  const data = (await res.json().catch(() => ({}))) as { id?: string; name?: string; metadata?: { type?: string }; error?: unknown }
  if (!res.ok || !data.id) {
    return { ok: false, reason: `Facebook token rejected: ${errorText(safeFacebookError(data))}` }
  }
  const type = data.metadata?.type
  if (type && type !== 'page') {
    return {
      ok: false,
      reason: `The saved Facebook token is a personal (${type}) token for "${data.name ?? data.id}". Save the AbiaConnect Page's own token (Type: Page) as FACEBOOK_PAGE_ACCESS_TOKEN.`,
    }
  }
  if (data.id !== pageId) {
    return {
      ok: false,
      reason: `The saved Facebook token belongs to the Page "${data.name ?? ''}" (${data.id}), not the AbiaConnect Page (${pageId}). Nothing was posted.`,
    }
  }
  return { ok: true }
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
