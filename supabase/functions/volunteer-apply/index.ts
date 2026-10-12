// Receives the volunteer application form (page /volunteer). Open to
// visitors and members. Saves the application, tells the admins, and emails
// the applicant a confirmation.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendAndLog } from '../_shared/transactional-email-templates/log-send.ts'
import { clientIp, withinRateLimit } from '../_shared/rate-limit.ts'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Friendly text for the database's validation errors.
const ERRORS: Record<string, string> = {
  name_invalid: 'Please enter your full name.',
  email_invalid: 'Please enter a valid email address.',
  role_invalid: 'Please choose the role you are applying for.',
  details_invalid: 'Please check your location and the time you can give.',
  text_invalid: 'Please write at least a few sentences about your motivation and your experience.',
  answers_invalid: 'Please check your answers and try again.',
  already_pending: 'You already have an application under review. We will email you as soon as it is decided.',
  too_many: 'You have applied several times recently. Please wait a while before applying again.',
}

const ROLE_NAMES: Record<string, string> = {
  moderator: 'Community Moderator',
  writer: 'Content Writer',
  social: 'Social Media Coordinator',
  developer: 'Developer',
  connector: 'Community Connector',
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Each application sends an email, so keep it to a few per hour per visitor.
  if (!(await withinRateLimit(supabase, `ip:${clientIp(req)}`, 'volunteer-apply', 5, 3600, true))) {
    return json({ error: 'Too many applications from this device. Please try again in an hour.' }, 429)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }
  // Hidden field that people never see or fill; automated spam does.
  if (typeof body?.website === 'string' && body.website.trim()) return json({ ok: true })

  // The member's account, when they are signed in (the public app key is not a member).
  let userId: string | null = null
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (token) {
    const { data } = await supabase.auth.getUser(token)
    userId = data?.user?.id ?? null
  }

  const answers = Array.isArray(body?.answers)
    ? body.answers.slice(0, 6).map((a: any) => ({ question: str(a?.question, 300), answer: str(a?.answer, 2000) }))
    : []

  const { data: id, error } = await supabase.rpc('volunteer_submit', {
    _full_name: str(body?.fullName, 200),
    _email: str(body?.email, 300),
    _phone: str(body?.phone, 60),
    _location: str(body?.location, 200),
    _lga: str(body?.lga, 100),
    _role: str(body?.role, 40),
    _hours_per_week: str(body?.hoursPerWeek, 60),
    _motivation: str(body?.motivation, 2500),
    _experience: str(body?.experience, 2500),
    _links: str(body?.links, 600),
    _answers: answers,
    _user: userId,
  })
  if (error) {
    const known = Object.keys(ERRORS).find((k) => (error.message ?? '').includes(k))
    if (known) return json({ error: ERRORS[known] }, 400)
    console.error('volunteer_submit failed', { code: error.code, message: error.message })
    return json({ error: 'We could not save your application. Please try again.' }, 500)
  }

  // The application is saved; a failed email must not look like a failed application.
  const email = str(body?.email, 300).trim().toLowerCase()
  let emailed = false
  try {
    const outcome = await sendAndLog(supabase, 'volunteer-received', email, {
      idempotencyKey: `volunteer-received-${id}`,
      templateData: { name: str(body?.fullName, 80).trim(), role: ROLE_NAMES[str(body?.role, 40)] },
    })
    emailed = outcome === 'sent'
  } catch (e) {
    console.error('volunteer confirmation email failed', { message: e instanceof Error ? e.message : String(e) })
  }

  return json({ ok: true, emailed })
})
