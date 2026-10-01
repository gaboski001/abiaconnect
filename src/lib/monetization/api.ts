import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

// Monetization tables/functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface PlanLimits {
  daily_likes?: number | null
  see_likes?: boolean
  likes_you_preview?: number
  advanced_filters?: boolean
  premium_badge?: boolean
  remove_ads?: boolean
}

export interface Entitlements {
  plan_code: string
  plan_name: string
  tier: 'free' | 'premium' | 'vip'
  is_premium: boolean
  ends_at: string | null
  limits: PlanLimits
  likes_used_today: number
}

export interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  tier: 'free' | 'premium' | 'vip'
  price_minor: number
  promo_price_minor: number | null
  currency: string
  billing_period: 'month' | 'year'
  duration_days: number
  features: string[]
  limits: PlanLimits
  is_active: boolean
  is_visible: boolean
  is_recommended: boolean
  sort_order: number
}

export interface PaymentOption {
  provider: 'paystack' | 'monnify' | 'squad'
  display_name: string
}

export interface ReactResult {
  status: 'ok' | 'limit_reached' | 'profile_required' | 'unavailable' | 'account_restricted'
  matched?: boolean
  likes_remaining?: number | null
}

export interface LikeItem {
  user_id: string
  liked_at: string
  unseen: boolean
  display_name: string | null
  username: string | null
  avatar_url: string | null
  headline: string | null
  dob: string | null
  lga: string | null
  photo: string | null
}

export interface LikesReceived {
  entitled: boolean
  total: number
  unseen: number
  preview_count: number
  items: LikeItem[]
}

export interface MatchItem extends Omit<LikeItem, 'liked_at' | 'unseen'> {
  matched_at: string
}

export interface PaymentRecord {
  reference: string
  provider: string
  amount_minor: number
  currency: string
  status: string
  created_at: string
  plan: { name: string } | null
}

/** Remembers the reference across the provider redirect (fallback only). */
export const PENDING_REFERENCE_KEY = 'abia:pending-payment-reference'

/**
 * Google Play requires Play Billing for digital goods sold inside the Android
 * app, so purchases are only offered outside it (website / iOS web).
 */
export function canPurchaseHere(): boolean {
  return !(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const getEntitlements = () => rpc<Entitlements>('get_my_dating_entitlements')
export const reactToProfile = (target: string, kind: 'like' | 'pass') =>
  rpc<ReactResult>('dating_react', { _target: target, _kind: kind })
export const getLikesReceived = (limit = 20, offset = 0, unseenOnly = false) =>
  rpc<LikesReceived>('dating_likes_received', { _limit: limit, _offset: offset, _unseen_only: unseenOnly })
export const markLikesSeen = () => rpc<void>('dating_mark_likes_seen')
export const getMatches = (limit = 50, offset = 0) => rpc<MatchItem[]>('dating_my_matches', { _limit: limit, _offset: offset })
export const getPaymentOptions = () => rpc<PaymentOption[]>('get_payment_options')

/** Fire-and-forget funnel tracking; never blocks or breaks the UI. */
export function track(event: string, metadata: Record<string, unknown> = {}) {
  db.rpc('track_monetization_event', { _event: event, _metadata: metadata }).then(
    () => undefined,
    () => undefined,
  )
}

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await db
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .eq('is_visible', true)
    .order('sort_order')
  if (error) throw error
  return data as Plan[]
}

export async function getMyPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await db
    .from('payment_transactions')
    .select('reference, provider, amount_minor, currency, status, created_at, plan:subscription_plans(name)')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data as PaymentRecord[]
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    // Edge functions return friendly { error } messages; surface those only.
    let message: string | undefined
    try {
      message = (await (error as { context?: Response }).context?.json())?.error
    } catch {
      /* ignore */
    }
    throw new Error(message || 'Request failed')
  }
  return data as T
}

export const startCheckout = (planId: string, provider?: string) =>
  invoke<{ checkoutUrl: string; reference: string }>('payments-checkout', { planId, provider })
export const verifyPayment = (reference: string) =>
  invoke<{ status: string; planName: string | null }>('payments-verify', { reference })
