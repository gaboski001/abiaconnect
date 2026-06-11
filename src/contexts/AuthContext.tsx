import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  role: string | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const CACHE_KEY = 'abia_cached_user'

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
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) return null
      // @ts-expect-error - joined shape
      return (data?.roles?.name as string) ?? null
    } catch {
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.session.user))
        setRole(await fetchRole(data.session.user.id))
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newSession.user))
        setRole(await fetchRole(newSession.user.id))
      } else {
        localStorage.removeItem(CACHE_KEY)
        setRole(null)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem(CACHE_KEY)
  }

  return (
    <AuthContext.Provider
      value={{ user, session, role, isAdmin: role === 'admin', loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
