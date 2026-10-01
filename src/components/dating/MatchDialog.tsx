import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { startConversationWith } from '@/lib/relationship'
import { t } from '@/lib/monetization/strings'
import { toast } from '@/lib/toast'

export interface MatchPartner {
  userId: string
  name: string
}

export function MatchDialog({ partner, onClose }: { partner: MatchPartner | null; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const message = async () => {
    if (!partner || !user || busy) return
    setBusy(true)
    try {
      const convo = await startConversationWith(partner.userId, user.id)
      onClose()
      navigate(`/messages/${convo}`)
    } catch {
      toast.error('Could not open the chat. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!partner} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/40">
          <Heart className="size-8 text-white" fill="white" aria-hidden />
        </div>
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl">{t('match.title')}</DialogTitle>
          <DialogDescription>{t('match.body', { name: partner?.name ?? '' })}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white" onClick={message} disabled={busy}>
            <MessageCircle className="size-4" /> {t('match.message')}
          </Button>
          <Button variant="ghost" className="w-full rounded-full" onClick={onClose}>
            {t('match.keep')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MatchDialog
