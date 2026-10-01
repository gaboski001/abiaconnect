import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CommunityStats {
  discussions: number
  groups: number
  topics: number
}

/** Real, live community numbers (public data only). */
export function useCommunityStats() {
  return useQuery({
    queryKey: ['community-stats'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<CommunityStats> => {
      const [threads, groups, topics] = await Promise.all([
        supabase.from('threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('subgroups').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ])
      return { discussions: threads.count ?? 0, groups: groups.count ?? 0, topics: topics.count ?? 0 }
    },
  })
}
