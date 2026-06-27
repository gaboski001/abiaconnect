import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SEO } from '@/components/SEO'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import PremiumAuthShell from '@/components/mobile/PremiumAuthShell'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND } from '@/lib/mobileBrand'

const ABIA_LGAS = [
  'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano',
  'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia',
  'Osisioma Ngwa', 'Ugwunagbo', 'Ukwa East', 'Ukwa West',
  'Umuahia North', 'Umuahia South', 'Umunneochi',
] as const

const LGA_OPTIONS = [...ABIA_LGAS, 'Non-Indigene (Preferred LGA)'] as const
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

const schema = z.object({
  name: z.string().trim().min(2, 'Full name is required').max(100),
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(30)
    .regex(/^[A-Za-z0-9_]+$/, 'Letters, numbers, and underscores only'),
  email: z.string().trim().email('Invalid email').max(255),
  password: z.string().min(8, 'At least 8 characters').max(72),
  confirmPassword: z.string().min(8, 'At least 8 characters').max(72),
  dob: z.string().min(1, 'Date of birth is required'),
  lga: z.enum(LGA_OPTIONS, { message: 'Select your LGA' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormValues = z.infer<typeof schema>

function passwordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score <= 1) return { label: 'Needs work', tone: 'bg-rose-400', width: '25%' }
  if (score === 2) return { label: 'Fair', tone: 'bg-amber-400', width: '50%' }
  if (score === 3) return { label: 'Strong', tone: 'bg-emerald-400', width: '75%' }
  return { label: 'Excellent', tone: 'bg-emerald-500', width: '100%' }
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center">
          <motion.div
            animate={{
              scale: n === step ? 1.08 : 1,
              background: n <= step ? GOLD_GRADIENT : 'rgba(255,255,255,0.08)',
              color: n <= step ? MOBILE_BRAND.ink : 'rgba(226,232,240,0.72)',
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black shadow-lg"
          >
            {n}
          </motion.div>
          {n < 3 && (
            <div className="mx-2 h-1 w-10 overflow-hidden rounded-full bg-white/8">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: n < step ? '100%' : '0%' }}
                className="h-full rounded-full"
                style={{ backgroundImage: GOLD_GRADIENT }}
              />
            </div>
          )}
        </div>
      ))}
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      dob: '',
      lga: undefined as unknown as FormValues['lga'],
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
      toast.error('That answer is not correct. Try again.')
      setQuiz(makeQuiz())
    }
  }

  async function createAccount() {
    const v = form.getValues()
    const { error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: 'https://abiaconnect.com/',
        data: {
          display_name: v.name,
          username: v.username,
          lga: v.lga,
          dob: v.dob,
        },
      },
    })
    if (error) {
      toast.error(error.message)
      goTo(1)
      return
    }
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

  const strength = passwordStrength(form.watch('password') || '')

  return (
    <>
      <SEO title="Create your AbiaConnect account" description="Join AbiaConnect." path="/register" />
      <PremiumAuthShell
        logoUrl={logoUrl}
        badge="Premium Android onboarding"
        title="Create your AbiaConnect identity"
        subtitle="A modern native-style sign-up flow with better spacing, smoother transitions, and clearer trust cues so new members can register confidently."
        panelTitle="Designed to feel like a premium native app"
        panelDescription="The refreshed sign-up experience keeps your current backend and validation flow, while making onboarding cleaner, warmer, and more professional for first-time members."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300/80">
              <UserPlus className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
              Step-by-step account creation
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <ShieldCheck className="size-3.5" />
              Bot-resistant verification
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Join AbiaConnect</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300/72">
              Build your account once, verify it securely, and step into a stronger community experience built for Abians worldwide.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <StepDots step={step} />

          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur-xl sm:p-5">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div
                  key="s1"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  <form onSubmit={onStep1} className="space-y-5 text-left">
                    <div className="grid gap-4 rounded-[1.4rem] border border-white/10 bg-slate-950/25 p-4 sm:grid-cols-3">
                      {[
                        'Cleaner registration flow',
                        'Touch-friendly Android spacing',
                        'Professional account write-up',
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                          <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: MOBILE_BRAND.gold }} />
                          <p className="text-xs leading-5 text-slate-300/74">{item}</p>
                        </div>
                      ))}
                    </div>

                    <Field label="Full name" error={form.formState.errors.name?.message}>
                      <Input {...form.register('name')} placeholder="First and last name" className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white placeholder:text-white/25" />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Username" error={form.formState.errors.username?.message}>
                        <Input {...form.register('username')} placeholder="unique_id" className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white placeholder:text-white/25" />
                      </Field>
                      <Field label="Date of birth" error={form.formState.errors.dob?.message}>
                        <Input
                          type="date"
                          {...form.register('dob')}
                          className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white"
                          style={{ colorScheme: 'dark' }}
                        />
                      </Field>
                    </div>

                    <Field label="Email address" error={form.formState.errors.email?.message}>
                      <Input type="email" {...form.register('email')} placeholder="name@example.com" className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white placeholder:text-white/25" />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Password" error={form.formState.errors.password?.message}>
                        <div className="space-y-3">
                          <Input type="password" {...form.register('password')} placeholder="Create a strong password" className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white placeholder:text-white/25" />
                          <div className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="font-semibold uppercase tracking-[0.2em] text-slate-400">Strength</span>
                              <span className="font-semibold text-slate-200">{strength.label}</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/8">
                              <div className={`h-full rounded-full ${strength.tone}`} style={{ width: strength.width }} />
                            </div>
                          </div>
                        </div>
                      </Field>
                      <Field label="Confirm password" error={form.formState.errors.confirmPassword?.message}>
                        <Input type="password" {...form.register('confirmPassword')} placeholder="Repeat your password" className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white placeholder:text-white/25" />
                      </Field>
                    </div>

                    <Field label="LGA of origin" error={form.formState.errors.lga?.message}>
                      <Select
                        value={form.watch('lga')}
                        onValueChange={(v) => form.setValue('lga', v as FormValues['lga'], { shouldValidate: true })}
                      >
                        <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white">
                          <SelectValue placeholder="Select your LGA" />
                        </SelectTrigger>
                        <SelectContent className="z-[150] min-w-[200px] rounded-2xl border-white/10 bg-[#121E33] text-white shadow-2xl">
                          <div className="max-h-[300px] overflow-y-auto py-2">
                            {LGA_OPTIONS.map((l) => (
                              <SelectItem
                                key={l}
                                value={l}
                                className="cursor-pointer border-b border-white/5 px-4 py-4 text-base font-semibold text-white last:border-0 focus:bg-white/10 focus:text-white"
                              >
                                {l}
                              </SelectItem>
                            ))}
                          </div>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] leading-5 text-slate-400/82">
                        Choose the local government area you identify with so your profile feels rooted and relevant.
                      </p>
                    </Field>

                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300/74">
                      By continuing, you agree to the community rules, respectful participation standards, and verification email flow for your account.
                    </div>

                    <Button
                      type="submit"
                      className="h-14 w-full rounded-2xl text-base font-black text-slate-950"
                      style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                    >
                      Continue to verification <ArrowRight className="ml-2 size-5" />
                    </Button>

                    <p className="text-center text-sm text-slate-300/72">
                      Already registered?{' '}
                      <Link to="/login" className="font-bold transition-opacity hover:opacity-80" style={{ color: MOBILE_BRAND.gold }}>
                        Sign in instead
                      </Link>
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
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/25 p-5 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/10">
                      <LockKeyhole className="size-6" style={{ color: MOBILE_BRAND.gold }} />
                    </div>
                    <h3 className="text-xl font-black text-white">Security verification</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300/72">
                      To protect the community from automated sign-ups, please answer this Abia-focused verification prompt.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <Label className="text-center text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      Which of these is a Local Government Area in Abia?
                    </Label>
                    {quiz.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onQuizAnswer(opt)}
                        className="h-16 rounded-2xl border border-white/8 bg-slate-950/35 px-5 text-left font-bold text-white transition-all hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.99]"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <Button variant="ghost" className="w-full text-slate-300/72 hover:text-white" onClick={() => goTo(1)}>
                    <ArrowLeft className="mr-2 size-4" /> Review my details
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
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="py-8 text-center"
                >
                  {!done ? (
                    <div className="flex flex-col items-center">
                      <div className="relative mb-6 size-20">
                        <div className="absolute inset-0 rounded-full border-4 border-white/6" />
                        <Loader2 className="absolute inset-0 size-20 animate-spin" style={{ color: MOBILE_BRAND.gold }} />
                      </div>
                      <h3 className="text-xl font-black text-white">Creating your account</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300/72">
                        We are preparing your profile, security checks, and welcome flow.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="mb-6 flex size-20 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/12">
                        <CheckCircle2 className="size-12 text-emerald-300" />
                      </div>
                      <h3 className="text-2xl font-black text-white">You are all set</h3>
                      <p className="mt-3 max-w-md text-base leading-7 text-slate-300/72">
                        We sent a verification link to your email. Confirm it to activate your premium AbiaConnect experience.
                      </p>
                      <Button
                        className="mt-8 h-14 w-full rounded-2xl font-black text-slate-950"
                        style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                        onClick={() => navigate('/login')}
                      >
                        Return to sign in
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </PremiumAuthShell>
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
    <div className="space-y-2.5">
      <Label className="text-xs font-black uppercase tracking-[0.22em] text-slate-300/78">{label}</Label>
      <div className="relative">{children}</div>
      {error ? (
        <motion.p initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-[11px] font-semibold text-rose-300">
          {error}
        </motion.p>
      ) : null}
    </div>
  )
}
