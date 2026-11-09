// Off-site backup to the owner's Cloudflare R2 storage — runs nightly via pg_cron.
// Every night: copies uploaded files that are new or changed since last time.
// Once a week (or with {"snapshot": true}): saves every public table and the
// member account list (no passwords) as gzipped JSON lines under db/<date>/.
// Secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'
import { requireScheduler } from '../_shared/cron-auth.ts'

const PAGE = 1000
const TIME_BUDGET_MS = 120_000
const WEEK_MS = 6.5 * 24 * 3600 * 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

Deno.serve(async (req) => {
  const denied = await requireScheduler(req)
  if (denied) return denied
  const body = await req.json().catch(() => ({}))

  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const bucket = Deno.env.get('R2_BUCKET')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return json({ ok: false, error: 'R2 secrets are not set' }, 500)
  }
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/`
  const put = async (key: string, data: BodyInit, type: string) => {
    const res = await r2.fetch(base + key.split('/').map(encodeURIComponent).join('/'), {
      method: 'PUT',
      body: data,
      headers: { 'Content-Type': type },
    })
    if (!res.ok) throw new Error(`R2 ${res.status} on ${key}: ${(await res.text()).slice(0, 200)}`)
  }

  // Test mode: proves the scheduler got in and R2 accepts a write, nothing else.
  if (body?.dry_run === true) {
    await put('checks/last-check.txt', new Date().toISOString(), 'text/plain')
    return json({ ok: true, dry_run: true })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const started = Date.now()
  const { data: settings } = await db.from('backup_settings').select('enabled').eq('id', true).maybeSingle()
  if (settings && !settings.enabled) return json({ ok: true, skipped: 'switched off' })

  const { data: run, error: runErr } = await db.from('backup_runs').insert({}).select('id').single()
  if (runErr) return json({ ok: false, error: runErr.message }, 500)

  let snapshot: string | null = null
  let tablesSaved = 0
  let rowsSaved = 0
  let filesCopied = 0
  let filesLeft: number | null = null
  try {
    // 1. Tables, once a week.
    const { data: last } = await db.rpc('backup_last_snapshot')
    if (body?.snapshot === true || !last || Date.now() - new Date(last as string).getTime() > WEEK_MS) {
      const day = new Date().toISOString().slice(0, 10)
      const folder = `db/${day}`
      const { data: tables, error } = await db.rpc('backup_tables')
      if (error) throw error
      const counts: Record<string, number> = {}
      const dump = async (name: string, page: (offset: number) => Promise<unknown[]>) => {
        const lines: string[] = []
        for (let offset = 0; ; offset += PAGE) {
          const rows = await page(offset)
          for (const row of rows) lines.push(JSON.stringify(row))
          if (rows.length < PAGE) break
        }
        await put(`${folder}/${name}.jsonl.gz`, await gzip(lines.join('\n')), 'application/gzip')
        counts[name] = lines.length
        rowsSaved += lines.length
      }
      for (const table of (tables ?? []) as string[]) {
        await dump(table, async (offset) => {
          const { data, error } = await db.rpc('backup_table_page', { _table: table, _offset: offset, _limit: PAGE })
          if (error) throw new Error(`${table}: ${error.message}`)
          return (data ?? []) as unknown[]
        })
        tablesSaved++
      }
      await dump('_auth_users', async (offset) => {
        const { data, error } = await db.rpc('backup_auth_users', { _offset: offset, _limit: PAGE })
        if (error) throw new Error(`auth users: ${error.message}`)
        return (data ?? []) as unknown[]
      })
      await put(
        `${folder}/manifest.json`,
        JSON.stringify(
          {
            made_at: new Date().toISOString(),
            site: 'abiaconnect.com',
            format: 'One gzipped file per table; one JSON row per line. _auth_users has member accounts without passwords.',
            files_folder: 'files/<bucket>/<path> holds uploaded files (photos, attachments).',
            row_counts: counts,
          },
          null,
          2,
        ),
        'application/json',
      )
      snapshot = folder
    }

    // 2. Uploaded files that are new or changed, until the time budget runs out.
    while (Date.now() - started < TIME_BUDGET_MS) {
      const { data: todo, error } = await db.rpc('backup_files_to_copy', { _limit: 50 })
      if (error) throw error
      const list = (todo ?? []) as Array<{ bucket_id: string; name: string; updated_at: string; mimetype: string | null; waiting: number }>
      filesLeft = list.length ? Number(list[0].waiting) : 0
      if (!list.length) break
      for (const f of list) {
        if (Date.now() - started >= TIME_BUDGET_MS) break
        const { data: blob, error: dlErr } = await db.storage.from(f.bucket_id).download(f.name)
        if (!dlErr && blob) {
          await put(`files/${f.bucket_id}/${f.name}`, blob, f.mimetype || 'application/octet-stream')
          filesCopied++
        }
        // Mark it either way, so one broken file can't block the queue; a later
        // change to the file makes it eligible again.
        await db.rpc('backup_mark_copied', { _bucket: f.bucket_id, _name: f.name, _updated_at: f.updated_at })
        filesLeft = Math.max(0, (filesLeft ?? 1) - 1)
      }
    }

    await db
      .from('backup_runs')
      .update({ finished_at: new Date().toISOString(), ok: true, db_snapshot: snapshot, tables_saved: tablesSaved, rows_saved: rowsSaved, files_copied: filesCopied, files_left: filesLeft })
      .eq('id', run.id)
    return json({ ok: true, snapshot, tablesSaved, rowsSaved, filesCopied, filesLeft })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db
      .from('backup_runs')
      .update({ finished_at: new Date().toISOString(), ok: false, tables_saved: tablesSaved, rows_saved: rowsSaved, files_copied: filesCopied, files_left: filesLeft, error: message.slice(0, 500) })
      .eq('id', run.id)
    return json({ ok: false, error: message }, 500)
  }
})
