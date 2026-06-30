import { useEffect, useState } from 'react'
import { ShieldAlert, MessageSquare, ArrowLeft } from 'lucide-react'
import { toast } from '@/lib/toast'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import type { ModerationSurface, ModerationResult } from '@/lib/moderateContent'

interface BlockedPayload extends ModerationResult {
  surface: ModerationSurface
  /** Original content the user tried to post — needed so admins can review the appeal. */
  content?: string
  title?: string
}

const EVENT = 'abia:moderation-blocked'

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

const NOTE_MIN = 5
const NOTE_MAX = 1000

export function ModerationBlockedDialog() {
  const [payload, setPayload] = useState<BlockedPayload | null>(null)
  const [view, setView] = useState<'blocked' | 'appeal'>('blocked')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BlockedPayload>).detail
      if (detail) {
        setPayload(detail)
        setView('blocked')
        setNote('')
      }
    }
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])

  const open = !!payload
  const label = payload ? SURFACE_LABEL[payload.surface] ?? 'Content' : 'Content'

  const close = () => {
    setPayload(null)
    setView('blocked')
    setNote('')
  }

  const submitAppeal = async () => {
    if (!payload) return
    const trimmed = note.trim()
    if (trimmed.length < NOTE_MIN) {
      toast.error(`Please add at least ${NOTE_MIN} characters explaining your appeal.`)
      return
    }
    if (trimmed.length > NOTE_MAX) {
      toast.error(`Appeal note must be ${NOTE_MAX} characters or less.`)
      return
    }
    const content = (payload.content ?? '').trim()
    if (!content) {
      toast.error('Cannot submit appeal: original content is missing.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('submit_moderation_appeal', {
        _surface: payload.surface,
        _original_content: content,
        _original_title: payload.title ?? '',
        _reason_shown: payload.reason ?? '',
        _categories: payload.categories ?? [],
        _user_note: trimmed,
      })
      if (error) {
        // Surface rate-limit errors clearly.
        const msg = error.message?.includes('Rate limit')
          ? 'You have submitted too many appeals recently. Please try again later.'
          : error.message || 'Could not submit appeal. Please try again.'
        toast.error(msg)
        return
      }
      toast.success('Appeal submitted. An admin will review it shortly.')
      close()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent className="sm:max-w-md">
        {view === 'blocked' && (
          <>
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
              Think this is a mistake? Edit your wording and try again, or appeal to
              moderators for a manual review.
            </p>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={close} className="w-full sm:w-auto">
                Close
              </Button>
              <Button
                onClick={() => setView('appeal')}
                disabled={!payload?.content}
                className="w-full sm:w-auto gap-2"
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                Appeal to moderators
              </Button>
            </DialogFooter>
          </>
        )}

        {view === 'appeal' && (
          <>
            <DialogHeader>
              <DialogTitle>Appeal to moderators</DialogTitle>
              <DialogDescription>
                Briefly explain why you believe this {label.toLowerCase()} should be
                allowed. An admin will review your note alongside the original content.
              </DialogDescription>
            </DialogHeader>

            {payload?.content && (
              <div className="rounded-md border bg-muted/40 p-3 text-xs max-h-32 overflow-y-auto">
                <p className="font-medium mb-1 text-muted-foreground">Your content</p>
                <p className="whitespace-pre-wrap break-words text-foreground/90">
                  {payload.content.slice(0, 600)}
                  {payload.content.length > 600 ? '…' : ''}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="appeal-note">Your note</Label>
              <Textarea
                id="appeal-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                placeholder="Explain why this was flagged in error…"
                rows={4}
                disabled={submitting}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {note.length}/{NOTE_MAX}
              </p>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setView('blocked')}
                disabled={submitting}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              <Button
                onClick={submitAppeal}
                disabled={submitting || note.trim().length < NOTE_MIN}
              >
                {submitting ? 'Submitting…' : 'Submit appeal'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ModerationBlockedDialog
