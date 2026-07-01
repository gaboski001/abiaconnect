import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
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
import { NativeAuthLayout, isNativeApp } from '@/components/mobile/NativeAuthLayout'

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
  dob: z.string().min(1, 'Date of birth is required'),
  lga: z.enum(LGA_OPTIONS, { message: 'Select your LGA' }),
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
      name: '', username: '', email: '', password: '', dob: '', lga: undefined as unknown as FormValues['lga'],
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

  const stepContent = (
    <>
      <StepDots step={step} />
      <AnimatePresence mode="wait" custom={direction}>
        {step === 1 && (
          <motion.div key="s1" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <h2 className="text-lg font-bold mb-1 text-center">Create your account</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Tell us a bit about yourself.</p>
            <form onSubmit={onStep1} className="space-y-4">
              <Field label="Full Name" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
              <Field label="Username" error={form.formState.errors.username?.message}><Input {...form.register('username')} /></Field>
              <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register('email')} /></Field>
              <Field label="Password" error={form.formState.errors.password?.message}><Input type="password" {...form.register('password')} /></Field>
              <Field label="Date of Birth" error={form.formState.errors.dob?.message}><Input type="date" {...form.register('dob')} /></Field>
              <Field label="LGA of Origin" error={form.formState.errors.lga?.message}>
                <Select value={form.watch('lga')} onValueChange={(v) => form.setValue('lga', v as FormValues['lga'], { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Select your LGA" /></SelectTrigger>
                  <SelectContent>{LGA_OPTIONS.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}</SelectContent>
                </Select>
              </Field>
              <Button type="submit" className="w-full">Continue to Verification →</Button>
              <p className="text-sm text-center text-muted-foreground">Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link></p>
            </form>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <h2 className="text-lg font-bold mb-1 text-center">Verify Your Abia Roots</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Select the LGA that belongs to Abia State.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {quiz.options.map((opt) => (
                <button key={opt} type="button" onClick={() => onQuizAnswer(opt)} className="rounded-xl border border-border bg-background p-4 text-left font-medium hover:border-primary hover:bg-primary/5 transition-colors">{opt}</button>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6" onClick={() => goTo(1)}>← Back</Button>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="s3" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="text-center py-6">
            {!done ? (
              <>
                <Loader2 className="size-10 mx-auto animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Creating your account…</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-14 mx-auto text-primary mb-4" />
                <h2 className="text-xl font-bold mb-2">You're all set!</h2>
                <p className="text-sm text-muted-foreground mb-6">Check your email to verify your account, then sign in.</p>
                <Button className="w-full" onClick={() => navigate('/login')}>Go to Sign In</Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  if (isNativeApp()) {
    return (
      <>
        <SEO title="Create your AbiaConnect account" description="Join AbiaConnect." path="/register" />
        <NativeAuthLayout title="Create account" subtitle="Join the community in a few taps." logoUrl={logoUrl} siteName={settings.site_name || 'AbiaConnect'}>
          {stepContent}
        </NativeAuthLayout>
      </>
    )
  }

  return (
    <>
      <SEO title="Create your AbiaConnect account" description="Join AbiaConnect — the community forum connecting Abians worldwide. Register in seconds." path="/register" />
    <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 rounded-3xl p-6">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-xl p-8 overflow-hidden">
        <div className="flex justify-center mb-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={settings.site_name || 'AbiaConnect'} className="h-full w-full object-contain" />
            ) : (
              <span className="text-lg font-bold">{(settings.site_name || 'A').charAt(0)}</span>
            )}
          </span>
        </div>
        <div className="flex justify-center mb-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={settings.site_name || 'AbiaConnect'} className="h-full w-full object-contain" />
            ) : (
              <span className="text-lg font-bold">{(settings.site_name || 'A').charAt(0)}</span>
            )}
          </span>
        </div>
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
              <h1 className="text-2xl font-bold mb-1 text-center">Create your account</h1>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Tell us a bit about yourself.
              </p>
              <form onSubmit={onStep1} className="space-y-4">
                <Field label="Full Name" error={form.formState.errors.name?.message}>
                  <Input {...form.register('name')} />
                </Field>
                <Field label="Username" error={form.formState.errors.username?.message}>
                  <Input {...form.register('username')} />
                </Field>
                <Field label="Email" error={form.formState.errors.email?.message}>
                  <Input type="email" {...form.register('email')} />
                </Field>
                <Field label="Password" error={form.formState.errors.password?.message}>
                  <Input type="password" {...form.register('password')} />
                </Field>
                <Field label="Date of Birth" error={form.formState.errors.dob?.message}>
                  <Input type="date" {...form.register('dob')} />
                </Field>
                <Field label="LGA of Origin" error={form.formState.errors.lga?.message}>
                  <Select
                    value={form.watch('lga')}
                    onValueChange={(v) => form.setValue('lga', v as FormValues['lga'], { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your LGA" />
                    </SelectTrigger>
                    <SelectContent>
                      {LGA_OPTIONS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
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
              <h1 className="text-2xl font-bold mb-1 text-center">Verify Your Abia Roots</h1>
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
    </div>
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
