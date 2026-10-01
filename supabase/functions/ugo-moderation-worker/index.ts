// Ugo's background worker (runs every 2 minutes via pg_cron, service role only).
// Works through public.moderation_queue so the community stays safe while
// admins are away:
//   • new threads / replies: re-checked (catches anything that skipped the
//     in-app check); clear, serious violations are hidden and the author told;
//     uncertain ones are flagged for an admin.
//   • reports: clear violations removed, clearly fine content dismissed, the
//     reporter told the outcome; anything uncertain stays for an admin.
//   • appeals: clear false alarms approved, clear violations explained;
//     anything uncertain stays for an admin.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { requireScheduler } from '../_shared/cron-auth.ts'
import { canAutoClear, canAutoRemove, contentHash, stripHtml, ugoReview, UGO_NAME, type Surface, type UgoResult } from '../_shared/ugo.ts'

const BATCH = 15
const MAX_ATTEMPTS = 5

type QueueRow = { id: string; kind: 'thread' | 'reply' | 'report' | 'appeal'; ref_id: string; attempts: number }

Deno.serve(async (req) => {
  const denied = await requireScheduler(req)
  if (denied) return denied
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: claimed, error } = await db.rpc('claim_moderation_queue', { _limit: BATCH })
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  const results: Array<{ id: string; outcome: string }> = []
  for (const item of (claimed ?? []) as QueueRow[]) {
    let outcome = 'done'
    try {
      outcome = await handle(db, item)
      if (outcome === 'retry' && item.attempts < MAX_ATTEMPTS) {
        await db.from('moderation_queue').update({ status: 'pending' }).eq('id', item.id)
      } else {
        await db.from('moderation_queue').update({ status: 'done', processed_at: new Date().toISOString(), outcome }).eq('id', item.id)
      }
    } catch (e) {
      outcome = `error: ${(e as Error).message}`.slice(0, 300)
      await db
        .from('moderation_queue')
        .update({ status: item.attempts < MAX_ATTEMPTS ? 'pending' : 'error', outcome })
        .eq('id', item.id)
    }
    results.push({ id: item.id, outcome })
  }
  return Response.json({ ok: true, processed: results.length, results })
})

async function handle(db: SupabaseClient, item: QueueRow): Promise<string> {
  switch (item.kind) {
    case 'thread':
      return reviewThread(db, item.ref_id)
    case 'reply':
      return reviewReply(db, item.ref_id)
    case 'report':
      return reviewReport(db, item.ref_id)
    case 'appeal':
      return reviewAppeal(db, item.ref_id)
  }
}

async function isAdmin(db: SupabaseClient, userId: string | null): Promise<boolean> {
  if (!userId) return false
  const { data } = await db.rpc('is_admin', { _user_id: userId })
  return data === true
}

/** Already approved by the in-app check a few minutes ago? Then skip. */
async function alreadyChecked(db: SupabaseClient, userId: string | null, content: string): Promise<boolean> {
  if (!userId) return false
  const hash = await contentHash(userId, content)
  const { data } = await db
    .from('moderation_log')
    .select('id')
    .eq('content_hash', hash)
    .eq('allowed', true)
    .gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString())
    .limit(1)
  return !!data?.length
}

async function notify(db: SupabaseClient, userId: string | null, message: string, link: string | null = null) {
  if (!userId) return
  await db.from('notifications').insert({ user_id: userId, type: 'moderation', message, link })
}

async function log(db: SupabaseClient, d: UgoResult, f: { userId: string | null; surface: Surface; title?: string | null; content: string; actor: string; note: string }) {
  await db.from('moderation_log').insert({
    user_id: f.userId,
    surface: f.surface,
    allowed: d.verdict !== 'block',
    verdict: d.verdict,
    reason: d.reason,
    categories: d.categories,
    title: (f.title ?? '').slice(0, 300),
    content_excerpt: stripHtml(f.content).slice(0, 1000),
    degraded: d.degraded,
    actor: f.actor,
    review_note: f.note,
  })
}

const quote = (s: string | null | undefined) => {
  const t = stripHtml(s ?? '')
  return t.length > 60 ? `"${t.slice(0, 57)}…"` : `"${t}"`
}

