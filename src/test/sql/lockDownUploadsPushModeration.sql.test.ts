// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// Stand-ins for the live objects this migration touches, mirroring their
// current (pre-fix) grants and policies.
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id) $$;

  CREATE TABLE public.client_rate_limits (client_key text NOT NULL, scope text NOT NULL, window_start timestamptz NOT NULL,
    count integer NOT NULL DEFAULT 1, PRIMARY KEY (client_key, scope, window_start));
  ALTER TABLE public.client_rate_limits ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.client_rate_limits FROM anon, authenticated;
  CREATE TABLE public.search_rate_limits (user_id uuid, scope text, window_start timestamptz, count int NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, scope, window_start));
  CREATE FUNCTION public.enforce_rate_limit(_scope text, _max int, _window_seconds int DEFAULT 60) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE v_count int; v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  BEGIN
    INSERT INTO search_rate_limits AS r (user_id, scope, window_start) VALUES (auth.uid(), _scope, v_window)
    ON CONFLICT (user_id, scope, window_start) DO UPDATE SET count = r.count + 1 RETURNING count INTO v_count;
    IF v_count > _max THEN RAISE EXCEPTION 'Rate limit exceeded' USING ERRCODE = 'P0001'; END IF;
  END $$;

  CREATE TABLE public.app_releases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), platform text NOT NULL, version text NOT NULL,
    file_path text NOT NULL, file_size bigint, notes text, changelog text, is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now());

  CREATE SCHEMA storage;
  GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean NOT NULL DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
  GRANT ALL ON storage.objects TO anon, authenticated, service_role;
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  INSERT INTO storage.buckets (id, public) VALUES ('app-releases', false), ('avatars', true);
  CREATE POLICY "admins upload app-releases" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));
  CREATE POLICY "admins update app-releases" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'app-releases' AND public.is_admin(auth.uid())) WITH CHECK (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));
  CREATE POLICY "admins read app-releases" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));
  CREATE POLICY "admins delete app-releases" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));

  CREATE TABLE public.moderation_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, surface text NOT NULL DEFAULT 'thread',
    allowed boolean NOT NULL, reason text, verdict text, actor text NOT NULL DEFAULT 'pre_check', review_note text,
    reviewed_by uuid, reviewed_at timestamptz, overridden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
  GRANT SELECT, UPDATE ON public.moderation_log TO authenticated;
  ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Admins can view all moderation logs" ON public.moderation_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
  CREATE POLICY "Admins can update moderation logs" ON public.moderation_log FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

  CREATE TABLE public.moderation_appeals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, surface text NOT NULL,
    original_content text NOT NULL, user_note text NOT NULL, status text NOT NULL DEFAULT 'pending',
    reviewed_by uuid, reviewed_at timestamptz, review_note text);
  GRANT SELECT, INSERT ON public.moderation_appeals TO authenticated;
  ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view their own appeals" ON public.moderation_appeals FOR SELECT TO authenticated USING (user_id = auth.uid());
  CREATE POLICY "Users can submit their own appeals" ON public.moderation_appeals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE FUNCTION public.submit_moderation_appeal(_surface text, _content text, _note text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE v_id uuid;
  BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    INSERT INTO moderation_appeals (user_id, surface, original_content, user_note) VALUES (auth.uid(), _surface, _content, _note) RETURNING id INTO v_id;
    RETURN v_id;
  END $$;

  CREATE TABLE public.reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid, reported_user_id uuid, thread_id uuid,
    reply_id uuid, reason text, status text NOT NULL DEFAULT 'pending', ai_note text, ai_reviewed_at timestamptz);
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
  ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
  CREATE POLICY "Reporter or admin read reports" ON public.reports FOR SELECT TO authenticated
    USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));
`

const MEMBER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const ADMIN = '33333333-3333-3333-3333-333333333333'

async function makeDb() {
  const db = await PGlite.create()
  await db.exec(PRELUDE)
  await db.query(`INSERT INTO auth.users VALUES ($1), ($2), ($3)`, [MEMBER, OTHER, ADMIN])
  await db.query(`INSERT INTO admins VALUES ($1)`, [ADMIN])
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261002120000_lock_down_uploads_push_moderation.sql'), 'utf8'))
  return db
}

const as = async <T,>(db: PGlite, uid: string | null, role: 'anon' | 'authenticated' | 'service_role', fn: () => Promise<T>) => {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  await db.query(`SET ROLE ${role}`)
  try {
    return await fn()
  } finally {
    await db.query('RESET ROLE')
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`)
  }
}

