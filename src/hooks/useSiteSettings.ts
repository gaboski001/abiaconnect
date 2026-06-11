import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SiteSettings = Record<string, string>

const DEFAULTS: SiteSettings = {
  site_name: 'AbiaConnect',
  site_tagline: 'Connecting Abians Worldwide',
  site_theme: 'classic',
  global_subgroups_enabled: 'true',
}

export function useSiteSettings() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['site-settings'],
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase.from('site_settings').select('*')
      if (error) throw error
      const map: SiteSettings = { ...DEFAULTS }
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const key = (row.key ?? row.name) as string | undefined
        const value = (row.value ?? row.val) as string | undefined
        if (key) map[key] = value ?? ''
      }
      return map
    },
  })

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key, value }, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-settings'] })
      window.dispatchEvent(new Event('siteSettingsUpdated'))
    },
  })

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ['site-settings'] })
    window.addEventListener('siteSettingsUpdated', handler)
    return () => window.removeEventListener('siteSettingsUpdated', handler)
  }, [qc])

  return {
    ...query,
    settings: query.data ?? DEFAULTS,
    isLoading: query.isLoading,
    updateSetting,
  }
}
