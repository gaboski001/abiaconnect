// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Live rooms' rules on the real migration. The harness has no forum, so add
// minimal copies of the forum tables and helpers the migration reads.
const EXTRAS = `
  ALTER TABLE auth.users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now() - interval '1 year';
  ALTER TABLE public.profiles ADD COLUMN dob date;
  CREATE TABLE public.member_stats (user_id uuid PRIMARY KEY, points integer NOT NULL DEFAULT 0);
  CREATE FUNCTION public.points_level(_points integer) RETURNS integer LANGUAGE sql IMMUTABLE AS
    $$ SELECT CASE WHEN _points >= 1500 THEN 5 WHEN _points >= 700 THEN 4 ELSE 1 END $$;
  CREATE TABLE public.subgroups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
    created_by uuid, is_active boolean NOT NULL DEFAULT true);
  CREATE TABLE public.group_champions (subgroup_id uuid NOT NULL, user_id uuid NOT NULL);
  CREATE TABLE public.threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid,
    is_deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.connect_follows (follower_id uuid NOT NULL, followed_id uuid NOT NULL);
  CREATE TABLE public.user_roles (user_id uuid NOT NULL, role text NOT NULL);
`

let db: Db

const live = (sql: string, params: unknown[] = []) => db.asRole('authenticated', () => db.query(sql, params))
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await live(sql, params)).rows[0] as T
const fails = async (sql: string, params: unknown[], message: RegExp) => {
  await expect(live(sql, params)).rejects.toThrow(message)
}
const settings = (sql: string) => db.query(`UPDATE public.live_settings SET ${sql}`)

/** A member who meets every hosting rule, with a busy group they own. */
async function host() {
  const id = await db.addUser()
  await db.query(`INSERT INTO public.member_stats VALUES ($1, 1600)`, [id])
  const { id: group } = await db.one<{ id: string }>(
    `INSERT INTO public.subgroups (name, created_by) VALUES ('Umuahia', $1) RETURNING id`,
    [id],
  )
  await db.query(`INSERT INTO public.threads (subgroup_id) VALUES ($1)`, [group])
  await db.query(`INSERT INTO public.live_testers (user_id) VALUES ($1)`, [id])
  return { id, group }
}

async function tester() {
  const id = await db.addUser()
  await db.query(`INSERT INTO public.live_testers (user_id) VALUES ($1)`, [id])
  return id
}

async function startRoom(hostId: string, group: string) {
  await db.as(hostId)
  return (await one<{ id: string }>(`SELECT public.live_start_room('Evening chat', $1, true) AS id`, [group])).id
}

const blocker = async (uid: string) => {
  await db.as(uid)
  return (await one<{ s: { host_blocker: string | null } }>(`SELECT public.live_status() AS s`)).s.host_blocker
}

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(EXTRAS)
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261108100000_live_rooms.sql'), 'utf8'))
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`
    DELETE FROM public.live_rooms; DELETE FROM public.live_testers; DELETE FROM public.live_host_bans;
    DELETE FROM public.live_host_blocks; DELETE FROM public.notifications;
  `)
  await settings(`enabled = true, testers_only = true, max_rooms_at_once = 2, room_minutes = 60, max_listeners = 50, monthly_minutes = 4500`)
})

describe('who can use Live', () => {
  it('stays hidden from everyone but admins while switched off', async () => {
    await settings('enabled = false')
    const member = await tester()
    const admin = await db.addUser({ admin: true })
    await db.as(member)
    expect((await one<{ s: { allowed: boolean } }>(`SELECT public.live_status() AS s`)).s.allowed).toBe(false)
    await db.as(admin)
    expect((await one<{ s: { allowed: boolean } }>(`SELECT public.live_status() AS s`)).s.allowed).toBe(true)
  })

  it('is for testers only until opened to everyone', async () => {
    const other = await db.addUser()
    const { id, group } = await host()
    const room = await startRoom(id, group)
    await db.as(other)
    await fails(`SELECT public.live_join_room($1)`, [room], /off/)
    await settings('testers_only = false')
    expect((await one<{ r: string }>(`SELECT public.live_join_room($1) AS r`, [room])).r).toBe('listener')
  })
})

