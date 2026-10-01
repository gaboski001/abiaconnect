import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startDatingChat } from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'
import { toast } from '@/lib/toast'

/**
 * Opens a chat from the Relationship area. The server decides: matches (and
 * plans with "message before matching") get a chat; otherwise the caller
 * shows the "match first" paywall.
 */
export function useStartDatingChat() {
  const navigate = useNavigate()
  const [busyWith, setBusyWith] = useState<string | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)

  const start = async (userId: string, onOpened?: () => void) => {
    if (busyWith) return
    setBusyWith(userId)
    try {
      const r = await startDatingChat(userId)
      if (r.status === 'ok' && r.conversation_id) {
        onOpened?.()
        navigate(`/messages/${r.conversation_id}`)
      } else if (r.status === 'match_required') {
        setPaywallOpen(true)
      } else if (r.status === 'messages_off') {
        toast.error(t('discover.messages_off'))
      } else if (r.status === 'connections_only') {
        toast.error(t('discover.connections_only'))
      } else if (r.status === 'account_restricted') {
        toast.error(t('discover.restricted'))
      } else {
        toast.error(t('discover.unavailable'))
      }
    } catch {
      toast.error('Could not open the chat. Please try again.')
    } finally {
      setBusyWith(null)
    }
  }

  return { start, busyWith, paywallOpen, setPaywallOpen }
}
