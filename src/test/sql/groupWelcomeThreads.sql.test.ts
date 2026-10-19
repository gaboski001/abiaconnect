// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PRELUDE = `
  CREATE TABLE public.user_roles (user_id uuid, role text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.newsdesk_settings (id boolean PRIMARY KEY, author_id uuid);
  CREATE TABLE public.subgroups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, kind text NOT NULL DEFAULT 'interest',
    lga text, is_private boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true
  );
  CREATE TABLE public.subgroup_topics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid, name text);
  CREATE TABLE public.threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid, topic_id uuid, user_id uuid, author_id uuid,
    title text NOT NULL, content text, tags text[] DEFAULT '{}', is_pinned boolean NOT NULL DEFAULT false,
    allow_replies boolean NOT NULL DEFAULT true, is_anonymous boolean NOT NULL DEFAULT false,
    is_deleted boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.polls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question text NOT NULL, created_by uuid,
    is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.poll_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL, text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`
const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261020090000_group_welcome_threads.sql'), 'utf8')
const ADMIN = '00000000-0000-0000-0000-00000000000a'

describe('group welcome threads', () => {
  it('posts one pinned welcome per public group, with its link, and two polls, once', async () => {
    const db = new PGlite()
    await db.exec(PRELUDE)
    await db.exec(`
      INSERT INTO public.user_roles VALUES ('${ADMIN}', 'Super Admin', now());
      INSERT INTO public.subgroups (name, kind, lga) VALUES ('Ohafia LGA', 'lga', 'Ohafia'), ('Aba North LGA', 'lga', 'Aba North');
      INSERT INTO public.subgroups (name, description) VALUES ('Tech & Startups', 'Builders from Abia.');
      INSERT INTO public.subgroups (name, is_private) VALUES ('Secret club', true);
      INSERT INTO public.subgroup_topics (subgroup_id, name) SELECT id, 'Introduce yourself' FROM public.subgroups;
    `)
    await db.exec(MIGRATION)
    await db.exec(MIGRATION)

    const threads = await db.query<{ name: string; title: string; content: string; is_pinned: boolean; topic_ok: boolean }>(`
      SELECT s.name, t.title, t.content, t.is_pinned,
             t.topic_id = (SELECT id FROM public.subgroup_topics st WHERE st.subgroup_id = s.id) AS topic_ok
        FROM public.threads t JOIN public.subgroups s ON s.id = t.subgroup_id ORDER BY s.name`)
    expect(threads.rows.map((r) => r.name)).toEqual(['Aba North LGA', 'Ohafia LGA', 'Tech & Startups'])
    expect(threads.rows.every((r) => r.is_pinned && r.topic_ok)).toBe(true)
    const ohafia = threads.rows.find((r) => r.name === 'Ohafia LGA')!
    expect(ohafia.title).toContain('Nnọọ, ndị Ohafia!')
    expect(ohafia.content).toContain('war dance')
    expect(ohafia.content).toMatch(/abiaconnect\.com\/subgroups\/[0-9a-f-]{36}/)
    expect(threads.rows.find((r) => r.name === 'Tech & Startups')!.content).toContain('Builders from Abia.')

    const polls = await db.query<{ question: string; options: number }>(`
      SELECT p.question, (SELECT count(*)::int FROM public.poll_options o WHERE o.poll_id = p.id) AS options
        FROM public.polls p ORDER BY p.created_at DESC`)
    expect(polls.rows).toHaveLength(2)
    expect(polls.rows[0].question).toContain('even better')
    expect(polls.rows.every((p) => p.options === 6)).toBe(true)
  })
})