describe('who can host', () => {
  it('lets a Level 5 member with an active group host', async () => {
    const { id } = await host()
    expect(await blocker(id)).toBeNull()
  })

  it('needs Level 5 or a paid plan', async () => {
    const { id } = await host()
    await db.query(`UPDATE public.member_stats SET points = 800 WHERE user_id = $1`, [id])
    expect(await blocker(id)).toBe('level_or_plan')
    await db.query(
      `INSERT INTO public.user_subscriptions (user_id, plan_id, status, starts_at, ends_at, source)
       SELECT $1, id, 'active', now() - interval '1 day', now() + interval '29 days', 'admin_grant' FROM public.subscription_plans WHERE code = 'premium_monthly'`,
      [id],
    )
    expect(await blocker(id)).toBeNull()
  })

  it('needs a group with a post in the last 14 days', async () => {
    const { id, group } = await host()
    await db.query(`UPDATE public.threads SET created_at = now() - interval '20 days' WHERE subgroup_id = $1`, [group])
    expect(await blocker(id)).toBe('active_group')
  })

  it('counts a group the member champions', async () => {
    const id = await tester()
    await db.query(`INSERT INTO public.member_stats VALUES ($1, 2000)`, [id])
    const { id: group } = await db.one<{ id: string }>(`INSERT INTO public.subgroups (name) VALUES ('Aba') RETURNING id`)
    await db.query(`INSERT INTO public.threads (subgroup_id) VALUES ($1)`, [group])
    await db.query(`INSERT INTO public.group_champions VALUES ($1, $2)`, [group, id])
    expect(await blocker(id)).toBeNull()
  })

  it('turns away new accounts, under-18s and stopped hosts', async () => {
    const a = await host()
    await db.query(`UPDATE auth.users SET created_at = now() - interval '5 days' WHERE id = $1`, [a.id])
    expect(await blocker(a.id)).toBe('too_new')
    const b = await host()
    await db.query(`UPDATE public.profiles SET dob = current_date - interval '16 years' WHERE id = $1`, [b.id])
    expect(await blocker(b.id)).toBe('under_18')
    const c = await host()
    await db.query(`INSERT INTO public.live_host_bans (user_id) VALUES ($1)`, [c.id])
    expect(await blocker(c.id)).toBe('stopped')
  })

  it('only starts a room in a group the host runs, after accepting the rules', async () => {
    const { id, group } = await host()
    const { id: other } = await db.one<{ id: string }>(`INSERT INTO public.subgroups (name) VALUES ('Ohafia') RETURNING id`)
    await db.as(id)
    await fails(`SELECT public.live_start_room('Chat', $1, true)`, [other], /pick_group/)
    await fails(`SELECT public.live_start_room('Chat', $1, false)`, [group], /accept_rules/)
    await fails(`SELECT public.live_start_room('Chat', NULL, true)`, [], /pick_group/)
  })
})

describe('free-plan limits', () => {
  it('caps rooms at once and one room per host', async () => {
    await settings('max_rooms_at_once = 1')
    const a = await host()
    const b = await host()
    await startRoom(a.id, a.group)
    await fails(`SELECT public.live_start_room('Again', $1, true)`, [a.group], /already_live/)
    await db.as(b.id)
    await fails(`SELECT public.live_start_room('Mine', $1, true)`, [b.group], /busy/)
  })

  it('stops new rooms once the month is used up', async () => {
    const a = await host()
    const room = await startRoom(a.id, a.group)
    await db.query(`UPDATE public.live_rooms SET participant_minutes = 4500, status = 'ended' WHERE id = $1`, [room])
    await db.as(a.id)
    await fails(`SELECT public.live_start_room('More', $1, true)`, [a.group], /month_used_up/)
  })

  it('ends a room when its time is up or the host has gone', async () => {
    const a = await host()
    const room = await startRoom(a.id, a.group)
    await db.query(`UPDATE public.live_rooms SET ends_at = now() - interval '1 minute' WHERE id = $1`, [room])
    await db.as(a.id)
    expect(await live(`SELECT * FROM public.live_rooms_now()`).then((r) => r.rows.length)).toBe(0)
    const r2 = await startRoom(a.id, a.group)
    await db.query(`UPDATE public.live_room_people SET last_seen = now() - interval '6 minutes' WHERE room_id = $1`, [r2])
    expect(await live(`SELECT * FROM public.live_rooms_now()`).then((r) => r.rows.length)).toBe(0)
    expect((await db.one<{ ended_reason: string }>(`SELECT ended_reason FROM public.live_rooms WHERE id = $1`, [r2])).ended_reason).toBe('host_left')
  })

  it('counts one minute per person per heartbeat, not per call', async () => {
    const a = await host()
    const room = await startRoom(a.id, a.group)
    await db.query(`UPDATE public.live_room_people SET last_seen = now() - interval '60 seconds' WHERE room_id = $1`, [room])
    await db.as(a.id)
    await live(`SELECT public.live_heartbeat($1)`, [room])
    await live(`SELECT public.live_heartbeat($1)`, [room])
    expect((await db.one<{ m: number }>(`SELECT participant_minutes AS m FROM public.live_rooms WHERE id = $1`, [room])).m).toBe(1)
  })

  it('turns people away when the room is full', async () => {
    await settings('max_listeners = 5')
    const a = await host()
    const room = await startRoom(a.id, a.group)
    for (let i = 0; i < 5; i++) {
      await db.as(await tester())
      await live(`SELECT public.live_join_room($1)`, [room])
    }
    await db.as(await tester())
    await fails(`SELECT public.live_join_room($1)`, [room], /full/)
  })
})

