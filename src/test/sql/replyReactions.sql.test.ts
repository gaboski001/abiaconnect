// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const R1 = '00000000-0000-0000-0000-0000000000e1'
const R2 = '00000000-0000-0000-0000-0000000000e2'
const fan = (n: number) => `00000000-0000-0000-0000-0000000000${(10 + n).toString()}`

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE TABLE public.reply_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reply_id uuid NOT NULL, user_id uuid NOT NULL,
    value smallint NOT NULL CHECK (value IN (-1, 1)), UNIQUE (reply_id, user_id, value)
  );
`
const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261024090000_reply_reactions.sql'), 'utf8')

describe('reply reactions', () => {
  it('counts each reaction per reply and treats old likes as Like', async () => {
    const db = new PGlite()
    await db.exec(PRELUDE)
    await db.exec(`INSERT INTO public.reply_votes (reply_id, user_id, value) VALUES ('${R1}', '${fan(1)}', 1)`)
    await db.exec(MIGRATION)
    await db.exec(`INSERT INTO public.reply_votes (reply_id, user_id, value, reaction) VALUES
      ('${R1}', '${fan(2)}', 1, 'haha'), ('${R1}', '${fan(3)}', 1, 'haha'),
      ('${R2}', '${fan(4)}', 1, 'clap'), ('${R2}', '${fan(5)}', -1, NULL)`)
    const rows = await db.query<{ reply_id: string; reaction: string; total: number }>(
      `SELECT reply_id, reaction, total::int FROM public.get_reply_reactions(ARRAY['${R1}', '${R2}']::uuid[]) ORDER BY reply_id, reaction`,
    )
    expect(rows.rows).toEqual([
      { reply_id: R1, reaction: 'haha', total: 2 },
      { reply_id: R1, reaction: 'like', total: 1 },
      { reply_id: R2, reaction: 'clap', total: 1 },
    ])
    await expect(db.exec(`INSERT INTO public.reply_votes (reply_id, user_id, value, reaction) VALUES ('${R2}', '${fan(6)}', 1, 'angry')`)).rejects.toThrow(/reaction_check/)
    await db.exec(MIGRATION)
  })
})
