import { useQuery } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { Sparkles, FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ChangelogMarkdown } from './ChangelogMarkdown'
import { formatDistanceToNow } from 'date-fns'

type Release = {
  id: string
  platform: 'android' | 'ios'
  version: string
  changelog: string | null
  created_at: string
}

/**
 * Shows the latest N release notes for the current platform (falls back to
 * android on web/desktop). Renders as a polished accordion with markdown.
 */
export function ReleaseNotesAccordion({ limit = 5 }: { limit?: number }) {
  const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web'
  const targetPlatform: 'android' | 'ios' = platform === 'ios' ? 'ios' : 'android'

  const q = useQuery({
    queryKey: ['release-notes', targetPlatform, limit],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_releases')
        .select('id, platform, version, changelog, created_at')
        .eq('is_active', true)
        .eq('platform', targetPlatform)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Release[]
    },
  })

  if (q.isLoading) {
    return (
      <div className="rounded-2xl border p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading release notes…
        </div>
        <div className="space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (q.isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Could not load release notes.
      </div>
    )
  }

  const releases = q.data ?? []
  if (!releases.length) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <FileText className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No release notes yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Release notes</h3>
        <span className="ml-auto text-xs text-muted-foreground capitalize">
          {targetPlatform}
        </span>
      </div>
      <Accordion type="single" collapsible defaultValue={releases[0]?.id} className="px-2">
        {releases.map((r) => (
          <AccordionItem key={r.id} value={r.id} className="border-b last:border-b-0">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                <span className="font-semibold">v{r.version}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {r.changelog && r.changelog.trim() ? (
                <ChangelogMarkdown content={r.changelog} className="pb-2" />
              ) : (
                <p className="pb-2 text-sm italic text-muted-foreground">
                  No release notes were provided for this version.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export default ReleaseNotesAccordion
