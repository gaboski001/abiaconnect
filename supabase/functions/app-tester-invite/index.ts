// App tester invitation: a one-time email asking active members to test the
// Android app. Runs every hour via pg_cron and does nothing while the switch in
// Admin -> Email Settings is off. The database picks the members and records the
// send (app_tester_invite_claim); a failed send is put back to try again later.
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

    const { data, error } = await supabase.rpc("app_tester_invite_claim", { _limit: 100 });
    if (error) throw error;
    const members = (data ?? []) as Array<{ user_id: string; email: string; name: string | null; token: string }>;

    let emailed = 0;
    for (const m of members) {
      try {
        const outcome = await sendAndLog(supabase as any, "app-tester-invite", m.email, {
          idempotencyKey: `app-tester-invite-${m.user_id}`,
          templateData: {
            name: m.name ?? undefined,
            unsubscribeUrl: `https://abiaconnect.com/unsubscribe?k=tester&t=${m.token}`,
          },
        });
        if (outcome === "sent") emailed++;
      } catch (e: any) {
        await supabase.rpc("app_tester_invite_retry", { _user_id: m.user_id });
        if (e?.status === 429) {
          await new Promise((r) => setTimeout(r, Math.min(e.retryAfterSeconds ?? 60, 60) * 1000));
        }
        console.error("app tester invite email failed", { message: String(e?.message ?? e) });
      }
    }

    return json({ ok: true, candidates: members.length, emailed });
  } catch (e) {
    console.error("app-tester-invite error", e);
    return json({ ok: false, error: String((e as Error).message) }, 500);
  }
});
