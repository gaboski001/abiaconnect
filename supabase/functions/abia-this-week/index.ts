// "Abia this week": runs on weekday mornings via pg_cron and does nothing while
// the switch in Admin -> Email Settings is off. The database picks the members
// and records the send (abia_this_week_claim), so a second run finds nobody.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireScheduler } from "../_shared/cron-auth.ts";
import { sendAndLog } from "../_shared/transactional-email-templates/log-send.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const denied = await requireScheduler(req);
  if (denied) return denied;

  // Test mode: {"dry_run": true} proves the scheduler's request got in
  // without picking or emailing anybody.
  const body = await req.json().catch(() => ({}));
  if (body?.dry_run === true) return json({ ok: true, dry_run: true, emailed: 0 });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc("abia_this_week_claim", { _limit: 150 });
    if (error) throw error;
    const members = (data ?? []) as Array<{ user_id: string; email: string; name: string | null; token: string }>;
    if (!members.length) return json({ ok: true, candidates: 0, emailed: 0 });

    const { data: posts, error: postsError } = await supabase.rpc("abia_this_week_posts", { _limit: 5 });
    if (postsError) throw postsError;
    const { data: lgas } = await supabase.rpc("lga_of_the_month");
    const topLga = ((lgas ?? []) as Array<{ lga: string; score: number }>)[0];

    const day = new Date().toISOString().slice(0, 10);
    let emailed = 0;
    for (const m of members) {
      try {
        const outcome = await sendAndLog(supabase as any, "abia-this-week", m.email, {
          idempotencyKey: `abia-this-week-${m.user_id}-${day}`,
          templateData: {
            name: m.name ?? undefined,
            posts,
            // A small score isn't worth announcing, the same rule as the card in the app.
            lga: topLga && topLga.score >= 5 ? topLga.lga : undefined,
            unsubscribeUrl: `https://abiaconnect.com/unsubscribe?k=weekly&t=${m.token}`,
          },
        });
        if (outcome === "sent") emailed++;
      } catch (e: any) {
        if (e?.status === 429) {
          await new Promise((r) => setTimeout(r, Math.min(e.retryAfterSeconds ?? 60, 60) * 1000));
        }
        console.error("abia this week email failed", { message: String(e?.message ?? e) });
      }
    }

    return json({ ok: true, candidates: members.length, emailed });
  } catch (e) {
    console.error("abia-this-week error", e);
    return json({ ok: false, error: String((e as Error).message) }, 500);
  }
});
