import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2, Lock, Mail, MailCheck, MapPin, User } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { SEO } from '@/components/SEO'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { makeUsername } from '@/lib/username'
import { trackEvent } from '@/lib/metaPixel'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { AuthField, AuthSubmit, NativeAuthLayout, isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { WebAuthLayout } from '@/components/web/WebAuthLayout'

const ABIA_LGAS = [
  'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano',
  'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia',
  'Osisioma Ngwa', 'Ugwunagbo', 'Ukwa East', 'Ukwa West',
  'Umuahia North', 'Umuahia South', 'Umunneochi',
] as const

const POOL_A = ['Ikeja', 'Badagry', 'Epe', 'Ikorodu', 'Mushin']
const POOL_B = ['Dala', 'Fagge', 'Gwale', 'Kumbotso', 'Tarauni']
const POOL_C = ['Port Harcourt', 'Obio-Akpor', 'Okrika', 'Eleme', 'Oyigbo']

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)

function makeQuiz() {
  const correct = pick(ABIA_LGAS)
  const options = shuffle([correct, pick(POOL_A), pick(POOL_B), pick(POOL_C)])
  return { correct, options }
}

// Joining asks only what's needed to sign in. The username is made from the name, and
// LGA and birthday are asked after joining (welcome steps and the birthday prompt).
const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  email: z.string().trim().email('Enter a valid email address').max(255),
  password: z.string().min(8, 'Use at least 8 characters').max(72),
})

type FormValues = z.infer<typeof schema>

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-3">
          <span
            className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              n <= step
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {n}
          </span>
          {n < 3 && <span className={`h-0.5 w-8 ${n < step ? 'bg-primary' : 'bg-muted'}`} />}
        </div>
      ))}
    </div>
  )
}

const NATIVE_STEP_LABELS = ['Your details', 'Verify roots', 'Confirm email'] as const

function NativeSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? 'bg-amber-300' : 'bg-white/12'}`} />
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/90">
        Step {step} of 3 · {NATIVE_STEP_LABELS[step - 1]}
      </p>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [direction, setDirection] = useState(1)
  const [quiz, setQuiz] = useState(makeQuiz)
  const [done, setDone] = useState(false)
  const [existingEmail, setExistingEmail] = useState<string | null>(null)
  const [existingVerified, setExistingVerified] = useState<boolean | null>(null)
  const [resending, setResending] = useState(false)
  const [takenEmail, setTakenEmail] = useState<string | null>(null)

  /** Explains (pop-up plus a note under the email box) why sign-up stopped. */
  function showExisting(email: string, verified: boolean | null) {
    setExistingVerified(verified)
    setExistingEmail(email)
    setTakenEmail(email.trim().toLowerCase())
  }

  async function resendVerification(email: string) {
    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: 'https://abiaconnect.com/' },
      })
      if (error) toast.error(error.message)
      else toast.success('Verification email sent. Please check your inbox.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not resend email')
    } finally {
      setResending(false)
    }
  }

  async function checkEmailExists(email: string) {
    const value = email.trim().toLowerCase()
    if (!value || !/^\S+@\S+\.\S+$/.test(value)) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('email_registration_status', { _email: value })
      const row = Array.isArray(data) ? data[0] : data
      if (!error && row?.is_registered === true) {
        showExisting(value, row.is_verified === true)
      }
    } catch {
      // silent — non-blocking pre-check
    }
  }


  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', email: '', password: '',
    },
    mode: 'onBlur',
  })

  const goTo = (n: 1 | 2 | 3) => {
    setDirection(n > step ? 1 : -1)
    setStep(n)
  }

  const onStep1 = form.handleSubmit(() => goTo(2))

  const onQuizAnswer = (option: string) => {
    if (option === quiz.correct) {
      goTo(3)
      void createAccount()
    } else {
      toast.error('Incorrect! Try again.')
      setQuiz(makeQuiz())
    }
  }

  async function createAccount() {
    const v = form.getValues()
    // Final server-side duplicate-email check — guards against skipped/racing onBlur.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase.rpc as any)('email_registration_status', {
        _email: v.email.trim().toLowerCase(),
      })
      const row = Array.isArray(data) ? data[0] : data
      if (!rpcErr && row?.is_registered === true) {
        showExisting(v.email, row.is_verified === true)
        goTo(1)
        return
      }
    } catch {
      // non-blocking — fall through to signUp which still catches duplicates
    }
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: 'https://abiaconnect.com/',
        data: {
          display_name: v.name,
          username: makeUsername(v.name),
        },
      },
    })
    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        msg.includes('user with this email')
      ) {
        showExisting(v.email, null)
      } else {
        toast.error(error.message)
      }
      goTo(1)
      return
    }
    // Supabase obfuscates "already registered" by returning a user with an
    // empty identities array (and no session). Detect that and guide the user.
    const identities = data?.user?.identities ?? []
    if (data?.user && identities.length === 0) {
      showExisting(v.email, null)
      goTo(1)
      return
    }
    // Lets AbiaConnect's ads learn who joins (only for visitors who agreed to the pixel).
    trackEvent('CompleteRegistration')
    setDone(true)
  }


  const variants = useMemo(
    () => ({
      enter: (d: number) => ({ x: d * 40, opacity: 0 }),
      center: { x: 0, opacity: 1 },
      exit: (d: number) => ({ x: d * -40, opacity: 0 }),
    }),
    [],
  )

  const errors = form.formState.errors
  // Stays under the email box after the pop-up closes, until they change the email.
  const emailError =
    errors.email?.message ??
    (takenEmail && form.watch('email').trim().toLowerCase() === takenEmail
      ? 'This email already has an AbiaConnect account. Sign in instead, or use a different email.'
      : undefined)
  const nativeCopy = {
    1: {
      title: 'Create your account',
      subtitle: 'Join the trusted digital home for Abians worldwide. It only takes a minute.',
    },
    2: {
      title: 'Confirm your Abia roots',
      subtitle: 'Which of these is a Local Government Area in Abia State?',
    },
    3: done
      ? { title: 'Check your inbox', subtitle: 'One last step to activate your account.' }
      : { title: 'Setting up your account', subtitle: 'This will only take a moment.' },
  }[step]

  const existingDialog = (
    <Dialog open={!!existingEmail} onOpenChange={(o) => { if (!o) { setExistingEmail(null); setExistingVerified(null) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" />
          </div>
          <DialogTitle className="text-center">
            {existingVerified === false
              ? 'Email registered but not verified'
              : 'This email is already registered'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {existingVerified === true && (
              <>An account with <span className="font-medium text-foreground">{existingEmail}</span> is already verified. Sign in to continue.</>
            )}
            {existingVerified === false && (
              <>We found an account for <span className="font-medium text-foreground">{existingEmail}</span>, but the email hasn't been verified yet. Resend the verification email to activate it.</>
            )}
            {existingVerified === null && (
              <>An account with <span className="font-medium text-foreground">{existingEmail}</span> already exists. Sign in to continue, or resend the verification email if you haven't confirmed it yet.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {existingVerified === false ? (
            <>
              <Button
                className="w-full"
                disabled={resending}
                onClick={() => existingEmail && resendVerification(existingEmail)}
              >
                {resending ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" />Resending…</>
                ) : (
                  'Resend verification email'
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const email = existingEmail
                  setExistingEmail(null); setExistingVerified(null)
                  navigate(`/login${email ? `?email=${encodeURIComponent(email)}` : ''}`)
                }}
              >
                Sign in instead
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full"
                onClick={() => {
                  const email = existingEmail
                  setExistingEmail(null); setExistingVerified(null)
                  navigate(`/login${email ? `?email=${encodeURIComponent(email)}` : ''}`)
                }}
              >
                Sign in instead
              </Button>
              {existingVerified === null && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={resending}
                  onClick={() => existingEmail && resendVerification(existingEmail)}
                >
                  {resending ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" />Resending…</>
                  ) : (
                    'Resend verification email'
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const stepContent = (
    <>
      <AnimatePresence mode="wait" custom={direction}>
        {step === 1 && (
          <motion.div key="s1" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <form onSubmit={onStep1} className="space-y-5">
              <AuthField label="Full name" icon={User} autoComplete="name" placeholder="e.g. Chidi Okafor" error={errors.name?.message} {...form.register('name')} />
              <AuthField
                label="Email address"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                error={emailError}
                {...form.register('email', { onBlur: (e) => checkEmailExists(e.target.value) })}
              />
              <AuthField
                label="Password"
                icon={Lock}
                type="password"
                autoComplete="new-password"
                placeholder="Create a password"
                hint="At least 8 characters."
                error={errors.password?.message}
                {...form.register('password')}
              />
              <p className="pt-1 text-[13px] leading-5 text-slate-400">
                By continuing, you agree to our{' '}
                <Link to="/terms-of-service" className="font-medium text-slate-200 underline underline-offset-2">Terms of Service</Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="font-medium text-slate-200 underline underline-offset-2">Privacy Policy</Link>, and
                confirm you are 13 or older.
              </p>
              <AuthSubmit>Continue</AuthSubmit>
            </form>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <div className="space-y-3" role="list">
              {quiz.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="listitem"
                  onClick={() => onQuizAnswer(opt)}
                  className="flex h-14 w-full items-center gap-3 rounded-xl border border-white/12 bg-white/[0.04] px-4 text-left text-[15px] font-semibold text-white transition-colors active:border-amber-300/70 active:bg-amber-300/10"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white/[0.06]">
                    <MapPin className="size-4 text-amber-300" />
                  </span>
                  {opt}
                </button>
              ))}
            </div>
            <p className="mt-5 text-[13px] leading-5 text-slate-400">
              This quick check keeps AbiaConnect a trusted space for our community.
            </p>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="s3" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            {!done ? (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="size-10 animate-spin text-amber-300" />
                <p className="mt-4 text-[15px] text-slate-300">Creating your account…</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                    <MailCheck className="size-5 text-emerald-300" />
                  </span>
                  <p className="text-[15px] leading-6 text-slate-300">
                    We sent a verification link to{' '}
                    <span className="font-semibold text-white">{form.getValues('email')}</span>. Open it to activate your
                    account, then sign in. Check your spam folder if you can’t find it.
                  </p>
                </div>
                <AuthSubmit type="button" onClick={() => navigate('/login')}>Go to sign in</AuthSubmit>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {existingDialog}

    </>
  )

  if (isNativeApp()) {
    return (
      <>
        <SEO title="Create your AbiaConnect account" description="Join AbiaConnect." path="/register" />
        <NativeAuthLayout
          title={nativeCopy.title}
          subtitle={nativeCopy.subtitle}
          siteName={settings.site_name || 'AbiaConnect'}
          eyebrow={<NativeSteps step={step} />}
          onBack={step === 2 ? () => goTo(1) : undefined}
          backTo={step === 3 && done ? '/login' : undefined}
          footer={
            step === 1 ? (
              <>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-amber-300">Sign in</Link>
              </>
            ) : undefined
          }
        >
          {stepContent}
        </NativeAuthLayout>
      </>
    )
  }

  return (
    <>
      <SEO title="Create your AbiaConnect account" description="Join AbiaConnect — the community forum connecting Abians worldwide. Register in seconds." path="/register" />
    <WebAuthLayout title="Join AbiaConnect" subtitle="Free, and it only takes a minute.">
      <div className="overflow-hidden">
        <StepDots step={step} />

        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="s1"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-xl font-semibold mb-1 text-center">Your details</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Tell us a bit about yourself.
              </p>
              <form onSubmit={onStep1} className="space-y-4">
                <Field label="Full Name" error={form.formState.errors.name?.message}>
                  <Input {...form.register('name')} />
                </Field>
                <Field label="Email" error={emailError}>
                  <Input type="email" {...form.register('email', { onBlur: (e) => checkEmailExists(e.target.value) })} />
                </Field>
                <Field label="Password" error={form.formState.errors.password?.message}>
                  <PasswordInput autoComplete="new-password" {...form.register('password')} />
                </Field>
                <p className="text-xs text-muted-foreground">
                  By continuing, you agree to our{' '}
                  <Link to="/terms-of-service" className="font-medium underline underline-offset-2">Terms of Service</Link> and{' '}
                  <Link to="/privacy-policy" className="font-medium underline underline-offset-2">Privacy Policy</Link>, and confirm
                  you are 13 or older.
                </p>
                <Button type="submit" className="w-full">Continue to Verification →</Button>
                <p className="text-sm text-center text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
                </p>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="s2"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-xl font-semibold mb-1 text-center">Confirm your Abia roots</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Select the Local Government Area that belongs to Abia State.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {quiz.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onQuizAnswer(opt)}
                    className="rounded-xl border border-border bg-background p-4 text-left font-medium hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-6" onClick={() => goTo(1)}>
                ← Back
              </Button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="s3"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="text-center py-6"
            >
              {!done ? (
                <>
                  <Loader2 className="size-10 mx-auto animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">Creating your account…</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-14 mx-auto text-primary mb-4" />
                  <h2 className="text-xl font-bold mb-2">You're all set!</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Check your email to verify your account, then sign in.
                  </p>
                  <Button className="w-full" onClick={() => navigate('/login')}>
                    Go to Sign In
                  </Button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {existingDialog}
    </WebAuthLayout>
    </>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
