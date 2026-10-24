// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const DESK = '00000000-0000-0000-0000-00000000000d'
const ADMIN = '00000000-0000-0000-0000-00000000000a'
const CHINEDU = '00000000-0000-0000-0000-0000000000c1'
const ADA = '00000000-0000-0000-0000-0000000000c2'
const LGA = '00000000-0000-0000-0000-000000000001'
const WELCOME = '00000000-0000-0000-0000-0000000000f1'

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, display_name text);
  CREATE TABLE public.user_roles (user_id uuid, role text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.newsdesk_settings (id boolean PRIMARY KEY, author_id uuid);
  CREATE FUNCTION public.is_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u) $$;
  CREATE TABLE public.subgroups (
    id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL DEFAULT 'interest', lga text,
    is_private boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true
  );
  CREATE TABLE public.subgroup_topics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid, name text);
  CREATE TABLE public.threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid, topic_id uuid, user_id uuid, title text NOT NULL,
    content text, tags text[] DEFAULT '{}', is_anonymous boolean NOT NULL DEFAULT false,
    is_deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL, user_id uuid, parent_reply_id uuid,
    content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, type text NOT NULL, message text, link text);
  INSERT INTO public.profiles VALUES ('${CHINEDU}', 'Onyejiuba Chinedu Emmanuel'), ('${ADA}', 'Nwosu Ada');
  INSERT INTO public.newsdesk_settings VALUES (true, '${DESK}');
  INSERT INTO public.user_roles (user_id, role) VALUES ('${ADMIN}', 'Super Admin');
  INSERT INTO public.subgroups (id, name, kind, lga) VALUES ('${LGA}', 'Aba North LGA', 'lga', 'Aba North');
  INSERT INTO public.threads (id, subgroup_id, user_id, title, tags) VALUES ('${WELCOME}', '${LGA}', '${ADMIN}', 'Nnọọ, ndị Aba North!', ARRAY['welcome']);
`
const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261020150000_desk_welcomes.sql'), 'utf8')
const NAMES = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261024120000_desk_welcome_names.sql'), 'utf8')

async function deskReplies(db: PGlite) {
  const r = await db.query<{ content: string; parent_reply_id: string | null }>(
    `SELECT content, parent_reply_id FROM public.replies WHERE user_id = '${DESK}' ORDER BY created_at`,
  )
  return r.rows
}

describe('desk welcomes', () => {
  it('welcomes earlier introductions once, then each new one, by name with both links', async () => {
    const db = new PGlite()
    await db.exec(PRELUDE)
    // Chinedu introduced himself before the update.
    await db.exec(`INSERT INTO public.replies (thread_id, user_id, content) VALUES ('${WELCOME}', '${CHINEDU}',
      'Hello everyone, my name is chinedu. I live in aba and I''m into tailoring')`)
    await db.exec(MIGRATION)
    // The first version greeted him by his surname; the names update fixes that.
    expect((await deskReplies(db))[0].content).toContain('<strong>Onyejiuba</strong>')
    await db.exec(NAMES)

    let desk = await deskReplies(db)
    expect(desk).toHaveLength(1)
    expect(desk[0].parent_reply_id).not.toBeNull()
    expect(desk[0].content).toContain('<strong>Chinedu</strong>')
    expect(desk[0].content).not.toContain('Onyejiuba')
    expect(desk[0].content).toContain('Aba North LGA')
    expect(desk[0].content).toContain(`https://abiaconnect.com/subgroups/${LGA}`)
    expect(desk[0].content).toContain('https://abiaconnect.com"')

    // Chinedu again, and the admin greeting him: no more welcomes.
    await db.exec(`INSERT INTO public.replies (thread_id, user_id, content) VALUES ('${WELCOME}', '${CHINEDU}', 'Thank you!')`)
    await db.exec(`INSERT INTO public.replies (thread_id, user_id, content) VALUES ('${WELCOME}', '${ADMIN}', 'Nnọọ Chinedu!')`)
    expect(await deskReplies(db)).toHaveLength(1)

    // Ada starts her own introduction post in the group.
    await db.exec(`INSERT INTO public.threads (subgroup_id, user_id, title, content) VALUES ('${LGA}', '${ADA}', 'Hi everyone', 'I am from Aba')`)
    desk = await deskReplies(db)
    expect(desk).toHaveLength(2)
    // "I am from Aba" gives no name, so the whole display name is used.
    expect(desk[1].content).toContain('<strong>Nwosu Ada</strong>')

    const alerts = await db.query<{ user_id: string }>('SELECT user_id FROM public.notifications ORDER BY user_id')
    expect(alerts.rows.map((a) => a.user_id)).toEqual([CHINEDU, ADA].sort())

    // Running the updates again changes nothing.
    await db.exec(MIGRATION)
    await db.exec(NAMES)
    expect(await deskReplies(db)).toHaveLength(2)
  })

  it('finds the name a member gives, and ignores phrases that are not names', async () => {
    const db = new PGlite()
    await db.exec(PRELUDE)
    await db.exec(MIGRATION)
    await db.exec(NAMES)
    const name = async (text: string) =>
      (await db.query<{ n: string }>('SELECT public.intro_first_name($1, $2) AS n', [text, 'Okafor Emeka'])).rows[0].n
    expect(await name('<p>Hello everyone, my name is chinedu. I live in aba</p>')).toBe('Chinedu')
    expect(await name("Hi all, I'm Ngozi from Umuahia")).toBe('Ngozi')
    expect(await name('I am into tailoring')).toBe('Okafor Emeka')
    expect(await name('Hello everyone!')).toBe('Okafor Emeka')
  })

  it('leaves ordinary group posts alone', async () => {
    const db = new PGlite()
    await db.exec(PRELUDE)
    await db.exec(MIGRATION)
    await db.exec(NAMES)
    await db.exec(`INSERT INTO public.threads (subgroup_id, user_id, title, content) VALUES ('${LGA}', '${ADA}', 'Road repairs on Faulks Road', 'When will it be fixed?')`)
    expect(await deskReplies(db)).toHaveLength(0)
  })
})