async function reviewThread(db: SupabaseClient, id: string): Promise<string> {
  const { data: t } = await db.from('threads').select('id, title, content, is_deleted, private_author_id, author_id').eq('id', id).maybeSingle()
  if (!t || t.is_deleted) return 'skipped: gone'
  const author = t.private_author_id ?? t.author_id
  if (await isAdmin(db, author)) return 'skipped: admin'
  if (await alreadyChecked(db, author, t.content ?? '')) return 'skipped: already checked'
  const d = await ugoReview({ surface: 'thread', title: t.title, content: t.content ?? '' })
  if (d.degraded) return 'retry'
  if (canAutoRemove(d)) {
    await db.from('threads').update({ is_deleted: true }).eq('id', id)
    await log(db, d, { userId: author, surface: 'thread', title: t.title, content: t.content ?? '', actor: 'ugo_auto', note: `Hidden automatically by ${UGO_NAME}` })
    await notify(
      db,
      author,
      `${UGO_NAME}, our community guardian, hid your discussion ${quote(t.title)}. ${d.reason ?? ''} ${d.suggestion ?? ''} If you think this is a mistake, contact the admins from the Help centre.`.trim(),
      '/help',
    )
    return 'hidden'
  }
  if (d.verdict === 'block') {
    await log(db, d, { userId: author, surface: 'thread', title: t.title, content: t.content ?? '', actor: 'ugo_flag', note: `Flagged by ${UGO_NAME} for admin review` })
    await db.from('reports').insert({ thread_id: id, reported_user_id: author, reason: `${UGO_NAME}: ${d.reason ?? 'possible guideline breach'}`, status: 'pending' })
    return 'flagged'
  }
  return 'ok'
}

async function reviewReply(db: SupabaseClient, id: string): Promise<string> {
  const { data: r } = await db.from('replies').select('id, content, user_id, thread_id, is_hidden').eq('id', id).maybeSingle()
  if (!r || r.is_hidden) return 'skipped: gone'
  if (await isAdmin(db, r.user_id)) return 'skipped: admin'
  if (await alreadyChecked(db, r.user_id, r.content ?? '')) return 'skipped: already checked'
  const d = await ugoReview({ surface: 'reply', content: r.content ?? '' })
  if (d.degraded) return 'retry'
  if (canAutoRemove(d)) {
    await db.from('replies').update({ is_hidden: true }).eq('id', id)
    await log(db, d, { userId: r.user_id, surface: 'reply', content: r.content ?? '', actor: 'ugo_auto', note: `Hidden automatically by ${UGO_NAME}` })
    await notify(db, r.user_id, `${UGO_NAME}, our community guardian, hid your reply ${quote(r.content)}. ${d.reason ?? ''} ${d.suggestion ?? ''}`.trim(), `/thread/${r.thread_id}`)
    return 'hidden'
  }
  if (d.verdict === 'block') {
    await log(db, d, { userId: r.user_id, surface: 'reply', content: r.content ?? '', actor: 'ugo_flag', note: `Flagged by ${UGO_NAME} for admin review` })
    await db.from('reports').insert({ reply_id: id, thread_id: r.thread_id, reported_user_id: r.user_id, reason: `${UGO_NAME}: ${d.reason ?? 'possible guideline breach'}`, status: 'pending' })
    return 'flagged'
  }
  return 'ok'
}

