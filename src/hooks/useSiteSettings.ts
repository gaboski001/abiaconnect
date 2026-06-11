import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SiteSettings = Record<string, string>

export function useSiteSettings() {
  const query = useQuery({
    queryKey: ['site-settings'],
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase.from('site_settings').select('*')
      if (error) throw error
      const map: SiteSettings = {}
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const key = (row.key ?? row.name) as string | undefined
        const value = (row.value ?? row.val) as string | undefined
        if (key) map[key] = value ?? ''
      }
      return map
    },
  })
  return { ...query, settings: query.data ?? {} }
}
