// Newsdesk bot: runs at 07:30 Africa/Lagos via pg_cron, and from
// Admin -> Newsdesk Bot ("Test run", "Run now", Approve, Reject).
//
// A run:
//   1. reads the news feeds (Abia stories first, then national ones),
//   2. asks the AI to choose at most one fresh story per forum,
//   3. asks the AI to write a short discussion starter from each report,
//   4. publishes everyday topics as threads; posts for the sensitive forums,
//      and any story that looks sensitive, wait for an admin's approval.
// Nothing is posted twice: one post per forum per day, and a story the bot has
// used in the last two weeks is not offered again.
//
// Body: {}                              a run (the scheduler; skipped while switched off)
//       { test: true }                  admin test run: everything waits, nothing is published
//       { action: 'approve', id }       publish a waiting post
//       { action: 'reject', id }        discard a waiting post
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireScheduler } from '../_shared/cron-auth.ts'
import { withinRateLimit } from '../_shared/rate-limit.ts'
import {
  FEEDS,
  bannerHtml,
  buildCandidates,
  extractArticleText,
  holdReason,
  lagosDate,
  parseDraft,
  parseRss,
  parseSelection,
  prioritise,
  renderPostHtml,
  selectionSystemPrompt,
  selectionUserMessage,
  sharePathFor,
  sourcesOf,
  writerSystemPrompt,
  writerUserMessage,
  type Forum,
  type Pick,
  type RawItem,
  type SourceLink,
} from '../_shared/newsdesk-core.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const MODEL = 'google/gemini-3-flash-preview'
const USER_AGENT = 'Mozilla/5.0 (compatible; AbiaConnectNewsdesk/1.0; +https://abiaconnect.com)'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// deno-lint-ignore no-explicit-any
type Db = any
type Trigger = 'schedule' | 'admin' | 'test'

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

function serviceDb(): Db {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

/** Who is calling: the scheduler (Vault token), or a signed-in admin. */
async function authorize(req: Request, db: Db): Promise<{ denied: Response } | { adminId: string | null }> {
  const schedulerDenied = await requireScheduler(req)
  if (!schedulerDenied) return { adminId: null }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (token.split('.').length === 3) {
    const { data: claims } = await db.auth.getClaims(token)
    const uid = claims?.claims?.sub as string | undefined
    if (uid && claims?.claims?.role === 'authenticated') {
      const { data: isAdmin } = await db.rpc('is_admin', { _user_id: uid })
      if (isAdmin === true) return { adminId: uid }
      return { denied: json({ error: 'Admins only' }, 403) }
    }
  }
  return { denied: schedulerDenied }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  let res: Response
  try {
    res = await handle(req)
  } catch (e) {
    console.error('daily-newsdesk error', e instanceof Error ? e.message : String(e))
    res = json({ error: 'Something went wrong. Please try again.' }, 500)
  }
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
})

async function handle(req: Request): Promise<Response> {
  const db = serviceDb()
  const who = await authorize(req, db)
  if ('denied' in who) return who.denied

  const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string; test?: boolean; dry_run?: boolean }
  // Proves the scheduler's request got in, without doing anything.
  if (body?.dry_run === true) return json({ ok: true, dry_run: true })

  const action = typeof body.action === 'string' ? body.action : 'run'
  if (action === 'approve' || action === 'reject') {
    if (!who.adminId) return json({ error: 'Admins only' }, 403)
    if (!body.id || !UUID_RE.test(body.id)) return json({ error: 'id required' }, 400)
    return action === 'approve' ? await approve(db, body.id, who.adminId) : await reject(db, body.id, who.adminId)
  }
  if (action !== 'run') return json({ error: 'unknown action' }, 400)

  const trigger: Trigger = who.adminId ? (body.test === true ? 'test' : 'admin') : 'schedule'
  if (who.adminId && !(await withinRateLimit(db, `uid:${who.adminId}`, 'newsdesk-admin-run', 6, 3600, true))) {
    return json({ error: 'Too many runs, try again in an hour' }, 429)
  }
  return await run(db, trigger)
}

