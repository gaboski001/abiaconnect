// Authenticates scheduled jobs (pg_cron) calling edge functions.
// Accepts the scheduler token kept in Vault ('abia_cron_token', sent as the
// x-cron-token header) or, as before, a service-role JWT. The token does not
// depend on the email system, so birthday greetings and Ugo keep running
// whatever happens to email infrastructure.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireServiceRole } from './service-auth.ts'

export async function requireScheduler(req: Request): Promise<Response | null> {
  const token = req.headers.get('x-cron-token')
  if (token && token.length >= 32) {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data } = await db.rpc('verify_cron_token', { _token: token })
    if (data === true) return null
  }
  return await requireServiceRole(req)
}
