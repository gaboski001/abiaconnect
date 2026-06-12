// Weekly subgroup digest — runs every Monday at 08:00 via pg_cron.
// For each subgroup with members, inserts a single in-app notification per member
// summarising new threads, the most-reacted thread, and new members joined in the last 7 days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    let total = 0;

    const { data: subgroups, error: sgErr } = await supabase
      .from("subgroups")
      .select("id, name")
      .eq("is_active", true);
    if (sgErr) throw sgErr;

    for (const sg of subgroups ?? []) {
      const [{ data: threads }, { data: newMembers }, { data: members }] = await Promise.all([
        supabase
          .from("threads")
          .select("id, title, upvotes")
          .eq("subgroup_id", sg.id)
          .gte("created_at", since)
          .order("upvotes", { ascending: false }),
        supabase
          .from("subgroup_members")
          .select("user_id", { count: "exact", head: false })
          .eq("subgroup_id", sg.id)
          .gte("created_at", since),
        supabase
          .from("subgroup_members")
          .select("user_id")
          .eq("subgroup_id", sg.id),
      ]);

      const newThreads = threads?.length ?? 0;
      const newMemberCount = newMembers?.length ?? 0;
      if (newThreads === 0 && newMemberCount === 0) continue;

      const top = threads?.[0];
      const parts: string[] = [];
      parts.push(`${sg.name} weekly: ${newThreads} new thread${newThreads === 1 ? "" : "s"}`);
      if (top) parts.push(`top: "${top.title.slice(0, 60)}" (${top.upvotes ?? 0} 👍)`);
      if (newMemberCount > 0) parts.push(`${newMemberCount} new member${newMemberCount === 1 ? "" : "s"}`);
      const message = parts.join(" • ");
      const link = `/subgroups/${sg.id}`;

      const rows = (members ?? []).map((m: any) => ({
        user_id: m.user_id,
        type: "digest",
        message,
        link,
      }));
      if (!rows.length) continue;

      // Chunked insert to stay within request size limits
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("notifications").insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      total += rows.length;
    }

    return new Response(JSON.stringify({ ok: true, notifications: total }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-subgroup-digest error", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
