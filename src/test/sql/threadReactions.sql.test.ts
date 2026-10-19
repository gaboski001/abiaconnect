// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const AUTHOR = '00000000-0000-0000-0000-0000000000a1'
const THREAD = '00000000-0000-0000-0000-0000000000f1'
const fan = (n: number) => `00000000-0000-0000-0000-0000000000${(10 + n).toString()}`

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE TABLE public.threads (id uuid PRIMARY KEY, author_id uuid, title text);
  CREATE TABLE public.thread_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL, user_id uuid NOT NULL,
    value smallint NOT NULL DEFAULT 1, UNIQUE (thread_id, user_id, value)
  );
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, message text, link text);
  INSERT INTO public.threads VALUES ('${THREAD}', '${AUTHOR}', 'Nnọọ, ndị Ohafia!');
`
const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261020180000_thread_reactions.sql'), 'utf8')

describe('thread reactions', () => {
  it('counts each reaction, treats old likes as Like, and tells the author how people reacted', async () => {
    const db = new PGlite()
    await db.exec(PRELUDE)
    // A like from before reactions existed.
    await db.exec(`INSERT INTO public.thread_votes (thread_id, user_id, value) VALUES ('${THREAD}', '${fan(1)}', 1)`)
    await db.exec(MIGRATION)
    await db.exec(`
      CREATE TRIGGER notify_on_thread_vote AFTER INSERT ON public.thread_votes
        FOR EACH ROW EXECUTE FUNCTION public.notify_thread_author_on_vote();
      INSERT INTO public.thread_votes (thread_id, user_id, value, reaction) VALUES
        ('${THREAD}', '${fan(2)}', 1, 'love'), ('${THREAD}', '${fan(3)}', 1, 'love'),
        ('${THREAD}', '${fan(4)}', 1, 'pray'), ('${THREAD}', '${fan(5)}', -1, NULL);
    `)
    const counts = await db.query<{ reaction: string; total: number }>(`SELECT reaction, total::int FROM public.get_thread_reactions('${THREAD}')`)
    expect(counts.rows).toEqual([
      { reaction: 'love', total: 2 },
      { reaction: 'like', total: 1 },
      { reaction: 'pray', total: 1 },
    ])
    const alerts = await db.query<{ message: string }>('SELECT message FROM public.notifications ORDER BY message')
    expect(alerts.rows.map((a) => a.message)).toEqual([
      'Someone loved ❤️ "Nnọọ, ndị Ohafia!"',
      'Someone loved ❤️ "Nnọọ, ndị Ohafia!"',
      'Someone sent prayers 🙏🏾 on "Nnọọ, ndị Ohafia!"',
    ])
    await expect(db.exec(`INSERT INTO public.thread_votes (thread_id, user_id, reaction) VALUES ('${THREAD}', '${fan(6)}', 'angry')`)).rejects.toThrow(/reaction_check/)
    // Safe to run again.
    await db.exec(MIGRATION)
  })
})
