import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ModerationSurface, ModerationResult } from '@/lib/moderateContent'

interface BlockedPayload extends ModerationResult {
  surface: ModerationSurface
  excerpt?: string
}

const EVENT = 'abia:moderation-blocked'

/**
 * Imperatively open the moderation block dialog from anywhere.
 * Call this instead of (or in addition to) toast.error when content is rejected.
 */
export function showModerationBlocked(payload: BlockedPayload) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<BlockedPayload>(EVENT, { detail: payload }))
}

const SURFACE_LABEL: Record<ModerationSurface, string> = {
  thread: 'Thread',
  reply: 'Reply',
  message: 'Message',
  subgroup: 'Subgroup',
}

export function ModerationBlockedDialog() {
  const [payload, setPayload] = useState<BlockedPayload | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BlockedPayload>).detail
      if (detail) setPayload(detail)
    }
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])

  const open = !!payload
  const label = payload ? SURFACE_LABEL[payload.surface] ?? 'Content' : 'Content'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPayload(null) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle className="text-center">
            {label} blocked by AI moderation
          </DialogTitle>
          <DialogDescription className="text-center">
            Our automated review flagged this content as a possible violation of the
            community guidelines. It was not posted.
          </DialogDescription>
        </DialogHeader>

        {payload?.reason && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive mb-1">Reason</p>
            <p className="text-foreground/90 whitespace-pre-wrap break-words">
              {payload.reason}
            </p>
          </div>
        )}

        {payload?.categories && payload.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {payload.categories.map((c) => (
              <Badge key={c} variant="destructive" className="capitalize">
                {c.replace(/[_-]/g, ' ')}
              </Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Think this is a mistake? Edit your wording and try again, or contact an
          admin to request a review.
        </p>

        <DialogFooter>
          <Button onClick={() => setPayload(null)} className="w-full sm:w-auto">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModerationBlockedDialog
