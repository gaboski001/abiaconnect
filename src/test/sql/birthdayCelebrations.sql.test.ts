// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  CREATE TABLE public.user_roles (user_id uuid, role text);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('Admin', 'Super Admin')) $$;
  CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), display_name text, username text,
    avatar_url text, dob date, is_banned boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false);
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text,
    message text, link text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.connect_follows (follower_id uuid NOT NULL, followed_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, followed_id));
`

const TODAY = `(now() AT TIME ZONE 'Africa/Lagos')::date`

describe('Birthday celebrations', () => {
  let db: PGlite
  const as = async <T,>(uid: string, fn: () => Promise<T>) => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid])
    await db.query('SET ROLE authenticated')
    try {
      return await fn()
    } finally {
      await db.query('RESET ROLE')
    }
  }
  const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const user = async (name: string, dob: string | null, extra = '') => {
    const { id } = (await one<{ id: string }>(`INSERT INTO auth.users VALUES (gen_random_uuid()) RETURNING id`))!
    await db.query(`INSERT INTO profiles (id, display_name, username, dob) VALUES ($1, $2, $3, ${dob ?? 'NULL'}) ${extra}`, [
      id,
      name,
      name.toLowerCase(),
    ])
    return id
  }
  const err = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      return ''
    } catch (e) {
      return (e as Error).message
    }
  }

  let gabby: string, ada: string, bayo: string, chi: string
  beforeEach(async () => {
    db = await PGlite.create()
    await db.exec(PRELUDE)
    // The main admin exists before the migration, like on the live site.
    gabby = await user('Gabby', null)
    await db.query(`INSERT INTO user_roles VALUES ($1, 'Super Admin')`, [gabby])
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261109160000_birthday_celebrations.sql'), 'utf8'))
    ada = await user('Ada', `(${TODAY} - interval '30 years')::date`)
    bayo = await user('Bayo', `(${TODAY} - interval '25 years' + interval '1 day')::date`)
    chi = await user('Chi', null)
  })

  it('new members follow @Gabby automatically', async () => {
    const rows = (await db.query<{ follower_id: string }>(`SELECT follower_id FROM connect_follows WHERE followed_id = $1`, [gabby])).rows
    expect(rows.map((r) => r.follower_id).sort()).toEqual([ada, bayo, chi].sort())
    expect(await one(`SELECT 1 FROM connect_follows WHERE follower_id = $1`, [gabby])).toBeUndefined()
  })

  it('lists today’s birthdays, never the member themself, and respects the privacy switch', async () => {
    const list = await as(chi, () => one<{ b: { id: string; name: string; wishes: number }[] }>(`SELECT birthdays_today() AS b`))
    expect(list!.b.map((x) => x.name)).toEqual(['Ada'])
    expect(JSON.stringify(list!.b)).not.toContain('dob')
    expect((await as(ada, () => one<{ b: unknown[] }>(`SELECT birthdays_today() AS b`)))!.b).toEqual([])

    await as(ada, () => db.query(`SELECT set_share_birthday(false)`))
    expect((await as(chi, () => one<{ b: unknown[] }>(`SELECT birthdays_today() AS b`)))!.b).toEqual([])
  })

  it('a wish is saved once, tells the birthday person, and shows on their card', async () => {
    const first = await as(chi, () => one<{ r: { already: boolean } }>(`SELECT send_birthday_wish($1, ' Happy birthday! ') AS r`, [ada]))
    expect(first!.r.already).toBe(false)
    const again = await as(chi, () => one<{ r: { already: boolean } }>(`SELECT send_birthday_wish($1, 'Again') AS r`, [ada]))
    expect(again!.r.already).toBe(true)

    const n = (await db.query<{ message: string }>(`SELECT message FROM notifications WHERE user_id = $1 AND type = 'birthday_wish'`, [ada])).rows
    expect(n).toHaveLength(1)
    expect(n[0].message).toContain('Chi sent you birthday wishes: “Happy birthday!”')

    const list = await as(bayo, () => one<{ b: { wishes: number; wished: boolean }[] }>(`SELECT birthdays_today() AS b`))
    expect(list!.b[0]).toMatchObject({ wishes: 1, wished: false })
    const mine = await as(ada, () => one<{ w: { name: string; message: string }[] }>(`SELECT my_birthday_wishes() AS w`))
    expect(mine!.w).toEqual([expect.objectContaining({ name: 'Chi', message: 'Happy birthday!', from_team: false })])
  })

  it('the team’s wish comes first and reaches members who turned sharing off', async () => {
    await as(ada, () => db.query(`SELECT set_share_birthday(false)`))
    expect(await err(() => as(chi, () => db.query(`SELECT send_birthday_wish($1, 'Hi')`, [ada])))).toContain('not_birthday')
    await as(gabby, () => db.query(`SELECT send_birthday_wish($1, 'Many happy returns from all of us')`, [ada]))
    const mine = await as(ada, () => one<{ w: { name: string; from_team: boolean }[] }>(`SELECT my_birthday_wishes() AS w`))
    expect(mine!.w[0]).toMatchObject({ name: 'The AbiaConnect team', from_team: true })
    const n = await one<{ message: string }>(`SELECT message FROM notifications WHERE user_id = $1 AND type = 'birthday_wish'`, [ada])
    expect(n!.message).toContain('The AbiaConnect team sent you birthday wishes')
  })

  it('refuses wishes on other days, to yourself, and empty or very long ones', async () => {
    expect(await err(() => as(chi, () => db.query(`SELECT send_birthday_wish($1, 'Hi')`, [bayo])))).toContain('not_birthday')
    expect(await err(() => as(ada, () => db.query(`SELECT send_birthday_wish($1, 'Hi')`, [ada])))).toContain('not_birthday')
    expect(await err(() => as(chi, () => db.query(`SELECT send_birthday_wish($1, '   ')`, [ada])))).toContain('bad_message')
    expect(await err(() => as(chi, () => db.query(`SELECT send_birthday_wish($1, $2)`, [ada, 'x'.repeat(281)])))).toContain('bad_message')
    expect(await err(() => as(chi, () => db.query(`SELECT * FROM birthday_wishes`)))).toContain('permission denied')
  })

  it('the daily greeting tells followers once and reminds admins once', async () => {
    await db.query(`INSERT INTO connect_follows (follower_id, followed_id) VALUES ($1, $2), ($3, $2)`, [chi, ada, bayo])
    await db.query(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'birthday', 'Happy birthday')`, [ada])
    // The job retries later in the morning: nobody is told twice.
    await db.query(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'birthday', 'Happy birthday')`, [ada])
    const friends = (await db.query<{ user_id: string; message: string }>(`SELECT user_id, message FROM notifications WHERE type = 'birthday_friend'`)).rows
    expect(friends.map((r) => r.user_id).sort()).toEqual([bayo, chi].sort())
    expect(friends[0].message).toBe('🎂 It’s Ada’s birthday today. Send them your wishes!'.replace(/’/g, "'"))
    const admins = (await db.query<{ user_id: string }>(`SELECT user_id FROM notifications WHERE type = 'birthday_admin'`)).rows
    expect(admins.map((r) => r.user_id)).toEqual([gabby])
  })

  it('followers are not told when the member keeps their birthday private', async () => {
    await db.query(`INSERT INTO connect_follows (follower_id, followed_id) VALUES ($1, $2)`, [chi, ada])
    await as(ada, () => db.query(`SELECT set_share_birthday(false)`))
    await db.query(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'birthday', 'Happy birthday')`, [ada])
    expect(await one(`SELECT 1 FROM notifications WHERE type = 'birthday_friend'`)).toBeUndefined()
  })
})
