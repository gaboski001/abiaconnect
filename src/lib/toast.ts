/**
 * Safe re-export of sonner that redacts backend hostnames, storage tokens,
 * and stack traces from every message/description before display.
 *
 * Import `toast` from `@/lib/toast` instead of `sonner` directly so user-facing
 * copy never leaks internal infra strings.
 */
import { toast as sonnerToast, type ExternalToast } from 'sonner'
import { redact } from './redactError'

type Message = string | React.ReactNode

function clean(msg: Message): Message {
  return typeof msg === 'string' ? redact(msg) : msg
}

function cleanOpts(opts?: ExternalToast): ExternalToast | undefined {
  if (!opts) return opts
  const next: ExternalToast = { ...opts }
  if (typeof next.description === 'string') next.description = redact(next.description)
  return next
}

function wrap<T extends (msg: Message, opts?: ExternalToast) => unknown>(fn: T) {
  return ((msg: Message, opts?: ExternalToast) => fn(clean(msg) as string, cleanOpts(opts))) as T
}

export const toast = Object.assign(
  ((msg: Message, opts?: ExternalToast) => sonnerToast(clean(msg) as string, cleanOpts(opts))),
  {
    success: wrap(sonnerToast.success),
    error: wrap(sonnerToast.error),
    info: wrap(sonnerToast.info),
    warning: wrap(sonnerToast.warning),
    message: wrap(sonnerToast.message as unknown as (msg: Message, opts?: ExternalToast) => unknown),
    loading: wrap(sonnerToast.loading),
    dismiss: sonnerToast.dismiss,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
  },
)

export type { ExternalToast }
