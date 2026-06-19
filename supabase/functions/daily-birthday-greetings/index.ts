// Daily birthday greetings — runs every day at 07:00 Africa/Lagos via pg_cron.
// For every profile whose `dob` matches today's month/day:
//   • Inserts a warm in-app notification (deduped per user per day).
//   • Enqueues a transactional birthday email (skipped if no email on file).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceRole } from "../_shared/service-auth.ts";

Deno.serve(async (req) => {
  const denied = await requireServiceRole(req);
  if (denied) return denied;

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

    const todays = (profiles ?? []).filter((p: any) => {
      if (!p.dob) return false;
      const [, m, d] = String(p.dob).split("-");
      return m === mm && d === dd;
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

      // 2. Transactional email — skip if no email on file.
      if (p.email) {
        const { error: eErr } = await supabase.functions.invoke(
          "send-transactional-email",
          {
            body: {
              templateName: "birthday-greeting",
              recipientEmail: p.email,
              idempotencyKey: `birthday-${p.id}-${year}${mm}${dd}`,
              templateData: { name },
            },
          },
        );
        if (!eErr) emailed++;
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
