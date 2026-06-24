import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2, Camera, User, Mail, Lock, Phone, MapPin, ArrowRight, ArrowLeft } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { toWebP } from '@/lib/image'

const ABIA_LGAS = [
  'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano',
  'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia',
  'Osisioma Ngwa', 'Ugwunagbo', 'Ukwa East', 'Ukwa West',
  'Umuahia North', 'Umuahia South', 'Umunneochi',
] as const

const LGA_OPTIONS = [...ABIA_LGAS, 'Non-Indigene (Preferred LGA)'] as const

const schema = z.object({
  name: z.string().trim().min(2, 'Full name is required').max(100),
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(30)
    .regex(/^[A-Za-z0-9_]+$/, 'Letters, numbers, and underscores only'),
  email: z.string().trim().email('Invalid email').max(255),
  phone: z.string().min(10, 'Valid phone number required'),
  password: z.string().min(8, 'At least 8 characters').max(72),
  confirmPassword: z.string(),
  lga: z.enum(LGA_OPTIONS, { message: 'Select your LGA' }),
  terms: z.boolean().refine(v => v === true, 'You must accept the terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type FormValues = z.infer<typeof schema>

function getPasswordStrength(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

const STRENGTH_LABELS = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-primary'];

export default function Register() {
  const navigate = useNavigate()
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', username: '', email: '', phone: '', password: '', confirmPassword: '', lga: undefined as unknown as FormValues['lga'], terms: false
    },
    mode: 'onBlur',
  })

  const password = form.watch('password');
  const strength = getPasswordStrength(password);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const webp = await toWebP(file)
      setAvatar(webp)
      setAvatarPreview(URL.createObjectURL(webp))
    } catch (err) {
      toast.error('Failed to process image')
    }
  }

  const nextStep = async () => {
    let fields: (keyof FormValues)[] = []
    if (step === 1) fields = ['name', 'email', 'phone', 'username']
    if (step === 2) fields = ['password', 'confirmPassword', 'lga', 'terms']

    const isValid = await form.trigger(fields)
    if (isValid) {
      setDirection(1)
      setStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    setDirection(-1)
    setStep(prev => prev - 1)
  }

  async function onSubmit() {
    setLoading(true)
    const v = form.getValues()

    try {
      const { data, error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
        options: {
          emailRedirectTo: 'https://abiaconnect.com/',
          data: {
            display_name: v.name,
            username: v.username,
            lga: v.lga,
            phone: v.phone,
          },
        },
      })

      if (error) throw error

      // Upload avatar if present
      if (avatar && data.user) {
        const path = `${data.user.id}/profile.${avatar.name.split('.').pop()}`
        await supabase.storage.from('avatars').upload(path, avatar, { upsert: true })
        await supabase.from('profiles').update({ avatar_url: path }).eq('id', data.user.id)
      }

      setDone(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const variants = {
    enter: (d: number) => ({ x: d * 50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -50, opacity: 0 }),
  }

  return (
    <>
      <SEO title="Join AbiaConnect" description="Register to join the largest community of Abians worldwide." path="/register" />

      <div className="min-h-[90vh] flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    s === step ? 'w-12 bg-primary' : s < step ? 'w-6 bg-primary/40' : 'w-6 bg-muted'
                  }`}
                />
              ))}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {step === 1 ? 'Personal Info' : step === 2 ? 'Account Setup' : 'Verify Account'}
            </h1>
          </div>

          <div className="bg-card/50 backdrop-blur-xl rounded-3xl border border-border shadow-2xl overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="p-8 space-y-6"
                >
                  <div className="flex justify-center mb-4">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-primary/30 overflow-hidden">
                        {avatarPreview ? (
                          <img src={avatarPreview} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                          <User className="size-10 text-muted-foreground" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                        <Camera className="size-4" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <Field label="Full Name" icon={User} error={form.formState.errors.name?.message}>
                      <Input {...form.register('name')} placeholder="John Doe" />
                    </Field>
                    <Field label="Username" icon={User} error={form.formState.errors.username?.message}>
                      <Input {...form.register('username')} placeholder="johndoe_123" />
                    </Field>
                    <Field label="Email Address" icon={Mail} error={form.formState.errors.email?.message}>
                      <Input {...form.register('email')} placeholder="john@example.com" />
                    </Field>
                    <Field label="Phone Number" icon={Phone} error={form.formState.errors.phone?.message}>
                      <Input {...form.register('phone')} placeholder="+234 ..." />
                    </Field>
                  </div>

                  <Button onClick={nextStep} className="w-full h-12 rounded-xl text-lg font-bold">
                    Next Step <ArrowRight className="ml-2 size-5" />
                  </Button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="p-8 space-y-6"
                >
                  <div className="grid gap-4">
                    <Field label="Choose Password" icon={Lock} error={form.formState.errors.password?.message}>
                      <Input type="password" {...form.register('password')} />
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <span>Strength</span>
                          <span className={strength > 2 ? 'text-emerald-500' : ''}>{STRENGTH_LABELS[strength]}</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-full flex-1 transition-all duration-500 ${i <= strength ? STRENGTH_COLORS[strength] : 'bg-muted'}`} />
                          ))}
                        </div>
                      </div>
                    </Field>

                    <Field label="Confirm Password" icon={Lock} error={form.formState.errors.confirmPassword?.message}>
                      <Input type="password" {...form.register('confirmPassword')} />
                    </Field>

                    <Field label="LGA of Origin" icon={MapPin} error={form.formState.errors.lga?.message}>
                      <Select
                        value={form.watch('lga')}
                        onValueChange={(v) => form.setValue('lga', v as FormValues['lga'], { shouldValidate: true })}
                      >
                        <SelectTrigger className="h-12 bg-background/50">
                          <SelectValue placeholder="Select your LGA" />
                        </SelectTrigger>
                        <SelectContent>
                          {LGA_OPTIONS.map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <div className="flex items-start space-x-2 p-4 bg-muted/30 rounded-xl">
                      <Checkbox
                        id="terms"
                        checked={form.watch('terms')}
                        onCheckedChange={(v) => form.setValue('terms', v as boolean, { shouldValidate: true })}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="terms" className="text-xs text-muted-foreground">
                          I agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                        </label>
                        {form.formState.errors.terms && <p className="text-[10px] text-destructive">{form.formState.errors.terms.message}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={prevStep} className="h-12 w-14 rounded-xl">
                      <ArrowLeft className="size-5" />
                    </Button>
                    <Button onClick={onSubmit} className="flex-1 h-12 rounded-xl text-lg font-bold" disabled={loading}>
                      {loading ? <Loader2 className="animate-spin size-5" /> : 'Create Account'}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="p-12 text-center"
                >
                  <div className="mb-6 inline-flex p-4 rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="size-16" />
                  </div>
                  <h2 className="text-3xl font-extrabold mb-4">Registration Sent!</h2>
                  <p className="text-muted-foreground mb-8 text-lg">
                    We've sent a verification link to <strong>{form.getValues('email')}</strong>.
                    Please check your inbox to activate your account.
                  </p>
                  <Button size="lg" className="w-full rounded-xl" onClick={() => navigate('/login')}>
                    Return to Sign In
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </>
  )
}

function Field({ label, icon: Icon, error, children }: { label: string; icon: any; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary/60" />
        <Label className="text-sm font-semibold">{label}</Label>
      </div>
      {children}
      {error && <p className="text-xs text-destructive font-medium px-1">{error}</p>}
    </div>
  )
}
