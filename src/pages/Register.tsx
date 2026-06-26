import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
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

const BRAND = {
  bg: '#0D0D0D',
  surface: '#1E1E1E',
  gold: '#C8A951',
  goldDark: '#8A7A3A',
  text: '#FFFFFF',
  textMuted: '#B0B0B0',
};

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
  path: ["confirmPassword"],
})

type FormValues = z.infer<typeof schema>

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center">
          <motion.div
            animate={{
              scale: n === step ? 1.2 : 1,
              backgroundColor: n <= step ? BRAND.gold : '#2A2A2A',
              color: n <= step ? BRAND.bg : BRAND.textMuted
            }}
            className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-black transition-colors shadow-lg"
          >
            {n}
          </motion.div>
          {n < 3 && (
            <div className="mx-2 h-0.5 w-8 bg-[#2A2A2A] overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: n < step ? '100%' : '0%' }}
                className="h-full"
                style={{ backgroundColor: BRAND.gold }}
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
      name: '', username: '', email: '', password: '', confirmPassword: '', dob: '', lga: undefined as unknown as FormValues['lga'],
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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0D0D0D] overflow-y-auto font-sans">
      <SEO title="Create your AbiaConnect account" description="Join AbiaConnect." path="/register" />

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ background: BRAND.gold }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ background: BRAND.gold }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full px-6 py-12 min-h-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-[#1E1E1E] border border-white/5 shadow-2xl">
            {logoUrl ? (
              <img src={logoUrl} alt="AbiaConnect" className="w-10 h-10 object-contain" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: BRAND.gold }}>A</span>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Join AbiaConnect</h1>
        </motion.div>

        <div className="w-full max-w-lg">
          <StepDots step={step} />

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#161616] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl shadow-black/50"
          >
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div
                  key="s1"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <form onSubmit={onStep1} className="space-y-5">
                    <Field label="Full Name" error={form.formState.errors.name?.message}>
                      <Input {...form.register('name')} placeholder="First & Last Name" className="h-12 rounded-xl border-white/5 bg-[#0D0D0D] text-white" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Username" error={form.formState.errors.username?.message}>
                        <Input {...form.register('username')} placeholder="unique_id" className="h-12 rounded-xl border-white/5 bg-[#0D0D0D] text-white" />
                      </Field>
                      <Field label="Date of Birth" error={form.formState.errors.dob?.message}>
                        <div className="relative">
                          <Input type="date" {...form.register('dob')} className="h-12 rounded-xl border-white/5 bg-[#0D0D0D] text-white appearance-none w-full" style={{ colorScheme: 'dark' }} />
                        </div>
                      </Field>
                    </div>
                    <Field label="Email Address" error={form.formState.errors.email?.message}>
                      <Input type="email" {...form.register('email')} placeholder="name@example.com" className="h-12 rounded-xl border-white/5 bg-[#0D0D0D] text-white" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Security Password" error={form.formState.errors.password?.message}>
                        <Input type="password" {...form.register('password')} placeholder="Min. 8 chars" className="h-12 rounded-xl border-white/5 bg-[#0D0D0D] text-white" />
                      </Field>
                      <Field label="Confirm Password" error={form.formState.errors.confirmPassword?.message}>
                        <Input type="password" {...form.register('confirmPassword')} placeholder="Repeat password" className="h-12 rounded-xl border-white/5 bg-[#0D0D0D] text-white" />
                      </Field>
                    </div>
                    <Field label="LGA of Origin" error={form.formState.errors.lga?.message}>
                      <Select
                        value={form.watch('lga')}
                        onValueChange={(v) => form.setValue('lga', v as FormValues['lga'], { shouldValidate: true })}
                      >
                        <SelectTrigger className="h-14 rounded-xl border-white/5 bg-[#0D0D0D] text-white">
                          <SelectValue placeholder="Select your LGA" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1A1A1A] border-white/10 text-white z-[150] min-w-[200px]">
                          <div className="max-h-[300px] overflow-y-auto py-2">
                            {LGA_OPTIONS.map((l) => (
                              <SelectItem
                                key={l}
                                value={l}
                                className="text-white focus:bg-BRAND.gold/20 focus:text-white cursor-pointer py-4 px-4 text-base font-semibold border-b border-white/5 last:border-0"
                              >
                                {l}
                              </SelectItem>
                            ))}
                          </div>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] ml-1 opacity-40" style={{ color: BRAND.textMuted }}>
                        Select the local government area you identify with.
                      </p>
                    </Field>

                    <Button
                      type="submit"
                      className="w-full h-14 rounded-xl text-base font-bold mt-4"
                      style={{
                        background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
                        color: BRAND.bg,
                      }}
                    >
                      Continue to Verification <ArrowRight className="ml-2 size-5" />
                    </Button>

                    <p className="text-sm text-center font-medium pt-2" style={{ color: BRAND.textMuted }}>
                      Already registered?{' '}
                      <Link to="/login" className="font-bold hover:underline" style={{ color: BRAND.gold }}>Sign In</Link>
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
                  className="space-y-6"
                >
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white mb-2">Security Verification</h2>
                    <p className="text-sm leading-relaxed" style={{ color: BRAND.textMuted }}>
                      To protect our community from automated bots, please solve this security question about Abia State.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-center opacity-50 mb-1">
                      Which of these is a Local Government Area in Abia?
                    </Label>
                    {quiz.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onQuizAnswer(opt)}
                        className="h-16 rounded-2xl border border-white/5 bg-[#0D0D0D] px-6 text-left font-bold text-white hover:border-BRAND.gold/50 hover:bg-BRAND.gold/5 transition-all active:scale-[0.98]"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full text-white/50 hover:text-white"
                    onClick={() => goTo(1)}
                  >
                    <ArrowLeft className="mr-2 size-4" /> Go back and edit details
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
                  className="text-center py-10"
                >
                  {!done ? (
                    <div className="flex flex-col items-center">
                      <div className="relative size-20 mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                        <Loader2 className="absolute inset-0 size-20 animate-spin" style={{ color: BRAND.gold }} />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">Creating Account</h2>
                      <p className="text-sm" style={{ color: BRAND.textMuted }}>Securing your profile on the blockchain...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="size-20 rounded-full flex items-center justify-center mb-6" style={{ background: `${BRAND.gold}20` }}>
                        <CheckCircle2 className="size-12" style={{ color: BRAND.gold }} />
                      </div>
                      <h2 className="text-2xl font-black text-white mb-3">You're all set!</h2>
                      <p className="text-base leading-relaxed mb-10 px-4" style={{ color: BRAND.textMuted }}>
                        We've sent a verification link to your email. Please confirm it to activate your account.
                      </p>
                      <Button
                        className="w-full h-14 rounded-xl font-bold"
                        style={{ background: BRAND.gold, color: BRAND.bg }}
                        onClick={() => navigate('/login')}
                      >
                        Return to Sign In
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
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
      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">{label}</Label>
      {children}
      {error && (
        <motion.p
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-[10px] font-bold text-red-500 ml-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  )
}