// ---------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------

async function run(db: Db, trigger: Trigger): Promise<Response> {
  const { data: settings } = await db.from('newsdesk_settings').select('*').eq('id', true).maybeSingle()
  if (!settings) return json({ error: 'Newsdesk settings are missing' }, 500)
  if (trigger === 'schedule' && !settings.enabled) return json({ ok: true, skipped: 'The bot is switched off' })

  const { data: runRow } = await db.from('newsdesk_runs').insert({ trigger }).select('id').single()
  const finish = async (note: string, counts: { found?: number; published?: number; held?: number } = {}, ok = true) => {
    const fields = {
      finished_at: new Date().toISOString(),
      stories_found: counts.found ?? 0,
      published: counts.published ?? 0,
      held: counts.held ?? 0,
      note,
    }
    if (runRow?.id) await db.from('newsdesk_runs').update(fields).eq('id', runRow.id)
    return json({ ok, note, found: fields.stories_found, published: fields.published, held: fields.held }, ok ? 200 : 500)
  }

  try {
    if (!settings.author_id) return await finish('No account is set for the bot to post as.', {}, false)
    if (!LOVABLE_API_KEY) return await finish('The AI service is not set up (LOVABLE_API_KEY is missing).', {}, false)

    const today = lagosDate()
    const { data: categories, error: catError } = await db
      .from('categories')
      .select('id, name, slug, description')
      .eq('is_active', true)
      .not('slug', 'is', null)
      .order('display_order')
    if (catError) throw catError

    // What the bot already did: today's forums are taken, recent stories are not repeated.
    const since = new Date(Date.now() - 14 * 86400_000).toISOString()
    const { data: recent, error: recentError } = await db
      .from('newsdesk_posts')
      .select('title, sources, category_slug, run_date, status')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(400)
    if (recentError) throw recentError

    const taken = new Set<string>()
    const lastPosted: Record<string, string> = {}
    const usedUrls: string[] = []
    const usedTitles: string[] = []
    const recentTitles: string[] = []
    for (const r of (recent ?? []) as Array<{ title: string; sources: SourceLink[]; category_slug: string; run_date: string; status: string }>) {
      for (const s of Array.isArray(r.sources) ? r.sources : []) {
        if (s?.url) usedUrls.push(s.url)
        if (s?.title) usedTitles.push(s.title)
      }
      if (r.status === 'rejected') continue
      recentTitles.push(r.title)
      if (r.run_date === today) taken.add(r.category_slug)
      if (!lastPosted[r.category_slug] || r.run_date > lastPosted[r.category_slug]) lastPosted[r.category_slug] = r.run_date
    }

    const room = settings.max_posts_per_day - taken.size
    if (room <= 0) return await finish("Today's limit of posts is already reached.")
    const forums: Forum[] = ((categories ?? []) as Array<Forum & { id: string }>).filter((c) => !taken.has(c.slug))
    if (!forums.length) return await finish('Every forum already has a Newsdesk post today.')
    const categoryId = new Map(((categories ?? []) as Array<{ id: string; slug: string }>).map((c) => [c.slug, c.id]))

    // 1. Read the news.
    const feeds = await Promise.all(
      FEEDS.map(async (feed) => {
        const xml = await fetchText(feed.url, 12_000, 600_000)
        return xml ? parseRss(xml, feed) : null
      }),
    )
    const feedsRead = feeds.filter((f) => f && f.length).length
    const raw = feeds.flatMap((f) => f ?? []) as RawItem[]
    const items = buildCandidates(raw, { now: new Date(), usedUrls, usedTitles })
    if (!items.length) {
      return await finish(
        feedsRead ? 'No fresh stories today that the bot has not already used.' : 'The news feeds could not be reached. The bot will try again tomorrow.',
        {},
        feedsRead > 0,
      )
    }

    // 2. Choose at most one story per forum.
    const chosen = await askAi(selectionSystemPrompt(), selectionUserMessage({ forums, items, recentTitles, maxPicks: room }), 0)
    if (chosen === null) return await finish('The AI service did not answer. The bot will try again tomorrow.', { found: items.length }, false)
    const picks = prioritise(parseSelection(chosen, forums, items), room, lastPosted)
    if (!picks.length) {
      return await finish(`Read ${items.length} fresh stories; none was a good fit for a forum today.`, { found: items.length })
    }

    // 3. Write each discussion.
    const written = await Promise.all(picks.map((pick) => write(pick, forums.find((f) => f.slug === pick.forum)!)))

    // 4. Save, and publish what may go out by itself.
    let published = 0
    let held = 0
    let failed = 0
    let unsaved = 0
    // deno-lint-ignore no-explicit-any
    const saved: Array<{ post: any; hold: string | null }> = []
    for (const w of written) {
      if (!w) {
        failed++
        continue
      }
      const hold = holdReason({
        forum: w.pick.forum,
        reviewSlugs: settings.review_slugs ?? [],
        pickSensitive: w.pick.sensitive,
        draft: w.draft,
        sources: w.sources,
        test: trigger === 'test',
      })
      const { data: post, error: insertError } = await db
        .from('newsdesk_posts')
        .insert({
          run_date: today,
          category_id: categoryId.get(w.pick.forum),
          category_slug: w.pick.forum,
          scope: w.pick.scope,
          title: w.draft.title,
          banner_title: w.draft.banner,
          content: renderPostHtml(w.draft, w.sources),
          tags: w.draft.tags,
          sources: w.sources,
          hold_reason: hold,
        })
        .select('*')
        .maybeSingle()
      if (insertError || !post) {
        // 23505: another run posted in this forum a moment ago. Anything else is a real problem.
        if (insertError && insertError.code !== '23505') {
          console.error('newsdesk post not saved', insertError.message)
          unsaved++
        }
        continue
      }
      saved.push({ post, hold })
    }

    // Each post's own banner, drawn side by side. Without one a post still
    // goes out, with its forum's picture.
    await Promise.all(
      saved.map(async (s) => {
        s.post.banner_url = await makeBanner(s.post.id)
      }),
    )

    for (const { post, hold } of saved) {
      if (hold) {
        held++
        continue
      }
      const result = await publish(db, post, settings.author_id)
      if ('error' in result) {
        await db.from('newsdesk_posts').update({ hold_reason: `Could not be published automatically: ${result.error}` }).eq('id', post.id)
        held++
      } else {
        published++
      }
    }

    if (held > 0 && trigger !== 'test') {
      const { count } = await db.from('newsdesk_posts').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      await db.rpc('newsdesk_notify_admins', { _waiting: count ?? held })
    }

    const parts = [`Read ${items.length} fresh stories from ${feedsRead} of ${FEEDS.length} news feeds.`]
    parts.push(`Published ${published}; ${held} waiting for approval.`)
    if (failed) parts.push(`${failed} could not be written and ${failed === 1 ? 'was' : 'were'} left out.`)
    if (unsaved) parts.push(`${unsaved} could not be saved because of a database error.`)
    const withoutBanner = saved.filter((s) => !s.post.banner_url).length
    if (withoutBanner) parts.push(`${withoutBanner} without a banner (the forum picture is used instead).`)
    return await finish(parts.join(' '), { found: items.length, published, held })
  } catch (e) {
    console.error('newsdesk run failed', e instanceof Error ? e.message : String(e))
    return await finish('The run stopped because of an error. The bot will try again tomorrow.', {}, false)
  }
}

