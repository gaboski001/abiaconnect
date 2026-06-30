import { useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SEO } from '@/components/SEO'

export default function SubgroupInvite() {
  const { token } = useParams<{ token: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (loading || ran.current || !token) return
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/subgroups/invite/${token}`)}`, { replace: true })
      return
    }
    ran.current = true
    ;(async () => {
      const { data, error } = await (supabase as any).rpc('redeem_subgroup_invite', { _token: token })
      if (error) {
        toast.error(error.message || 'Invite is invalid or expired')
        navigate('/subgroups', { replace: true })
        return
      }
      toast.success('Joined subgroup')
      navigate(`/subgroups/${data}`, { replace: true })
    })()
  }, [token, user, loading, navigate])

  return (
    <div className="container mx-auto px-4 py-12 max-w-md text-center space-y-4">
      <SEO
        title="Accept Subgroup Invitation"
        description="Redeeming your AbiaConnect subgroup invite. Once verified you'll join the subgroup and gain access to its discussions and members."
        path="/subgroups/invite"
      />
      <h1 className="text-xl font-semibold">Redeeming invite…</h1>
      <Skeleton className="h-8 w-full" />
      <Button asChild variant="ghost"><Link to="/subgroups">Cancel</Link></Button>
    </div>
  )
}
