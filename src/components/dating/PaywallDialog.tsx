import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { canPurchaseHere, track } from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'

export type PaywallReason = 'likes_limit' | 'see_likes'

const COPY = {
  likes_limit: { title: 'paywall.likes.title', body: 'paywall.likes.body', cta: 'paywall.likes.cta', dismiss: 'paywall.likes.later', Icon: Heart },
  see_likes: { title: 'paywall.see_likes.title', body: 'paywall.see_likes.body', cta: 'paywall.see_likes.cta', dismiss: 'paywall.not_now', Icon: Crown },
} as const

/**
 * Contextual upgrade prompt, shown only when the user actually hits a premium
 * feature. Never shown with fake urgency; dismissing is always one tap.
 */
export function PaywallDialog({
  reason,
  open,
  onOpenChange,
}: {
  reason: PaywallReason
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const copy = COPY[reason]
  const purchasable = canPurchaseHere()

  useEffect(() => {
    if (open) track('PAYWALL_VIEWED', { reason })
  }, [open, reason])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/30">
          <copy.Icon className="size-7 text-white" aria-hidden />
        </div>
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl">{t(copy.title)}</DialogTitle>
          <DialogDescription>
            {purchasable ? t(copy.body) : t('pricing.app_store_notice')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {purchasable && (
            <Button
              className="w-full rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white hover:opacity-95"
              onClick={() => {
                onOpenChange(false)
                navigate('/relationship/premium')
              }}
            >
              <Crown className="size-4" /> {t(copy.cta)}
            </Button>
          )}
          <Button variant="ghost" className="w-full rounded-full" onClick={() => onOpenChange(false)}>
            {t(copy.dismiss)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PaywallDialog
