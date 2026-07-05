import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Sparkles, Loader2 } from 'lucide-react'
import { ChangelogMarkdown } from './ChangelogMarkdown'

interface ChangelogModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  version: string
  currentVersion?: string | null
  platform: 'android' | 'ios' | 'web'
  sizeMb?: string | null
  changelog?: string | null
  isLoading?: boolean
  onDownload?: () => void | Promise<void>
  downloading?: boolean
}

export function ChangelogModal({
  open,
  onOpenChange,
  version,
  currentVersion,
  platform,
  sizeMb,
  changelog,
  isLoading = false,
  onDownload,
  downloading = false,
}: ChangelogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="border-b bg-gradient-to-br from-amber-500/10 via-transparent to-transparent px-6 pt-6 pb-4">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15">
            <Sparkles className="h-5 w-5 text-amber-500" />
          </div>
          <DialogTitle className="text-lg">What's new in v{version}</DialogTitle>
          <DialogDescription className="text-xs">
            {currentVersion ? `You're on v${currentVersion} · ` : ''}
            {platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Web'}
            {sizeMb ? ` · ${sizeMb} MB` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="mt-4 h-3 w-1/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
            </div>
          ) : changelog && changelog.trim() ? (
            <ChangelogMarkdown content={changelog} />
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No release notes were provided for this update.
            </p>
          )}
        </div>

        {onDownload && (
          <div className="border-t px-6 py-4">
            <Button
              onClick={onDownload}
              disabled={downloading}
              className="w-full gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing download…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download v{version}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ChangelogModal
