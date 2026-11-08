import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Briefcase, Building2, Heart, MapPin, MessageCircle, Navigation, Pencil, Share2, Sparkles, Wrench } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { BADGES } from '@/lib/engagement'
import { getConnectSummary, getMemberPosts } from '@/lib/connect'
import { getMemberPage, useFollowingIds, useMemberLabels } from '@/lib/community'
import { startConversationWith } from '@/lib/relationship'
import { isValidHttpUrl } from '@/lib/images'
import { APP_HEADER_GRADIENT } from '@/lib/mobileBrand'
import { ViewableAvatar } from '@/components/ui/ViewableAvatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReasonBadge } from '@/components/connect/ReasonBadge'
import { FollowMemberButton, MemberMarks } from '@/components/community/PostCard'
import { PageProgressBar } from '@/components/community/CommunityCards'
import { cn } from '@/lib/utils'

type PageTab = 'posts' | 'photos' | 'work' | 'badges'

/**
 * A member's one public page: who they are, their posts, photos, work and
 * badges. Dating details stay on their Connect profile, which is linked from here.
 */
export default function MemberPage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<PageTab>('posts')
  const isSelf = !!user && user.id === userId

  const profileQ = useQuery({
    queryKey: ['member-profile', userId, isSelf],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = isSelf
        ? await supabase.rpc('get_my_profile')
        : await supabase.rpc('get_public_profiles', { _ids: [userId as string] })
      if (error) throw error
      return ((Array.isArray(data) ? data[0] : data) ?? null) as Record<string, any> | null
    },
  })
  const pageQ = useQuery({ queryKey: ['member-page', userId], enabled: !!userId, queryFn: () => getMemberPage(userId!) })
  const summaryQ = useQuery({ queryKey: ['member-summary', userId], enabled: !!userId, queryFn: () => getConnectSummary(userId!).catch(() => null) })
  const postsQ = useQuery({ queryKey: ['member-posts', userId], enabled: !!userId, queryFn: () => getMemberPosts(userId!).catch(() => []) })
  const followingIds = useFollowingIds(user?.id).data ?? []
  const label = useMemberLabels([userId])[userId ?? '']

  const message = useMutation({
    mutationFn: () => startConversationWith(userId!, user!.id),
    onSuccess: (id) => navigate(`/messages/${id}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That didn’t work. Please try again.'),
  })

  const share = async () => {
    const url = `https://abiaconnect.com/member/${userId}`
    try {
      if (navigator.share) await navigator.share({ url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      // The member closed the share sheet.
    }
  }

  if (profileQ.isLoading) return <Skeleton className="mx-auto h-80 max-w-3xl rounded-2xl" />
  const profile = profileQ.data
  if (!profile || profile.is_deleted) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">This page isn’t available</h1>
        <p className="mt-1 text-sm text-muted-foreground">The member may have left or changed their privacy settings.</p>
      </div>
    )
  }

  const name = profile.display_name || profile.username || 'Member'
  const page = pageQ.data
  const photos = (page?.photos ?? []).filter((p) => isValidHttpUrl(p))
  const posts = postsQ.data ?? []
  const occupation = page?.occupation ?? profile.occupation ?? null
  const location = page?.current_location ?? profile.current_location ?? null
  const hasWork = !!(occupation || page?.work_experience || page?.business_name || page?.services)
  const tabs: Array<{ id: PageTab; label: string }> = [
    { id: 'posts', label: 'Posts' },
    { id: 'photos', label: 'Photos' },
    { id: 'work', label: 'Work' },
    { id: 'badges', label: 'Badges' },
  ]
  const stats = [
    { label: 'Followers', value: summaryQ.data?.followers ?? 0 },
    { label: 'Following', value: summaryQ.data?.following ?? 0 },
    { label: 'Posts', value: posts[0]?.total ?? 0 },
    { label: 'Reputation', value: profile.reputation ?? 0 },
  ]

  return (
    <div className="-mx-4 -mt-6 md:mx-auto md:mt-0 md:max-w-3xl native:-mt-4">
      <SEO title={`${name} on AbiaConnect`} description={`See ${name}'s posts and work on AbiaConnect.`} path={`/member/${userId}`} />
      <section className="overflow-hidden border-b border-border bg-card md:rounded-2xl md:border">
        <div className="h-24 md:h-32" style={{ backgroundImage: APP_HEADER_GRADIENT }} />
        <div className="px-4 pb-4 md:px-6">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <ViewableAvatar avatarUrl={profile.avatar_url} displayName={name} size="xl" className="size-24 border-4 border-card" />
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="Share this page" onClick={share}>
              <Share2 className="size-5" />
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <h1 className="text-2xl font-bold">{name}</h1>
            <MemberMarks label={label} />
          </div>
          {profile.username ? <p className="text-sm text-muted-foreground">@{profile.username}</p> : null}
          {page?.looking_for ? <ReasonBadge reason={page.looking_for} className="mt-2" /> : null}
          {page?.headline ? <p className="mt-2 text-[15px] font-semibold">{page.headline}</p> : null}
          {profile.bio ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p> : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            {occupation ? (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3.5" /> {occupation}
              </span>
            ) : null}
            {profile.lga ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {profile.lga}
              </span>
            ) : null}
            {location ? (
              <span className="inline-flex items-center gap-1">
                <Navigation className="size-3.5" /> {location}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-4 divide-x divide-border rounded-xl border border-border py-2.5 text-center">
            {stats.map((s) => {
              const body = (
                <>
                  <span className="block text-lg font-extrabold leading-tight">{s.value}</span>
                  <span className="block text-[11px] text-muted-foreground">{s.label}</span>
                </>
              )
              return isSelf && (s.label === 'Followers' || s.label === 'Following') ? (
                <Link key={s.label} to={`/relationship/people?tab=${s.label.toLowerCase()}`}>
                  {body}
                </Link>
              ) : (
                <div key={s.label}>{body}</div>
              )
            })}
          </div>

          {isSelf ? <PageProgressBar profile={profile} className="mt-3" /> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {isSelf ? (
              <>
                <Button asChild className="flex-1 rounded-full">
                  <Link to="/profile">
                    <Pencil className="size-4" /> Edit my page
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 rounded-full">
                  <Link to="/relationship/edit">
                    <Sparkles className="size-4" /> {page?.has_connect ? 'Edit work & Connect' : 'Add work details'}
                  </Link>
                </Button>
              </>
            ) : user ? (
              <>
                <FollowMemberButton
                  memberId={userId!}
                  following={followingIds.includes(userId!)}
                  className="flex-1 py-2 text-sm"
                />
                <Button variant="outline" className="flex-1 rounded-full" onClick={() => message.mutate()} disabled={message.isPending}>
                  <MessageCircle className="size-4" /> Message
                </Button>
              </>
            ) : null}
            {page?.has_connect ? (
              <Button asChild variant="ghost" className="rounded-full">
                <Link to={`/relationship/${userId}`}>
                  <Heart className="size-4" /> Connect profile
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex border-t border-border" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 border-b-2 py-3 text-sm font-semibold',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-2 space-y-2 px-4 md:px-0">
        {tab === 'posts' ? (
          posts.length ? (
            posts.map((p) => (
              <Link key={p.id} to={`/thread/${p.id}`} className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
                <span className="font-semibold">{p.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[p.place, formatDistanceToNow(new Date(p.created_at), { addSuffix: true })].filter(Boolean).join(' · ')}
                </span>
              </Link>
            ))
          ) : (
            <Empty text={isSelf ? 'Share your first post to start growing your followers.' : 'No public posts yet.'} action={isSelf ? { to: '/create-thread', label: 'Start a discussion' } : undefined} />
          )
        ) : null}

        {tab === 'photos' ? (
          photos.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                  <img src={src} alt={`${name}'s photo`} loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <Empty text="No photos to show." />
          )
        ) : null}

        {tab === 'work' ? (
          hasWork ? (
            <div className="space-y-2">
              {occupation ? <WorkRow icon={Briefcase} title="What they do" text={occupation} /> : null}
              {page?.business_name ? <WorkRow icon={Building2} title="Business" text={page.business_name} /> : null}
              {page?.services ? <WorkRow icon={Wrench} title="Services" text={page.services} /> : null}
              {page?.work_experience ? <WorkRow icon={Briefcase} title="Work experience" text={page.work_experience} /> : null}
            </div>
          ) : (
            <Empty text={isSelf ? 'Add your work or business so people can find you.' : 'No work details yet.'} action={isSelf ? { to: '/relationship/edit', label: 'Add work details' } : undefined} />
          )
        ) : null}

        {tab === 'badges' ? (
          page?.badges?.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {page.badges.map((b) => (
                <li key={b} className="rounded-2xl border border-border bg-card p-3 text-center">
                  <span className="block text-2xl">{BADGES[b]?.emoji ?? '🏅'}</span>
                  <span className="mt-1 block text-sm font-bold">{BADGES[b]?.name ?? b}</span>
                  {BADGES[b]?.description ? <span className="block text-xs text-muted-foreground">{BADGES[b].description}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No badges yet." />
          )
        ) : null}
      </div>
    </div>
  )
}

function Empty({ text, action }: { text: string; action?: { to: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {text}
      {action ? (
        <Button asChild size="sm" className="mt-3 flex w-fit rounded-full mx-auto">
          <Link to={action.to}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  )
}

function WorkRow({ icon: Icon, title, text }: { icon: typeof Briefcase; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="whitespace-pre-line text-sm">{text}</p>
      </div>
    </div>
  )
}