describe('host and moderator powers', () => {
  async function roomWithPeople() {
    const a = await host()
    const room = await startRoom(a.id, a.group)
    const ids: string[] = []
    for (let i = 0; i < 6; i++) {
      const id = await tester()
      await db.as(id)
      await live(`SELECT public.live_join_room($1)`, [room])
      ids.push(id)
    }
    await db.as(a.id)
    return { host: a.id, room, ids }
  }
  const setRole = (room: string, user: string, role: string) =>
    live(`SELECT public.live_set_role($1, $2, $3)`, [room, user, role])

  it('lets only the host name up to 2 moderators', async () => {
    const { room, ids } = await roomWithPeople()
    await setRole(room, ids[0], 'moderator')
    await setRole(room, ids[1], 'moderator')
    await fails(`SELECT public.live_set_role($1, $2, 'moderator')`, [room, ids[2]], /moderators_full/)
    await db.as(ids[0])
    await fails(`SELECT public.live_set_role($1, $2, 'moderator')`, [room, ids[3]], /not_allowed/)
    await fails(`SELECT public.live_set_role($1, $2, 'listener')`, [room, ids[1]], /not_allowed/)
  })

  it('lets a moderator invite up to 4 speakers on stage', async () => {
    const { room, ids } = await roomWithPeople()
    await setRole(room, ids[0], 'moderator')
    await db.as(ids[0])
    for (const id of ids.slice(1, 5)) await setRole(room, id, 'speaker')
    await fails(`SELECT public.live_set_role($1, $2, 'speaker')`, [room, ids[5]], /stage_full/)
  })

  it('keeps listeners from changing anyone', async () => {
    const { room, ids } = await roomWithPeople()
    await db.as(ids[0])
    await fails(`SELECT public.live_set_role($1, $2, 'speaker')`, [room, ids[1]], /not_allowed/)
    await fails(`SELECT public.live_end_room($1)`, [room], /not_allowed/)
  })

  it('removes someone, and the host can keep them out of later rooms', async () => {
    const { host: h, room, ids } = await roomWithPeople()
    await live(`SELECT public.live_remove_person($1, $2, true)`, [room, ids[0]])
    await db.as(ids[0])
    await fails(`SELECT public.live_join_room($1)`, [room], /removed/)
    await db.as(h)
    await live(`SELECT public.live_end_room($1)`, [room])
    const g = (await db.one<{ id: string }>(`SELECT subgroup_id AS id FROM public.live_rooms WHERE id = $1`, [room])).id
    const next = await startRoom(h, g)
    await db.as(ids[0])
    await fails(`SELECT public.live_join_room($1)`, [next], /removed/)
  })

  it('lets a moderator remove but not block', async () => {
    const { room, ids } = await roomWithPeople()
    await setRole(room, ids[0], 'moderator')
    await db.as(ids[0])
    await fails(`SELECT public.live_remove_person($1, $2, true)`, [room, ids[1]], /not_allowed/)
    await live(`SELECT public.live_remove_person($1, $2, false)`, [room, ids[1]])
  })

  it('lets an admin end any room', async () => {
    const { room } = await roomWithPeople()
    await db.as(await db.addUser({ admin: true }))
    await live(`SELECT public.live_end_room($1)`, [room])
    expect((await db.one<{ ended_reason: string }>(`SELECT ended_reason FROM public.live_rooms WHERE id = $1`, [room])).ended_reason).toBe('admin')
  })
})

describe('comments and reports', () => {
  it('takes comments only from people in the room, and not too fast', async () => {
    const a = await host()
    const room = await startRoom(a.id, a.group)
    const outsider = await tester()
    await db.as(outsider)
    await fails(`SELECT public.live_comment($1, 'Hi')`, [room], /not_in_room/)
    await live(`SELECT public.live_join_room($1)`, [room])
    await live(`SELECT public.live_comment($1, 'Hi')`, [room])
    await fails(`SELECT public.live_comment($1, 'Hi again')`, [room], /slow_down/)
  })

  it('alerts admins when a third member reports a room', async () => {
    const a = await host()
    const room = await startRoom(a.id, a.group)
    const admin = await db.addUser({ admin: true })
    await db.query(`INSERT INTO public.user_roles VALUES ($1, 'Admin')`, [admin])
    for (let i = 0; i < 3; i++) {
      await db.as(await tester())
      await live(`SELECT public.live_report($1, NULL, 'Rude')`, [room])
    }
    const n = await db.one<{ c: number }>(`SELECT count(*)::int AS c FROM public.notifications WHERE user_id = $1 AND type = 'live_report'`, [admin])
    expect(n.c).toBe(1)
  })
})

describe('follower alerts', () => {
  it('tells followers only once Live is open to everyone', async () => {
    const a = await host()
    const fan = await db.addUser()
    await db.query(`INSERT INTO public.connect_follows VALUES ($1, $2)`, [fan, a.id])
    const room = await startRoom(a.id, a.group)
    expect((await db.one<{ c: number }>(`SELECT count(*)::int AS c FROM public.notifications WHERE user_id = $1`, [fan])).c).toBe(0)
    await db.as(a.id)
    await live(`SELECT public.live_end_room($1)`, [room])
    await settings('testers_only = false')
    await startRoom(a.id, a.group)
    const n = await db.one<{ link: string }>(`SELECT link FROM public.notifications WHERE user_id = $1`, [fan])
    expect(n.link).toMatch(/^\/live\//)
  })
})
