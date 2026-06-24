import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [direction, setDirection] = useState(1)
  const [quiz, setQuiz] = useState(makeQuiz)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

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
    setLoading(true)
    const v = form.getValues()
    const { error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: window.location.origin + '/login',
        data: {
          display_name: v.name,
          username: v.username,
          lga: v.lga,
          dob: v.dob,
        },
      },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      goTo(1)
      return
    }
    setDone(true)
  }

  const variants = {
    enter: (d: number) => ({ x: d * 50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -50, opacity: 0 }),
  }

  return (
    <>
      <SEO title="Create your AbiaConnect account" description="Join AbiaConnect — the community forum connecting Abians worldwide." path="/register" />
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-xl p-8 overflow-hidden">
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{ rotateY: 360 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 bg-transparent"
            >
              <img src="/email-logo.png" alt="Logo" className="w-full h-full object-contain" />
            </motion.div>
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
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl font-bold mb-1 text-center">Create your account</h1>
                <p className="text-sm text-muted-foreground text-center mb-8">
                  Tell us a bit about yourself to join AbiaConnect.
                </p>
                <form onSubmit={onStep1} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input {...form.register('name')} placeholder="Enter full name" />
                    {form.formState.errors.name && <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Username</Label>
                    <Input {...form.register('username')} placeholder="Choose username" />
                    {form.formState.errors.username && <p className="text-[11px] text-destructive">{form.formState.errors.username.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" {...form.register('email')} placeholder="email@example.com" />
                    {form.formState.errors.email && <p className="text-[11px] text-destructive">{form.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" {...form.register('password')} placeholder="••••••••" />
                    {form.formState.errors.password && <p className="text-[11px] text-destructive">{form.formState.errors.password.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date of Birth</Label>
                    <Input type="date" {...form.register('dob')} />
                    {form.formState.errors.dob && <p className="text-[11px] text-destructive">{form.formState.errors.dob.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>LGA of Origin</Label>
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
                    {form.formState.errors.lga && <p className="text-[11px] text-destructive">{form.formState.errors.lga.message}</p>}
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold">
                    Continue to Verification →
                  </Button>
                  <p className="text-sm text-center text-muted-foreground pt-4">
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
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
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl font-bold mb-1 text-center">Verify Your Abia Roots</h1>
                <p className="text-sm text-muted-foreground text-center mb-8">
                  Security Check: Select the Local Government Area that belongs to Abia State.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {quiz.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onQuizAnswer(opt)}
                      className="rounded-2xl border border-border bg-background p-5 text-left font-semibold hover:border-primary hover:bg-primary/5 transition-all shadow-sm active:scale-95"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-10" onClick={() => goTo(1)}>
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
                transition={{ duration: 0.3 }}
                className="text-center py-10"
              >
                {!done ? (
                  <>
                    <Loader2 className="size-16 mx-auto animate-spin text-primary mb-6" />
                    <p className="text-lg font-medium text-muted-foreground">Creating your account…</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-20 mx-auto text-primary mb-6" />
                    <h2 className="text-3xl font-extrabold mb-4 tracking-tight">You're all set!</h2>
                    <p className="text-muted-foreground mb-10 text-lg">
                      Check your email to verify your account, then you can sign in.
                    </p>
                    <Button size="lg" className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20" onClick={() => navigate('/login')}>
                      Return to Sign In
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
