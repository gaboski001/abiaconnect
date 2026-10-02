import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Facebook, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

/**
 * Admin-only "Share to Facebook" button for a thread. The server decides:
 * anonymous threads, private-group threads and removed threads are refused,
 * and a thread is never posted twice. Popular threads may also be shared
 * automatically; this button shows that status too.
 */
export function FacebookShareButton({ threadId }: { threadId: string }) {
  const qc = useQueryClient()
  const key = ['facebook-share', threadId]

  const { data: share } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facebook_shares')
        .select('status, source, fb_post_id, note')
        .eq('thread_id', threadId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    // While it is being posted, check again shortly.
    refetchInterval: (q) => (['queued', 'posting', 'removing'].includes(q.state.data?.status ?? '') ? 4000 : false),
  })

  const shareNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('share_thread_to_facebook', { _thread_id: threadId })
      if (error) throw error
      return data
    },
    onSuccess: (status) => {
      toast.success(status === 'posted' ? 'Already on Facebook' : 'Sharing to your Facebook Page…')
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (e: Error) => toast.error('Could not share to Facebook', { description: e.message }),
  })

  const status = share?.status
  if (status === 'posted') {
    return (
      <Button size="sm" variant="ghost" asChild>
        <a href={`https://www.facebook.com/${share?.fb_post_id ?? ''}`} target="_blank" rel="noopener noreferrer">
          <Facebook /> On Facebook{share?.source === 'popular' ? ' (popular)' : ''}
        </a>
      </Button>
    )
  }
  if (status === 'queued' || status === 'posting' || status === 'removing') {
    return (
      <Button size="sm" variant="ghost" disabled>
        <Loader2 className="animate-spin" /> {status === 'removing' ? 'Removing from Facebook…' : 'Sharing to Facebook…'}
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => shareNow.mutate()}
      disabled={shareNow.isPending}
      title={status === 'failed' && share?.note ? `Last attempt failed: ${share.note}` : 'Post this thread on the AbiaConnect Facebook Page'}
    >
      <Facebook /> {status === 'failed' ? 'Retry Facebook share' : 'Share to Facebook'}
    </Button>
  )
}
