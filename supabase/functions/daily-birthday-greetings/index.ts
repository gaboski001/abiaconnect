// Daily birthday greetings — runs at 07:00, 08:00 and 09:00 Africa/Lagos via pg_cron
// (later runs are retries: nobody is greeted or emailed twice in a day).
// For every profile whose `dob` matches today's month/day:
//   • Inserts a warm in-app notification (deduped per user per day).
//   • Enqueues a transactional birthday email (skipped if no email on file).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireScheduler } from "../_shared/cron-auth.ts";
import { sendAndLog } from "../_shared/transactional-email-templates/log-send.ts";

Deno.serve(async (req) => {
  const denied = await requireScheduler(req);
  if (denied) return denied;

  // Test mode: {"dry_run": true} proves the scheduler's request got in
  // (gateway + scheduler token) without sending any greeting.
  const body = await req.json().catch(() => ({}));
  if (body?.dry_run === true) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, sent: 0 }), {
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Use Africa/Lagos local date so birthdays fire on the user's calendar day.
    const todayLagos = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }),
    );
    const mm = String(todayLagos.getMonth() + 1).padStart(2, "0");
    const dd = String(todayLagos.getDate()).padStart(2, "0");
    const year = todayLagos.getFullYear();
    const startOfDay = new Date(todayLagos);
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    // Find birthday people. Filter in SQL via a computed mm-dd match.
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, username, dob")
      .not("dob", "is", null)
      .eq("is_banned", false)
      .eq("is_deleted", false);
    if (error) throw error;

    // Members born on 29 February are celebrated on 28 February in non-leap years.
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const celebrateLeapDay = !isLeap && mm === "02" && dd === "28";
    const todays = (profiles ?? []).filter((p: any) => {
      if (!p.dob) return false;
      const [, m, d] = String(p.dob).split("-");
      return (m === mm && d === dd) || (celebrateLeapDay && m === "02" && d === "29");
    });

    let notified = 0;
    let emailed = 0;

    for (const p of todays as Array<{
      id: string;
      email: string | null;
      display_name: string | null;
      username: string | null;
    }>) {
      const name = p.display_name || p.username || "friend";

      // 1. In-app dashboard notification — dedupe per user per day.
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", p.id)
        .eq("type", "birthday")
        .gte("created_at", startIso)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        const { error: nErr } = await supabase.from("notifications").insert({
          user_id: p.id,
          type: "birthday",
          message: `Happy birthday, ${name}! 🎉 The whole AbiaConnect family is celebrating you today — wishing you health, joy, and every blessing in the year ahead.`,
          link: "/",
        });
        if (!nErr) notified++;
      }

      // 2. Birthday email — skip if no email on file, or if an earlier run
      //    today already sent it (the job runs several times as a retry).
      let emailedToday = false;
      if (p.email) {
        const { data: prior } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("template_name", "birthday-greeting")
          .eq("recipient_email", p.email)
          .eq("status", "sent")
          .gte("created_at", startIso)
          .limit(1)
          .maybeSingle();
        emailedToday = !!prior;
      }
      if (p.email && !emailedToday) {
        try {
          const outcome = await sendAndLog(supabase as any, "birthday-greeting", p.email, {
            idempotencyKey: `birthday-${p.id}-${year}${mm}${dd}`,
            templateData: { name },
          });
          if (outcome === "sent") emailed++;
        } catch (e: any) {
          if (e?.status === 429) {
            await new Promise((r) => setTimeout(r, (e.retryAfterSeconds ?? 60) * 1000));
          }
          console.error("birthday email failed", { message: String(e?.message ?? e) });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, candidates: todays.length, notified, emailed }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("daily-birthday-greetings error", e);
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
