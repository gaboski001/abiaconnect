// Deletes chat attachments older than 48 hours from storage
// and clears the attachment fields from the messages table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: expired, error } = await supabase
    .from("messages")
    .select("id, attachment_path")
    .not("attachment_path", "is", null)
    .lte("attachment_expires_at", new Date().toISOString())
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const paths = (expired ?? []).map((m) => m.attachment_path).filter(Boolean) as string[];
  let removed = 0;

  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from("chat-attachments").remove(paths);
    if (rmErr) console.error("storage remove error", rmErr);

    const ids = expired!.map((m) => m.id);
    const { error: updErr } = await supabase
      .from("messages")
      .update({
        attachment_url: null,
        attachment_path: null,
        attachment_type: null,
        attachment_name: null,
        attachment_size: null,
        attachment_expires_at: null,
        content: "[attachment expired]",
      })
      .in("id", ids);
    if (updErr) console.error("update error", updErr);
    removed = paths.length;
  }

  return new Response(JSON.stringify({ removed }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
