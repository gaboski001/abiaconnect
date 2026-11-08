import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { claimVolunteerPowers, TEAM_ROLE_NAMES } from '@/lib/volunteerTeam'

const KEY = 'volunteer-claim-checked'

/**
 * A volunteer approved before they had an account gets their tools the first
 * time they sign in with the email they applied with. Checked once per session.
 */
export function VolunteerPowersClaimer() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    const mark = `${KEY}:${user.id}`
    try {
      if (sessionStorage.getItem(mark)) return
      sessionStorage.setItem(mark, '1')
    } catch {
      // No session storage: checking again later is harmless.
    }
    void claimVolunteerPowers().then((role) => {
      if (!role) return
      qc.invalidateQueries({ queryKey: ['volunteer-powers'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      const tools = role === 'moderator' || role === 'writer' || role === 'social'
      toast.success(`Welcome to the team! You are now ${TEAM_ROLE_NAMES[role]}.`, {
        description: tools ? 'Your tools are in the menu under Moderator tools.' : 'See your notifications for what happens next.',
        action: tools ? { label: 'Open', onClick: () => navigate('/moderate') } : undefined,
        duration: 10_000,
      })
    })
  }, [user, qc, navigate])

  return null
}

export default VolunteerPowersClaimer