describe('Security lock-down: uploads, push limits, moderation records', () => {
  let db: PGlite
  beforeEach(async () => {
    db = await makeDb()
  })

  describe('edge-function rate limiter', () => {
    it('cannot be called by anonymous visitors or members', async () => {
      for (const [uid, role] of [[null, 'anon'], [MEMBER, 'authenticated']] as const) {
        await expect(
          as(db, uid, role, () => db.query(`SELECT public.consume_rate_limit('x', 'y', 5, 60)`)),
        ).rejects.toThrow(/permission denied/)
      }
    })

    it('allows up to the limit, then refuses, per key', async () => {
      const results: boolean[] = []
      await as(db, null, 'service_role', async () => {
        for (let i = 0; i < 4; i++) {
          const r = await db.query<{ ok: boolean }>(`SELECT public.consume_rate_limit('uid:a', 'push-call', 3, 600) AS ok`)
          results.push(r.rows[0].ok)
        }
        const other = await db.query<{ ok: boolean }>(`SELECT public.consume_rate_limit('uid:b', 'push-call', 3, 600) AS ok`)
        results.push(other.rows[0].ok)
      })
      expect(results).toEqual([true, true, true, false, true])
    })
  })

  describe('app release storage', () => {
    it('refuses direct browser uploads and overwrites, even from an admin', async () => {
      await expect(
        as(db, ADMIN, 'authenticated', () =>
          db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('app-releases', 'android/evil.apk')`),
        ),
      ).rejects.toThrow(/row-level security/)
      await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('app-releases', 'android/real.apk')`)
      const upd = await as(db, ADMIN, 'authenticated', () =>
        db.query(`UPDATE storage.objects SET name = 'android/replaced.apk' WHERE bucket_id = 'app-releases'`),
      )
      expect(upd.affectedRows).toBe(0)
      for (const [uid, role] of [[null, 'anon'], [MEMBER, 'authenticated']] as const) {
        await expect(
          as(db, uid, role, () => db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('app-releases', 'x.apk')`)),
        ).rejects.toThrow(/row-level security/)
      }
    })

    it('keeps admin read and delete working', async () => {
      await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('app-releases', 'android/real.apk')`)
      const read = await as(db, ADMIN, 'authenticated', () => db.query(`SELECT name FROM storage.objects`))
      expect(read.rows).toHaveLength(1)
      const memberRead = await as(db, MEMBER, 'authenticated', () => db.query(`SELECT name FROM storage.objects`))
      expect(memberRead.rows).toHaveLength(0)
      const del = await as(db, ADMIN, 'authenticated', () => db.query(`DELETE FROM storage.objects WHERE bucket_id = 'app-releases'`))
      expect(del.affectedRows).toBe(1)
    })

    it('sets a 100 MB limit and app-package types on the bucket only', async () => {
      const b = await db.query<{ id: string; public: boolean; file_size_limit: number; allowed_mime_types: string[] | null }>(
        `SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id`,
      )
      expect(b.rows[0]).toEqual({
        id: 'app-releases',
        public: false,
        file_size_limit: 104857600,
        allowed_mime_types: ['application/vnd.android.package-archive', 'application/octet-stream'],
      })
      expect(b.rows[1]).toMatchObject({ id: 'avatars', public: true, file_size_limit: null })
    })
  })

  describe('moderation history', () => {
    it('rejects moderation records written by anyone but the server', async () => {
      for (const [uid, role] of [[null, 'anon'], [MEMBER, 'authenticated'], [ADMIN, 'authenticated']] as const) {
        await expect(
          as(db, uid, role, () =>
            db.query(`INSERT INTO moderation_log (user_id, allowed, verdict, actor, reason) VALUES ($1, true, 'allow', 'ugo', 'Approved by Ugo')`, [OTHER]),
          ),
          `${role} ${uid}`,
        ).rejects.toThrow(/permission denied/)
      }
      await as(db, null, 'service_role', () =>
        db.query(`INSERT INTO moderation_log (user_id, allowed, verdict, actor) VALUES ($1, false, 'block', 'ugo')`, [MEMBER]),
      )
      expect((await db.query(`SELECT 1 FROM moderation_log`)).rows).toHaveLength(1)
    })

    it('lets admins record a review but never rewrite the decision or pose as another reviewer', async () => {
      const id = (await db.query<{ id: string }>(
        `INSERT INTO moderation_log (user_id, allowed, verdict, actor) VALUES ($1, false, 'block', 'ugo') RETURNING id`, [MEMBER],
      )).rows[0].id

      await expect(
        as(db, ADMIN, 'authenticated', () => db.query(`UPDATE moderation_log SET allowed = true, verdict = 'allow' WHERE id = $1`, [id])),
      ).rejects.toThrow(/permission denied/)

      await as(db, ADMIN, 'authenticated', () =>
        db.query(`UPDATE moderation_log SET overridden = true, review_note = 'False positive', reviewed_by = $2, reviewed_at = '2000-01-01' WHERE id = $1`, [id, OTHER]),
      )
      const row = (await db.query<{ overridden: boolean; reviewed_by: string; reviewed_at: string; verdict: string }>(
        `SELECT overridden, reviewed_by, reviewed_at::text, verdict FROM moderation_log WHERE id = $1`, [id],
      )).rows[0]
      expect(row.overridden).toBe(true)
      expect(row.verdict).toBe('block')
      expect(row.reviewed_by).toBe(ADMIN)
      expect(row.reviewed_at.startsWith('2000')).toBe(false)
    })

    it('stops members from reviewing or deleting moderation records', async () => {
      const id = (await db.query<{ id: string }>(
        `INSERT INTO moderation_log (user_id, allowed, verdict) VALUES ($1, false, 'block') RETURNING id`, [MEMBER],
      )).rows[0].id
      const upd = await as(db, MEMBER, 'authenticated', () => db.query(`UPDATE moderation_log SET overridden = true WHERE id = $1`, [id]))
      expect(upd.affectedRows).toBe(0)
      for (const [uid, role] of [[MEMBER, 'authenticated'], [ADMIN, 'authenticated'], [null, 'anon']] as const) {
        await expect(as(db, uid, role, () => db.query(`DELETE FROM moderation_log WHERE id = $1`, [id]))).rejects.toThrow(/permission denied/)
      }
      await expect(as(db, null, 'anon', () => db.query(`SELECT * FROM moderation_log`))).rejects.toThrow(/permission denied/)
    })
  })

  describe('appeals', () => {
    it('blocks direct inserts, including pre-approved appeals with a fake reviewer', async () => {
      await expect(
        as(db, MEMBER, 'authenticated', () =>
          db.query(
            `INSERT INTO moderation_appeals (user_id, surface, original_content, user_note, status, reviewed_by, review_note)
             VALUES ($1, 'thread', 'x', 'please', 'approved', $2, 'Approved by admin')`, [MEMBER, ADMIN],
          ),
        ),
      ).rejects.toThrow(/permission denied/)
      await expect(
        as(db, null, 'anon', () => db.query(`INSERT INTO moderation_appeals (user_id, surface, original_content, user_note) VALUES ($1, 't', 'x', 'yy')`, [MEMBER])),
      ).rejects.toThrow(/permission denied/)
    })

    it('still accepts appeals filed through the app, unreviewed', async () => {
      await as(db, MEMBER, 'authenticated', () => db.query(`SELECT public.submit_moderation_appeal('thread', 'my post', 'please review')`))
      const a = (await db.query<{ user_id: string; status: string; reviewed_by: string | null }>(`SELECT user_id, status, reviewed_by FROM moderation_appeals`)).rows
      expect(a).toEqual([{ user_id: MEMBER, status: 'pending', reviewed_by: null }])
    })
  })

  describe('reports', () => {
    const report = (uid: string, extra = '', vals = '') =>
      as(db, uid, 'authenticated', () =>
        db.query(`INSERT INTO reports (reporter_id, reported_user_id, reason${extra}) VALUES ($1, $2, 'spam'${vals})`, [uid, OTHER]),
      )

    it('accepts an honest report from a member', async () => {
      await report(MEMBER)
      expect((await db.query(`SELECT status FROM reports`)).rows).toEqual([{ status: 'pending' }])
    })

    it('rejects reports that arrive already resolved, AI-reviewed, impersonating Ugo or another member', async () => {
      await expect(report(MEMBER, ', status', ", 'resolved'")).rejects.toThrow(/row-level security/)
      await expect(report(MEMBER, ', ai_note', ", 'Ugo: confirmed breach'")).rejects.toThrow(/row-level security/)
      await expect(report(MEMBER, ', ai_reviewed_at', ', now()')).rejects.toThrow(/row-level security/)
      await expect(
        as(db, MEMBER, 'authenticated', () => db.query(`INSERT INTO reports (reporter_id, reported_user_id, reason) VALUES ($1, $1, 'Ugo: hate speech')`, [MEMBER])),
      ).rejects.toThrow(/row-level security/)
      await expect(
        as(db, MEMBER, 'authenticated', () => db.query(`INSERT INTO reports (reporter_id, reported_user_id, reason) VALUES ($1, $2, 'spam')`, [OTHER, ADMIN])),
      ).rejects.toThrow(/row-level security/)
      await expect(
        as(db, null, 'anon', () => db.query(`INSERT INTO reports (reported_user_id, reason) VALUES ($1, 'spam')`, [OTHER])),
      ).rejects.toThrow(/permission denied/)
    })

    it('caps how many reports one member can file per hour', async () => {
      for (let i = 0; i < 20; i++) await report(MEMBER)
      await expect(report(MEMBER)).rejects.toThrow(/Rate limit/)
      // The server (Ugo) is not limited.
      await db.query(`INSERT INTO reports (reported_user_id, reason) VALUES ($1, 'Ugo: possible breach')`, [OTHER])
    })
  })
})
