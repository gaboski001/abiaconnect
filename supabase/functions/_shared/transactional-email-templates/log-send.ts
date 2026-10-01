import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from './send-email.ts'

// Sends a registered template and records the outcome in email_send_log
// (same 'sent' / 'suppressed' / 'failed' rows the app kept before).
// Log failures are console-logged only; they never decide the send result.
export async function sendAndLog(
  supabase: SupabaseClient,
  templateName: string,
  to: string,
  options: { templateData?: Record<string, any>; idempotencyKey?: string },
): Promise<'sent' | 'suppressed'> {
  const writeLog = async (status: string, error_message?: string) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: to,
      status,
      ...(error_message ? { error_message } : {}),
    })
    if (error) console.error('email_send_log write failed', { code: error.code, message: error.message })
  }
  try {
    const result = await sendTemplateEmail(templateName, to, options)
    if (result.sent) {
      await writeLog('sent')
      return 'sent'
    }
    await writeLog('suppressed')
    return 'suppressed'
  } catch (e) {
    await writeLog('failed', (e instanceof Error ? e.message : String(e)).slice(0, 1000))
    throw e
  }
}
