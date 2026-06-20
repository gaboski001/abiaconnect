// Upload a built APK/IPA from CI. Auth via shared RELEASE_UPLOAD_TOKEN.
// POST multipart/form-data: file, platform (android|ios), version, changelog?
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-upload-token, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const expected = Deno.env.get('RELEASE_UPLOAD_TOKEN')
  const provided = req.headers.get('x-upload-token') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const platform = String(form.get('platform') ?? '').toLowerCase()
  const version = String(form.get('version') ?? '').trim()
  const changelog = (form.get('changelog') as string | null) || null

  if (!file || !version || !['android', 'ios'].includes(platform)) {
    return new Response(JSON.stringify({ error: 'missing file/platform/version' }), { status: 400, headers: { ...cors, 'content-type': 'application/json' } })
  }
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    return new Response(JSON.stringify({ error: 'version must be semver (e.g. 1.2.3)' }), { status: 400, headers: { ...cors, 'content-type': 'application/json' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const ext = platform === 'android' ? 'apk' : 'ipa'
  const path = `${platform}/abiaconnect-${version}-${Date.now()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const up = await supabase.storage.from('app-releases').upload(path, bytes, {
    contentType: platform === 'android' ? 'application/vnd.android.package-archive' : 'application/octet-stream',
    upsert: false,
  })
  if (up.error) {
    return new Response(JSON.stringify({ error: up.error.message }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }

  const ins = await supabase.from('app_releases').insert({
    platform, version, changelog, file_path: path, file_size: bytes.byteLength, is_active: true,
  }).select().single()
  if (ins.error) {
    return new Response(JSON.stringify({ error: ins.error.message }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true, release: ins.data }), {
    status: 200, headers: { ...cors, 'content-type': 'application/json' },
  })
})