/** Reads the reports for one pick and has the AI write the discussion. */
async function write(pick: Pick, forum: Forum) {
  const articleText: Record<number, string> = {}
  await Promise.all(
    pick.items.map(async (item) => {
      // Google's links are redirect pages with no article text in them.
      if (!isPublicArticleUrl(item.url) || /(^|\.)google\.com$/i.test(new URL(item.url).hostname)) return
      const html = await fetchText(item.url, 8_000, 400_000)
      if (html) articleText[item.id] = extractArticleText(html)
    }),
  )
  const answer = await askAi(writerSystemPrompt(), writerUserMessage({ forum, pick, articleText }), 0.4)
  const draft = answer === null ? null : parseDraft(answer)
  return draft ? { pick, draft, sources: sourcesOf(pick) } : null
}

// ---------------------------------------------------------------------------
// Publishing, approving, rejecting
// ---------------------------------------------------------------------------

/** Has the newsdesk-banner function draw and save the post's banner; null when it could not. */
async function makeBanner(postId: string): Promise<string | null> {
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/newsdesk-banner`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ post_id: postId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) console.error('newsdesk banner failed', res.status)
    return res.ok && typeof data?.url === 'string' ? data.url : null
  } catch (e) {
    console.error('newsdesk banner unreachable', e instanceof Error ? e.message : String(e))
    return null
  }
}

// deno-lint-ignore no-explicit-any
async function publish(db: Db, post: any, authorId: string): Promise<{ threadId: string } | { error: string }> {
  const banner = post.banner_url ? bannerHtml(post.banner_url, post.banner_title || post.title) : ''
  const { data: thread, error } = await db
    .from('threads')
    .insert({
      category_id: post.category_id,
      title: post.title,
      content: banner + post.content,
      tags: post.tags ?? [],
      user_id: authorId,
      author_id: authorId,
      is_anonymous: false,
    })
    .select('id')
    .single()
  if (error || !thread) return { error: String(error?.message ?? 'the thread was not saved').slice(0, 200) }
  await db
    .from('newsdesk_posts')
    .update({ status: 'published', thread_id: thread.id, share_path: sharePathFor(post.category_slug, thread.id) })
    .eq('id', post.id)
  return { threadId: thread.id }
}

async function approve(db: Db, id: string, adminId: string): Promise<Response> {
  const { data: settings } = await db.from('newsdesk_settings').select('author_id').eq('id', true).maybeSingle()
  if (!settings?.author_id) return json({ error: 'No account is set for the bot to post as.' }, 409)

  // Claim it first, so two taps (or two admins) can't publish it twice.
  const { data: post } = await db
    .from('newsdesk_posts')
    .update({ status: 'published', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()
  if (!post) return json({ error: 'This post was already approved or rejected.' }, 409)

  // Posts written before banners existed (or whose banner failed) get one now.
  if (!post.banner_url) post.banner_url = await makeBanner(post.id)
  const result = await publish(db, post, settings.author_id)
  if ('error' in result) {
    await db.from('newsdesk_posts').update({ status: 'pending', reviewed_by: null, reviewed_at: null }).eq('id', id)
    return json({ error: `Could not publish: ${result.error}` }, 500)
  }
  return json({ ok: true, thread_id: result.threadId })
}

async function reject(db: Db, id: string, adminId: string): Promise<Response> {
  const { data: post } = await db
    .from('newsdesk_posts')
    .update({ status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (!post) return json({ error: 'This post was already approved or rejected.' }, 409)
  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

/** Only ordinary public web addresses are fetched (feed items name the address). */
function isPublicArticleUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) return false
    if (/^[\d.]+$/.test(host) || host.includes(':')) return false // raw IP addresses
    return true
  } catch {
    return false
  }
}

async function fetchText(url: string, timeoutMs: number, maxChars: number): Promise<string | null> {
  if (!isPublicArticleUrl(url)) return null
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    return (await res.text()).slice(0, maxChars)
  } catch {
    return null
  }
}

/** One question to the AI; the answer is JSON text, or null when it could not answer. */
async function askAi(system: string, user: string, temperature: number): Promise<string | null> {
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(45_000),
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY! },
      body: JSON.stringify({
        model: MODEL,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      console.error('newsdesk AI error', res.status)
      return null
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    return typeof content === 'string' ? content : null
  } catch (e) {
    console.error('newsdesk AI unreachable', e instanceof Error ? e.message : String(e))
    return null
  }
}
