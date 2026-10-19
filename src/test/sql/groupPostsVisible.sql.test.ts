// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  CREATE TABLE public.subgroups (id uuid PRIMARY KEY, is_private boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true);
  CREATE FUNCTION public.is_subgroup_member(_g uuid, _u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
  CREATE FUNCTION public.is_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
  CREATE TABLE public.threads (id uuid PRIMARY KEY, subgroup_id uuid, title text, topic_id uuid, private_author_id uuid);
  GRANT SELECT (id, subgroup_id, title) ON public.threads TO anon, authenticated;
  ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
  CREATE TABLE public.replies (id uuid PRIMARY KEY, thread_id uuid);
  GRANT SELECT ON public.replies TO anon, authenticated;
  ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
  INSERT INTO public.subgroups VALUES ('00000000-0000-0000-0000-000000000001', false, true), ('00000000-0000-0000-0000-000000000002', true, true);
  INSERT INTO public.threads VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Welcome to the LGA', NULL, NULL),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000002', 'Private group post', NULL, NULL),
    ('00000000-0000-0000-0000-0000000000a3', NULL, 'Forum post', NULL, NULL);
  INSERT INTO public.replies VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2');
`
const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261020120000_group_posts_visible.sql'), 'utf8')

describe('group posts are visible', () => {
  it('lets visitors read public group posts with their topic, but not private ones', async () => {
    const db = new PGlite()
    await db.exec(PRELUDE)
    await db.exec(MIGRATION)
    await db.exec('SET ROLE anon')
    const threads = await db.query<{ title: string }>('SELECT title, topic_id FROM public.threads ORDER BY title')
    expect(threads.rows.map((r) => r.title)).toEqual(['Forum post', 'Welcome to the LGA'])
    const replies = await db.query<{ id: string }>('SELECT id FROM public.replies')
    expect(replies.rows.map((r) => r.id)).toEqual(['00000000-0000-0000-0000-0000000000b1'])
    await expect(db.query('SELECT private_author_id FROM public.threads')).rejects.toThrow(/permission denied/)
  })
})
