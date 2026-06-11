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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const CACHE_KEY = 'abia_cached_user'

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
        .select('roles(name)')
        .eq('user_id', userId)
      if (error || !data) return 'Member'
      const names = data
        // @ts-expect-error joined shape varies
        .map((r) => (Array.isArray(r.roles) ? r.roles[0]?.name : r.roles?.name))
        .filter(Boolean) as string[]
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void applySession(newSession)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
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
