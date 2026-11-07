import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Check, Copy, Gift, MessageCircle, PenSquare, Share2, Sparkles, Trophy, UserPlus, Vote } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { toast } from '@/lib/toast'
import { getMyRewards } from '@/lib/engagement'
import { MY_REWARDS_KEY } from '@/components/engagement/DailyRewardCard'
import { claimRememberedInvite, getLgaOfTheMonth, getMyInvite, inviteLink, rememberInvite } from '@/lib/community'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CollapsibleCard } from './CollapsibleCard'

function Card({
  title,
  icon: Icon,
  version,
  action,
  children,
  className,
}: {
  title: string
  icon: typeof Trophy
  version?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <CollapsibleCard
      name={title}
      version={version}
      action={action}
      className={className}
      title={
        <>
          <Icon className="size-[18px] text-primary" /> {title}
        </>
      }
    >
      {children}
    </CollapsibleCard>
  )
}

/** A few small things to do today, using the points members already earn. Each one goes away once done. */
export function JoinInTodayCard({ className }: { className?: string }) {
  const { user } = useAuth()
  const rewardsQ = useQuery({ queryKey: MY_REWARDS_KEY, enabled: !!user, queryFn: getMyRewards, staleTime: 60_000, refetchOnMount: 'always' })
  const r = rewardsQ.data
  if (!r) return null
  const today = (r.today ?? {}) as Record<string, number>
  const tasks = [
    { label: 'Check in today', points: '+10', done: r.claimed_today, to: '/rewards', icon: Gift },
    { label: 'Answer a post that needs a reply', points: '+5', done: !!today.reply, to: '/?feed=unanswered', icon: MessageCircle },
    { label: 'Start a discussion', points: '+15', done: !!today.thread, to: '/create-thread', icon: PenSquare },
    { label: 'Vote in a poll or contest', points: '+2', done: !!today.poll_vote || !!today.contest_vote, to: '/contests', icon: Vote },
  ]
  const left = tasks.filter((t) => !t.done)
  if (!left.length) return null
  return (
    <Card
      title="Join in today"
      icon={Sparkles}
      version={new Date().toDateString()}
      className={className}
      action={<span className="shrink-0 text-xs font-medium text-muted-foreground">{left.length} left</span>}
    >
      <ul className="divide-y divide-border">
        {left.map((t) => (
          <li key={t.label}>
            <Link to={t.to} className="flex items-center gap-2.5 py-2.5 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <t.icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 font-semibold">{t.label}</span>
              <span className="shrink-0 rounded-full bg-amber-400/20 px-2 text-xs font-bold leading-5 text-amber-800 dark:text-amber-300">{t.points}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const PAGE_STEPS: Array<{ field: string; next: string }> = [
  { field: 'avatar_url', next: 'Add your picture' },
  { field: 'bio', next: 'Add a short bio' },
  { field: 'lga', next: 'Add your LGA' },
  { field: 'occupation', next: 'Add what you do' },
  { field: 'current_location', next: 'Add where you live' },
  { field: 'display_name', next: 'Add your name' },
]

/** "Your page is 70% ready", with the next step. Hidden once the page is complete. */
export function PageProgressBar({ profile, className }: { profile: Record<string, unknown>; className?: string }) {
  const missing = PAGE_STEPS.filter((s) => !profile[s.field])
  if (!missing.length || !Object.keys(profile).length) return null
  const percent = Math.round(((PAGE_STEPS.length - missing.length) / PAGE_STEPS.length) * 100)
  return (
    <Link to="/profile" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-primary/10 px-3.5 py-2.5 text-sm', className)}>
      <span className="font-bold">Your page is {percent}% ready</span>
      <span className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </span>
      <span className="font-bold text-primary">{missing[0].next} →</span>
    </Link>
  )
}

/** Local pride: which LGA is helping the most this month. Waits for real activity. */
export function LgaOfTheMonthCard({ className }: { className?: string }) {
  const lgaQ = useQuery({ queryKey: ['lga-of-the-month'], queryFn: getLgaOfTheMonth, staleTime: 10 * 60_000 })
  const rows = lgaQ.data ?? []
  if (!rows.length || rows[0].score < 5) return null
  return (
    <Card title="LGA of the month" icon={Trophy} className={className}>
      <p className="text-[15px] font-extrabold">{rows[0].lga} is leading 🏆</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Most helpful replies and new members this month</p>
      {rows.length > 1 ? (
        <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
          {rows.slice(1).map((r, i) => (
            <li key={r.lga}>
              {i + 2}. {r.lga}
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  )
}

/** A member's personal invite link. */
export function InviteCard({ className }: { className?: string }) {
  const { user } = useAuth()
  const inviteQ = useQuery({ queryKey: ['my-invite', user?.id], enabled: !!user, queryFn: getMyInvite, staleTime: 5 * 60_000 })
  const invite = inviteQ.data
  if (!invite) return null
  const link = inviteLink(invite.code)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }
  const share = async () => {
    try {
      await navigator.share({ title: 'Join me on AbiaConnect', text: 'Join me on AbiaConnect, the home for Abians everywhere.', url: link })
    } catch {
      // The member closed the share sheet.
    }
  }
  return (
    <Card title="Invite your people" icon={UserPlus} className={className}>
      <p className="text-sm text-muted-foreground">Earn 30 points when someone you invite makes their first post.</p>
      {invite.joined ? (
        <p className="mt-1.5 text-sm font-semibold">
          {invite.joined} joined · {invite.posted} posted
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        {typeof navigator.share === 'function' ? (
          <Button size="sm" className="flex-1 rounded-full" onClick={share}>
            <Share2 className="size-4" /> Share
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={copy}>
          <Copy className="size-4" /> Copy link
        </Button>
      </div>
    </Card>
  )
}

/** A way in to the jobs and services board. */
export function OpportunitiesCard({ className }: { className?: string }) {
  return (
    <Link to="/opportunities" className={cn('flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40', className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Briefcase className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold">Jobs and services</span>
        <span className="block text-xs text-muted-foreground">Who is hiring, who offers what, in which LGA</span>
      </span>
    </Link>
  )
}

/** Remembers an invite from the link, then counts it once the member is signed in. */
export function InviteClaimer() {
  const { user } = useAuth()
  const { search } = useLocation()
  const { data: profile } = useProfile()
  useEffect(() => {
    rememberInvite(search)
  }, [search])
  useEffect(() => {
    if (user && profile) void claimRememberedInvite()
  }, [user, profile])
  return null
}
