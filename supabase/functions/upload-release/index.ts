// Upload a built APK/IPA. The ONLY way files get into the app-releases bucket
// (browser uploads to the bucket are blocked by storage policy).
//
// Who may upload:
//   - CI (GitHub Actions) with the shared RELEASE_UPLOAD_TOKEN (x-upload-token
//     header). CI releases are saved INACTIVE: members never get a file an
//     admin hasn't switched on, so a leaked token cannot ship an app to users.
//   - A signed-in admin (Authorization: Bearer <session>), from the admin page.
//
// Every upload, whoever sends it (app, curl, Postman...), gets the same checks:
// size limit (enforced while reading, before buffering), platform/extension
// allowlist, real package contents (ZIP index must contain the APK/IPA entries),
// no unsafe archive paths, unique version, server-chosen storage name, no
// overwrite, and rate limits.
//
// POST multipart/form-data: file, platform (android|ios), version, changelog?, notes?
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  RELEASE_CONTENT_TYPE,
  RELEASE_MAX_BYTES,
  SEMVER_RE,
  checkReleasePackage,
  extensionMatches,
  releaseStoragePath,
  safeEqual,
  type ReleasePlatform,
} from '../_shared/release-package.ts'
import { clientIp, withinRateLimit } from '../_shared/rate-limit.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-upload-token, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

// Room for the form fields around the file.
const BODY_CAP = RELEASE_MAX_BYTES + 1024 * 1024
const MIN_TOKEN_LENGTH = 32

/** Reads the request body, giving up as soon as it passes `cap` bytes. */
async function readCapped(req: Request, cap: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = req.body?.getReader()
  if (!reader) return new Uint8Array(new ArrayBuffer(0))
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > cap) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(new ArrayBuffer(total))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const ip = clientIp(req)

  // --- Who is uploading? ---------------------------------------------------
  const uploadToken = req.headers.get('x-upload-token') ?? ''
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const bearerIsJwt = bearer.split('.').length === 3

  let source: 'ci' | 'admin' | null = null
  let adminId: string | null = null

  const ciToken = uploadToken || (!bearerIsJwt ? bearer : '')
  if (ciToken) {
    const expected = Deno.env.get('RELEASE_UPLOAD_TOKEN') ?? ''
    if (expected.length < MIN_TOKEN_LENGTH) {
      console.error(`RELEASE_UPLOAD_TOKEN missing or shorter than ${MIN_TOKEN_LENGTH} characters; CI uploads refused`)
      return json({ error: 'uploads by token are disabled until a strong token is configured' }, 503)
    }
    if (safeEqual(ciToken, expected)) source = 'ci'
  } else if (bearerIsJwt) {
    const { data: claims } = await supabase.auth.getClaims(bearer)
    const uid = claims?.claims?.sub as string | undefined
    if (uid && claims?.claims?.role === 'authenticated') {
      const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: uid })
      if (isAdmin !== true) return json({ error: 'only admins can upload app releases' }, 403)
      source = 'admin'
      adminId = uid
    }
  }

  if (!source) {
    // Slow down token guessing from one address.
    const ok = await withinRateLimit(supabase, `ip:${ip}`, 'release-upload-auth-fail', 10, 3600)
    return json({ error: ok ? 'unauthorized' : 'too many failed attempts, try again later' }, ok ? 401 : 429)
  }

  const limitKey = source === 'admin' ? `uid:${adminId}` : 'ci'
  if (!(await withinRateLimit(supabase, limitKey, 'release-upload', 10, 3600, true))) {
    return json({ error: 'upload limit reached (10 per hour), try again later' }, 429)
  }

  // --- Size: refuse before reading when declared, and cap while reading ----
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > BODY_CAP) return json({ error: 'file is larger than 100 MB' }, 413)
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return json({ error: 'send multipart/form-data' }, 415)
  }
  const raw = await readCapped(req, BODY_CAP)
  if (!raw) return json({ error: 'file is larger than 100 MB' }, 413)

  let form: FormData
  try {
    form = await new Request('http://local/upload', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: raw,
    }).formData()
  } catch {
    return json({ error: 'malformed upload' }, 400)
  }

  // --- Fields ---------------------------------------------------------------
  const file = form.get('file')
  const platform = String(form.get('platform') ?? '').toLowerCase() as ReleasePlatform
  const version = String(form.get('version') ?? '').trim()
  const changelog = String(form.get('changelog') ?? '').trim().slice(0, 5000) || null
  const notes = String(form.get('notes') ?? '').trim().slice(0, 2000) || null

  if (!(file instanceof File)) return json({ error: 'missing file' }, 400)
  if (platform !== 'android' && platform !== 'ios') return json({ error: 'platform must be android or ios' }, 400)
  if (!SEMVER_RE.test(version)) return json({ error: 'version must be semver (e.g. 1.2.3)' }, 400)
  if (file.size > RELEASE_MAX_BYTES) return json({ error: 'file is larger than 100 MB' }, 413)
  if (!extensionMatches(platform, file.name)) {
    return json({ error: `only .${platform === 'android' ? 'apk' : 'ipa'} files are accepted for ${platform}` }, 415)
  }

  // --- Contents: the client's name and Content-Type are not trusted ---------
  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = checkReleasePackage(platform, bytes)
  if (!check.ok) return json({ error: `rejected: ${check.reason}` }, 415)

  const { data: existing } = await supabase
    .from('app_releases')
    .select('id')
    .eq('platform', platform)
    .eq('version', version)
    .limit(1)
  if (existing?.length) return json({ error: `version ${version} for ${platform} already exists` }, 409)

  // --- Store under a server-chosen name; never overwrite --------------------
  const path = releaseStoragePath(platform, version, crypto.randomUUID())
  const up = await supabase.storage.from('app-releases').upload(path, bytes, {
    contentType: RELEASE_CONTENT_TYPE[platform],
    upsert: false,
  })
  if (up.error) {
    console.error('release storage upload failed', up.error.message)
    return json({ error: 'could not store the file' }, 500)
  }

  const ins = await supabase
    .from('app_releases')
    .insert({
      platform,
      version,
      changelog,
      notes,
      file_path: path,
      file_size: bytes.byteLength,
      file_sha256: await sha256Hex(bytes),
      uploaded_via: source,
      uploaded_by: adminId,
      is_active: source === 'admin',
    })
    .select()
    .single()
  if (ins.error) {
    await supabase.storage.from('app-releases').remove([path])
    console.error('release row insert failed', ins.error.message)
    return json({ error: 'could not save the release' }, 500)
  }

  return json({ ok: true, release: ins.data, needs_activation: source !== 'admin' })
})
