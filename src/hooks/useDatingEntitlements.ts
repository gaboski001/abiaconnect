import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { getEntitlements } from '@/lib/monetization/api'

/**
 * The signed-in user's dating plan and limits, for display only. Every
 * premium action is re-checked by the database, so this can never unlock a
 * feature by itself.
 */
export function useDatingEntitlements() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dating-entitlements', user?.id],
    queryFn: getEntitlements,
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 15_000,
  })
}
