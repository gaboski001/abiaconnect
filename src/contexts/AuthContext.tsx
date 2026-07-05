import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { cleanupPushNotifications } from '@/lib/pushCleanup'

export type Role = 'Super Admin' | 'Admin' | 'Member' | 'guest'

interface AuthContextValue {
  user: User | null
  session: Session | null
  role: Role
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const CACHE_KEY = 'abia_cached_user'

async function computeDeviceFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency || ''),
  ].join('|')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function describeDevice(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS'
  return `${browser} on ${os}`
}

async function checkAndNotifyNewDevice(userId: string, email: string | undefined) {
  if (!email) return
  try {
    const fingerprint = await computeDeviceFingerprint()
    const sessionKey = `abia_dev_notified_${userId}_${fingerprint}`
    if (sessionStorage.getItem(sessionKey)) return
    sessionStorage.setItem(sessionKey, '1')

    const { data: existing } = await supabase
      .from('user_known_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('fingerprint', fingerprint)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('user_known_devices')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', existing.id)
      return
    }

    const { error: insertError } = await supabase
      .from('user_known_devices')
      .insert({ user_id: userId, fingerprint, user_agent: navigator.userAgent })
    if (insertError) return

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'new-device-login',
        recipientEmail: email,
        idempotencyKey: `new-device-${userId}-${fingerprint}`,
        templateData: {
          device: describeDevice(),
          when: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
        },
      },
    })
  } catch {
    // best-effort — never block sign-in
  }
}

function resolveRole(names: string[]): Role {
  if (names.includes('Super Admin')) return 'Super Admin'
  if (names.includes('Admin')) return 'Admin'
  return (names[0] as Role) ?? 'Member'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })
  const [role, setRole] = useState<Role>('guest')
  const [loading, setLoading] = useState(true)

  async function fetchRole(userId: string): Promise<Role> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
      if (error || !data) return 'Member'
      const names = (data as { role: string }[]).map((r) => r.role).filter(Boolean)
      return names.length ? resolveRole(names) : 'Member'
    } catch {
      return 'Member'
    }
  }

  async function applySession(s: Session | null) {
    setSession(s)
    setUser(s?.user ?? null)
    if (s?.user) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(s.user))
      setRole(await fetchRole(s.user.id))
    } else {
      localStorage.removeItem(CACHE_KEY)
      setRole('guest')
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      await applySession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      void applySession(newSession)
      if (event === 'SIGNED_IN' && newSession?.user) {
        void checkAndNotifyNewDevice(newSession.user.id, newSession.user.email)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    try {
      await cleanupPushNotifications()
    } catch {}

    await supabase.auth.signOut()
    localStorage.removeItem(CACHE_KEY)
    setRole('guest')
    setUser(null)
    setSession(null)
  }

  const isAdmin = role === 'Super Admin' || role === 'Admin'

  return (
    <AuthContext.Provider value={{ user, session, role, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export const useAuthContext = useAuth
