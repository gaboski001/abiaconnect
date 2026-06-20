import { supabase } from '@/integrations/supabase/client'

export type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BIPEvent | null = null
let iosFlag = false

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  // @ts-expect-error legacy iOS standalone
  window.navigator.standalone !== true

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // @ts-expect-error legacy iOS standalone
  window.navigator.standalone === true

export function setDeferredPrompt(e: BIPEvent | null) {
  deferred = e
}
export function getDeferredPrompt(): BIPEvent | null {
  return deferred
}
export function setIOSFlag(v: boolean) {
  iosFlag = v
}
export function getIOSFlag(): boolean {
  return iosFlag
}

/* ---------- Per-user preference ---------- */
const PREF_KEY = 'abiaconnect_pwa_prompt_enabled'

export function getPromptEnabled(): boolean {
  try {
    const v = localStorage.getItem(PREF_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

export function setPromptEnabled(enabled: boolean) {
  try {
    localStorage.setItem(PREF_KEY, String(enabled))
  } catch {
    /* ignore */
  }
}

/* ---------- Event logging ---------- */
export type PwaEvent =
  | 'prompt_shown'
  | 'accepted'
  | 'dismissed'
  | 'manual_click'
  | 'installed'
  | 'ios_help_shown'
  | 'ios_help_completed'

export async function logPwaEvent(event: PwaEvent) {
  try {
    const { data } = await supabase.auth.getUser()
    const platform = isIOS() ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop'
    await supabase.from('pwa_install_events').insert({
      user_id: data.user?.id ?? null,
      event,
      platform,
      user_agent: navigator.userAgent.slice(0, 500),
    })
  } catch {
    /* ignore logging errors */
  }
}
