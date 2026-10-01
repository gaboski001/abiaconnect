import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff, ShieldCheck, type LucideIcon } from 'lucide-react'
import { MOBILE_BRAND } from '@/lib/mobileBrand'

/**
 * Android-tuned auth chrome.
 *
 * Rendered ONLY inside the installed native app (Capacitor). The web build,
 * including the mobile browser view, is not affected — callers guard with
 * `Capacitor.isNativePlatform()` and fall back to the existing web JSX.
 */
export interface NativeAuthLayoutProps {
  title: string
  subtitle?: string
  /** Kept for compatibility; the bundled brand logo is used so no placeholder ever shows. */
  logoUrl?: string | null
  siteName?: string
  /** Optional element above the title (e.g. a step indicator). */
  eyebrow?: ReactNode
  /** Footer under the form (e.g. "New here? Create an account"). */
  footer?: ReactNode
  /** Where the back button goes. Defaults to the previous screen. */
  backTo?: string
  /** Custom back action (e.g. previous step); takes precedence over backTo. */
  onBack?: () => void
  children: ReactNode
}

/** Bundled with the site, so it renders instantly (no signed-URL wait). */
const BRAND_LOGO = '/brand-logo.png'

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function NativeAuthLayout({
  title,
  subtitle,
  siteName,
  eyebrow,
  footer,
  backTo,
  onBack,
  children,
}: NativeAuthLayoutProps) {
  const navigate = useNavigate()
  const goBack = () => {
    if (onBack) onBack()
    else if (backTo) navigate(backTo)
    else if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <div
      className="dark fixed inset-0 z-50 overflow-y-auto overscroll-none text-slate-50"
      style={{
        background: `radial-gradient(120% 60% at 50% 0%, #17361A 0%, ${MOBILE_BRAND.ink} 58%)`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6">
        <div className="flex h-14 items-center">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-200 transition-colors active:bg-white/10"
          >
            <ChevronLeft className="size-6" />
          </button>
        </div>

        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={BRAND_LOGO}
            alt={siteName || 'AbiaConnect'}
            className="h-12 w-auto object-contain"
            draggable={false}
          />
          {eyebrow ? <div className="mt-6">{eyebrow}</div> : null}
          <h1 className={`${eyebrow ? 'mt-3' : 'mt-6'} text-[28px] font-extrabold leading-tight tracking-tight text-white`}>
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-[15px] leading-6 text-slate-300/80">{subtitle}</p> : null}
        </motion.header>

        <motion.main
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
        >
          {children}
        </motion.main>

        <div className="flex-1" />

        <footer className="pb-6 pt-8 text-center">
          {footer ? <div className="text-[15px] text-slate-300/80">{footer}</div> : null}
          <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-400/70">
            <ShieldCheck className="size-3.5" />
            Your information is encrypted and kept private
          </p>
        </footer>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Form building blocks shared by the native auth screens.
 * ------------------------------------------------------------------------- */

const inputBase =
  'auth-input h-[52px] w-full rounded-xl border pl-11 pr-4 text-[15px] outline-none transition-colors ' +
  'focus:ring-4 focus:ring-amber-300/10 disabled:opacity-60 [color-scheme:dark]'

export interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: LucideIcon
  error?: string
  hint?: string
  /** Right side of the label row (e.g. "Forgot password?"). */
  labelAction?: ReactNode
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, icon: Icon, error, hint, labelAction, id, type = 'text', className, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const isPassword = type === 'password'
  const [reveal, setReveal] = useState(false)
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-[13px] font-semibold text-slate-200">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
        />
        <input
          ref={ref}
          id={inputId}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputBase} ${isPassword ? 'pr-12' : ''} ${className ?? ''}`}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 active:bg-white/10"
          >
            {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-[13px] text-red-300">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[13px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
})

/** Gold primary action used across the native auth screens. */
export function AuthSubmit({
  children,
  loading,
  loadingText,
  type = 'submit',
  onClick,
  disabled,
}: {
  children: ReactNode
  loading?: boolean
  loadingText?: string
  type?: 'submit' | 'button'
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-[#0B1F0B] shadow-[0_12px_30px_-12px_rgba(248,195,1,0.55)] transition-transform active:scale-[0.98] disabled:opacity-70"
      style={{ backgroundImage: 'linear-gradient(135deg,#F8C301 0%,#E87015 100%)' }}
    >
      {loading ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-[#0B1F0B]/30 border-t-[#0B1F0B]" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export default NativeAuthLayout