async function reviewReport(db: SupabaseClient, id: string): Promise<string> {
  const { data: rep } = await db.from('reports').select('id, reason, status, thread_id, reply_id, reporter_id').eq('id', id).maybeSingle()
  if (!rep || rep.status !== 'pending') return 'skipped: handled'
  if (!rep.reporter_id) return 'skipped: raised by Ugo' // Ugo's own flags wait for an admin

  // Load what was reported.
  let surface: Surface = 'thread'
  let title: string | null = null
  let content = ''
  let author: string | null = null
  let gone = false
  let link: string | null = null
  if (rep.reply_id) {
    const { data: r } = await db.from('replies').select('content, user_id, thread_id, is_hidden').eq('id', rep.reply_id).maybeSingle()
    surface = 'reply'
    content = r?.content ?? ''
    author = r?.user_id ?? null
    gone = !r || r.is_hidden
    link = r ? `/thread/${r.thread_id}` : null
  } else if (rep.thread_id) {
    const { data: t } = await db.from('threads').select('title, content, private_author_id, author_id, is_deleted').eq('id', rep.thread_id).maybeSingle()
    title = t?.title ?? null
    content = t?.content ?? ''
    author = t?.private_author_id ?? t?.author_id ?? null
    gone = !t || t.is_deleted
    link = t ? `/thread/${rep.thread_id}` : null
  } else {
    await db.from('reports').update({ ai_note: `${UGO_NAME}: report about a member (not a post); needs an admin.`, ai_reviewed_at: new Date().toISOString() }).eq('id', id)
    return 'escalated: member report'
  }

  if (gone) {
    await db.from('reports').update({ status: 'resolved', ai_note: `${UGO_NAME}: the content was already removed.`, ai_reviewed_at: new Date().toISOString() }).eq('id', id)
    return 'resolved: already gone'
  }
  if (await isAdmin(db, author)) {
    await db.from('reports').update({ ai_note: `${UGO_NAME}: content by an admin; needs another admin.`, ai_reviewed_at: new Date().toISOString() }).eq('id', id)
    return 'escalated: admin content'
  }

  const d = await ugoReview({ surface, title, content, report: { reason: rep.reason } })
  if (d.degraded) return 'retry'
  const now = new Date().toISOString()
  if (canAutoRemove(d)) {
    if (rep.reply_id) await db.from('replies').update({ is_hidden: true }).eq('id', rep.reply_id)
    else await db.from('threads').update({ is_deleted: true }).eq('id', rep.thread_id)
    await db.from('reports').update({ status: 'resolved', ai_note: `${UGO_NAME} removed it: ${d.reason ?? ''}`, ai_reviewed_at: now }).eq('id', id)
    await log(db, d, { userId: author, surface, title, content, actor: 'ugo_auto', note: `Removed by ${UGO_NAME} after a member report` })
    await notify(db, rep.reporter_id, `Thank you for your report. ${UGO_NAME}, our community guardian, reviewed it and removed the content.`)
    await notify(db, author, `${UGO_NAME}, our community guardian, removed your ${surface === 'reply' ? 'reply' : 'discussion'} ${quote(title ?? content)} after a review. ${d.reason ?? ''}`.trim(), '/help')
    return 'report upheld'
  }
  if (canAutoClear(d)) {
    await db.from('reports').update({ status: 'dismissed', ai_note: `${UGO_NAME}: no guideline breach found.`, ai_reviewed_at: now }).eq('id', id)
    await notify(
      db,
      rep.reporter_id,
      `Thank you for your report. ${UGO_NAME}, our community guardian, reviewed it and found no breach of our guidelines. You can block or mute the member if you'd rather not see their posts.`,
      link,
    )
    return 'report dismissed'
  }
  await db
    .from('reports')
    .update({ ai_note: `${UGO_NAME} (needs a human decision): ${d.verdict}, ${d.categories.join(', ') || 'no category'}. ${d.reason ?? ''}`.trim(), ai_reviewed_at: now })
    .eq('id', id)
  return 'escalated'
}

async function reviewAppeal(db: SupabaseClient, id: string): Promise<string> {
  const { data: a } = await db
    .from('moderation_appeals')
    .select('id, user_id, surface, original_title, original_content, reason_shown, user_note, status')
    .eq('id', id)
    .maybeSingle()
  if (!a || a.status !== 'pending') return 'skipped: handled'
  const surface: Surface = (['thread', 'reply', 'message', 'subgroup'] as Surface[]).includes(a.surface) ? a.surface : 'thread'
  const d = await ugoReview({
    surface,
    title: a.original_title,
    content: a.original_content,
    appeal: { reasonShown: a.reason_shown, note: a.user_note },
  })
  if (d.degraded) return 'retry'
  const now = new Date().toISOString()
  if (canAutoClear(d)) {
    await db.from('moderation_appeals').update({ status: 'approved', review_note: `Approved by ${UGO_NAME}: on review this follows our guidelines. You can post it now.`, reviewed_at: now }).eq('id', id)
    await notify(db, a.user_id, `Good news: ${UGO_NAME}, our community guardian, reviewed your appeal and approved it. You can post your content now.`)
    return 'appeal approved'
  }
  if (d.verdict === 'block' && d.confidence >= 0.85) {
    const note = `${UGO_NAME} reviewed your appeal and the decision stands. ${d.reason ?? ''} ${d.suggestion ?? ''}`.trim()
    await db.from('moderation_appeals').update({ status: 'rejected', review_note: note, reviewed_at: now }).eq('id', id)
    await notify(db, a.user_id, `${note} If you still disagree, an admin can take another look via the Help centre.`, '/help')
    return 'appeal rejected'
  }
  await db.from('moderation_appeals').update({ review_note: `${UGO_NAME}: needs a human decision (${d.verdict}). ${d.reason ?? ''}`.trim() }).eq('id', id)
  return 'escalated'
}
