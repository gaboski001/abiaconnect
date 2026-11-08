import { useState } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { cn } from '@/lib/utils'

type Props = React.ComponentProps<typeof UserAvatar> & { buttonClassName?: string }

/**
 * A profile picture you can tap to see it full size. Without a photo it is
 * just the letter avatar, with nothing to open.
 */
export function ViewableAvatar({ buttonClassName, ...avatar }: Props) {
  const [open, setOpen] = useState(false)
  const url = useSignedUrl(avatar.avatarUrl, 'avatars')
  const name = avatar.displayName || 'Member'

  if (!avatar.avatarUrl) return <UserAvatar {...avatar} />

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Inside a link (e.g. the menu's profile card) the photo opens instead of the link.
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`View ${name}'s profile picture`}
        className={cn('shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', buttonClassName)}
      >
        <UserAvatar {...avatar} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-0 bg-black/95 p-0 text-white [&>button]:hidden">
          <DialogTitle className="sr-only">{name}'s profile picture</DialogTitle>
          <DialogDescription className="sr-only">Tap outside the picture or the close button to go back.</DialogDescription>
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <p className="truncate text-sm font-semibold">{name}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close picture"
              className="rounded-full bg-white/10 p-1.5 hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex items-center justify-center p-4 pt-2">
            {url ? (
              <img src={url} alt={`${name}'s profile picture`} className="max-h-[75dvh] w-full rounded-xl object-contain" />
            ) : (
              <p className="py-16 text-sm text-white/70">Loading picture…</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ViewableAvatar
