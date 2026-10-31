import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'

export function RelationshipPlanMode() {
  const qc = useQueryClient()
  const mode = useQuery({
    queryKey: ['relationship-plan-mode'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('relationship_plans_enabled')
      if (error) throw error
      return data
    },
  })
  const save = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc('admin_set_relationship_plan_mode', { _enabled: enabled })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['relationship-plan-mode'] })
      void qc.invalidateQueries({ queryKey: ['dating-entitlements'] })
      void qc.invalidateQueries({ queryKey: ['dating-likes-received'] })
      toast.success('Relationship access saved')
    },
    onError: () => toast.error('Could not save relationship access. Please try again.'),
  })
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
      <div className="min-w-0">
        <Label htmlFor="relationship-plan-mode" className="font-semibold">Relationship plan mode</Label>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {mode.error ? 'Could not load access settings.' : mode.isPending ? 'Loading…' : mode.data
            ? 'On · Members use their individual plans.'
            : 'Off · Premium access for everyone, unlimited likes and messaging, and incoming likes visible.'}
        </p>
      </div>
      <Switch id="relationship-plan-mode" checked={mode.data ?? true}
        disabled={mode.isPending || !!mode.error || save.isPending} onCheckedChange={(value) => save.mutate(value)} />
    </div>
  )
}