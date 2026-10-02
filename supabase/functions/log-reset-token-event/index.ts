// Public endpoint that records password-reset link events.
// Always responds 204 so clients cannot enumerate emails or infer state.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientIp, withinRateLimit } from "../_shared/rate-limit.ts";

const ALLOWED = new Set(["verified", "invalid", "updated", "resent", "resend_failed"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { event, email } = await req.json().catch(() => ({}));
    if (!ALLOWED.has(event)) {
      return new Response(null, { status: 204, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = clientIp(req);
    // Public by design (used before sign-in), so cap rows per address to keep
    // the audit log from being flooded. Still answers 204 either way.
    if (!(await withinRateLimit(supabase, `ip:${ip}`, "reset-audit", 20, 3600))) {
      return new Response(null, { status: 204, headers: cors });
    }
    const ua = (req.headers.get("user-agent") || "").slice(0, 300);
    const emailHash = email && typeof email === "string"
      ? await sha256(email.trim().toLowerCase())
      : null;

    const { error } = await supabase.from("password_reset_audit").insert({
      event,
      email_hash: emailHash,
      ip,
      user_agent: ua,
    });

    if (error) console.error("audit insert failed", error.message);
  } catch (err) {
    console.error("log-reset-token-event error", (err as Error).message);
  }

  // Never leak details to the caller.
  return new Response(null, { status: 204, headers: cors });
});
