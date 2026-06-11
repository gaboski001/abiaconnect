import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('*')
      if (error) throw error
      return data ?? []
    },
  })
}
