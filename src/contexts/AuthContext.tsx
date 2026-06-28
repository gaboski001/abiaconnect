import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Role = 'Super Admin' | 'Admin' | 'Member' | 'guest'

interface AuthContextValue {
  user: User | null
  session: Session | null
  role: Role
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: (nextSession?: Session | null) => Promise<void>
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

  // High-performance: read from cache immediately
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })

  const [role, setRole] = useState<Role>(() => {
    return (localStorage.getItem('abia_cached_role') as Role) || 'guest'
  })

  // If we have a cached user, we don't need to block with 'loading' screen
  const [loading, setLoading] = useState(!user)

  async function fetchRole(userId: string): Promise<Role> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
      if (error || !data) return 'Member'
      const names = (data as { role: string }[]).map((r) => r.role).filter(Boolean)
      const resolved = names.length ? resolveRole(names) : 'Member'
      localStorage.setItem('abia_cached_role', resolved)
      return resolved
    } catch {
      return 'Member'
    }
  }

  async function applySession(s: Session | null) {
    const newUser = s?.user ?? null
    setSession(s)
    setUser(newUser)

    if (newUser) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(newUser))
      // Update role in background to avoid blocking
      fetchRole(newUser.id).then(setRole)
    } else {
      localStorage.removeItem(CACHE_KEY)
      localStorage.removeItem('abia_cached_role')
      setRole('guest')
    }
  }

  useEffect(() => {
    let mounted = true
    const bootstrapTimeout = window.setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return
        await applySession(data.session)
      })
      .catch(() => {
        if (mounted) void applySession(null)
      })
      .finally(() => {
        window.clearTimeout(bootstrapTimeout)
        if (mounted) setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      void applySession(newSession)
      if (event === 'SIGNED_IN' && newSession?.user) {
        window.setTimeout(() => {
          void checkAndNotifyNewDevice(newSession.user.id, newSession.user.email)
        }, 0)
      }
    })

    return () => {
      mounted = false
      window.clearTimeout(bootstrapTimeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  async function refreshSession(nextSession?: Session | null) {
    setLoading(true)
    try {
      if (typeof nextSession !== 'undefined') {
        await applySession(nextSession)
      } else {
        const { data } = await supabase.auth.getSession()
        await applySession(data.session)
      }
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem(CACHE_KEY)
    setRole('guest')
    setUser(null)
    setSession(null)
  }

  const isAdmin = role === 'Super Admin' || role === 'Admin'

  return (
    <AuthContext.Provider value={{ user, session, role, isAdmin, loading, signOut, refreshSession }}>
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
