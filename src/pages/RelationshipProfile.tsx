import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  Handshake,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  PenLine,
  Pencil,
  Ruler,
  ShieldAlert,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { SEO } from '@/components/SEO'
import { UserAvatar } from '@/components/ui/UserAvatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  blockRelationshipUser,
  calcAge,
  isPersonalReason,
  RelationshipCard,
  RelationshipProfile,
} from '@/lib/relationship'
import { getConnectSummary, getMemberPosts, toggleFollow, togglePhotoLike, type ConnectSummary } from '@/lib/connect'
import { isValidHttpUrl } from '@/lib/images'
import { useStartDatingChat } from '@/hooks/useStartDatingChat'
import { reactToProfile } from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'
import { PaywallDialog } from '@/components/dating/PaywallDialog'
import { MatchDialog, type MatchPartner } from '@/components/dating/MatchDialog'
import { ReasonBadge } from '@/components/connect/ReasonBadge'
import { cn } from '@/lib/utils'

async function loadProfile(userId: string): Promise<RelationshipCard | null> {
  const { data, error } = await supabase
    .from('relationship_profiles' as never)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as RelationshipProfile
  const { data: profiles } = await supabase.rpc('get_public_profiles', { _ids: [userId] })
  const p = (profiles ?? [])[0] as any
  return {
    ...row,
    display_name: p?.display_name ?? null,
    username: p?.username ?? null,
    avatar_url: p?.avatar_url ?? null,
  }
}

export default function RelationshipProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const chat = useStartDatingChat()
  const [liking, setLiking] = useState(false)
  const [following, setFollowing] = useState(false)
  const [likePaywall, setLikePaywall] = useState(false)
  const [match, setMatch] = useState<MatchPartner | null>(null)
  const { data: myReaction, refetch: refetchReaction } = useQuery({
    queryKey: ['dating-my-reaction', userId],
    enabled: !!userId && !!user && user.id !== userId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('dating_likes').select('kind').eq('liked_id', userId).maybeSingle()
      return (data?.kind as 'like' | 'pass' | undefined) ?? null
    },
  })

  const { data: card, isLoading, error } = useQuery({
    queryKey: ['relationship-profile', userId],
    enabled: !!userId,
    queryFn: () => loadProfile(userId!),
  })

  const summaryKey = ['connect-summary', userId]
  const { data: summary } = useQuery({
    queryKey: summaryKey,
    enabled: !!userId && !!user,
    queryFn: () => getConnectSummary(userId!),
    retry: false,
  })

  const { data: posts } = useQuery({
    queryKey: ['connect-posts', userId],
    enabled: !!userId && !!user,
    queryFn: () => getMemberPosts(userId!),
    retry: false,
  })

  // Realtime: refresh when this user's relationship profile changes (photos, etc.)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`relationship-profile-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'relationship_profiles', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['relationship-profile', userId] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  const startChat = () => {
    if (user && card) chat.start(card.user_id)
  }

  const like = async () => {
    if (!user || !card || liking) return
    setLiking(true)
    try {
      const r = await reactToProfile(card.user_id, 'like')
      if (r.status === 'limit_reached') setLikePaywall(true)
      else if (r.status === 'profile_required') {
        toast.error(t('discover.profile_required'))
        navigate('/relationship/edit')
      } else if (r.status !== 'ok') toast.error(t('discover.unavailable'))
      else {
        if (r.matched) setMatch({ userId: card.user_id, name: card.display_name || card.username || 'them' })
        else toast.success(`Request sent to ${card.display_name || card.username || 'them'}`)
        refetchReaction()
        queryClient.invalidateQueries({ queryKey: ['dating-my-reactions'] })
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLiking(false)
    }
  }

  const follow = async () => {
    if (!card || following) return
    setFollowing(true)
    try {
      const r = await toggleFollow(card.user_id)
      if (r.status !== 'ok') toast.error(t('discover.unavailable'))
      else {
        queryClient.setQueryData<ConnectSummary | null>(summaryKey, (prev) =>
          prev ? { ...prev, is_following: !!r.following, followers: r.followers ?? prev.followers } : prev,
        )
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setFollowing(false)
    }
  }

  const likePhoto = async (photo: string) => {
    if (!card) return
    try {
      const r = await togglePhotoLike(card.user_id, photo)
      if (r.status !== 'ok') toast.error(t('discover.unavailable'))
      else {
        queryClient.setQueryData<ConnectSummary | null>(summaryKey, (prev) =>
          prev
            ? { ...prev, photo_likes: { ...prev.photo_likes, [photo]: { likes: r.likes ?? 0, liked: !!r.liked } } }
            : prev,
        )
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    }
  }

  const block = async () => {
    if (!card) return
    try {
      await blockRelationshipUser(card.user_id)
      toast.success('User blocked')
      navigate('/relationship')
    } catch (e: any) {
      toast.error(e.message || 'Could not block')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-muted-foreground">Profile not found.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/relationship"><ArrowLeft className="size-4" /> Back</Link>
        </Button>
      </div>
    )
  }

  const name = card.display_name || card.username || 'Member'
  const mine = !!user && user.id === card.user_id
  const personal = isPersonalReason(card.looking_for)
  const age = personal ? calcAge(card.dob) : null
  const photos = (card.photos ?? []).filter(isValidHttpUrl)
  const postCount = Number(posts?.[0]?.total ?? 0)
  const hasWorkDetails = !!(card.occupation || card.business_name || card.work_experience || card.services)

  return (
    <div className="max-w-3xl mx-auto">
      <SEO title={`${name} on Connect`} description={card.headline || 'Meet Abia members on AbiaConnect.'} path={`/relationship/${card.user_id}`} />
      <Button asChild variant="ghost" className="mb-2">
        <Link to="/relationship"><ArrowLeft className="size-4" /> Back to Connect</Link>
      </Button>

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="relative h-32 bg-gradient-to-br from-emerald-700 to-emerald-950 sm:h-44">
          <CoverImage rawCover={photos[0] ?? null} name={name} />
        </div>
        <div className="px-4 pb-4 sm:px-6">
          <UserAvatar avatarUrl={card.avatar_url} displayName={name} size="xl" className="relative -mt-10 border-4 border-card" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-extrabold leading-tight sm:text-2xl">
              {name}{age ? `, ${age}` : ''}
            </h1>
            <ReasonBadge reason={card.looking_for} className="text-xs" />
          </div>
          {card.username && <p className="text-sm text-muted-foreground">@{card.username}</p>}
          {card.headline && <p className="mt-2 text-[15px] font-medium">{card.headline}</p>}
          {(card.current_location || card.lga) && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" /> {card.current_location || card.lga}
            </p>
          )}

          {summary && (
            <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border text-center">
              <Stat label="Followers" value={summary.followers} to={mine ? '/relationship/people?tab=followers' : undefined} />
              <Stat label="Following" value={summary.following} to={mine ? '/relationship/people?tab=following' : undefined} />
              <Stat label="Posts" value={postCount} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {mine ? (
              <>
                <Button asChild className="rounded-full">
                  <Link to="/relationship/edit"><Pencil className="size-4" /> Edit profile</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/create-thread"><PenLine className="size-4" /> Write a post</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/relationship/people?tab=photo_likes"><Heart className="size-4" /> Photo likes</Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={follow}
                  disabled={following || !user || !summary}
                  variant={summary?.is_following ? 'outline' : 'default'}
                  className="rounded-full"
                >
                  {following ? <Loader2 className="size-4 animate-spin" /> : summary?.is_following ? <Check className="size-4" /> : <UserPlus className="size-4" />}
                  {summary?.is_following ? 'Following' : 'Follow'}
                </Button>
                <Button
                  onClick={like}
                  disabled={liking || !user || myReaction === 'like'}
                  variant="outline"
                  className="rounded-full"
                >
                  {liking ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />}
                  {myReaction === 'like' ? t('profile.liked') : t('profile.like')}
                </Button>
                <Button
                  onClick={startChat}
                  variant="outline"
                  disabled={!!chat.busyWith || !user}
                  className="rounded-full"
                >
                  {chat.busyWith ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                  {t('profile.chat')}
                </Button>
                {user && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="rounded-full text-muted-foreground">
                        <ShieldAlert className="size-4" /> Block
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Block {name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They won't see your Connect profile, won't appear in your feed and can't message you.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={block}>Block</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}
          </div>
          {user && !mine && <p className="mt-2 text-xs text-muted-foreground">{t('profile.match_hint')}</p>}
        </div>
      </section>

      <PaywallDialog
        reason="message_first"
        open={chat.paywallOpen}
        onOpenChange={chat.setPaywallOpen}
        onSecondary={myReaction === 'like' ? undefined : like}
      />
      <PaywallDialog reason="likes_limit" open={likePaywall} onOpenChange={setLikePaywall} />
      <MatchDialog partner={match} onClose={() => setMatch(null)} />

      <div className="mt-4 space-y-4">
        {mine && !card.looking_for && (
          <Link to="/relationship/edit" className="block rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-medium">
            Tell people why you are here, so the right ones can find you. Tap to add it.
          </Link>
        )}

        {hasWorkDetails && !personal && (
          <Section title="Work and business">
            <div className="space-y-3">
              <Detail icon={<Briefcase className="size-4" />} label="Occupation" value={card.occupation} />
              <Detail icon={<Building2 className="size-4" />} label="Business or company" value={card.business_name} />
              <Detail icon={<Users className="size-4" />} label="Work experience" value={card.work_experience} />
              <Detail icon={<Wrench className="size-4" />} label="Services offered" value={card.services} />
            </div>
          </Section>
        )}

        {card.about && (
          <Section title="About">
            <p className="whitespace-pre-line text-sm text-muted-foreground">{card.about}</p>
          </Section>
        )}

        {personal && (card.occupation || card.marital_status || card.height_cm) && (
          <Section title="Details">
            <div className="space-y-3">
              <Detail icon={<Briefcase className="size-4" />} label="Occupation" value={card.occupation} />
              <Detail icon={<Heart className="size-4" />} label="Marital status" value={card.marital_status ? String(card.marital_status).replace(/_/g, ' ') : null} />
              <Detail icon={<Ruler className="size-4" />} label="Height" value={card.height_cm ? `${card.height_cm} cm` : null} />
            </div>
          </Section>
        )}

        {card.interests?.length > 0 && (
          <Section title="Skills and interests">
            <div className="flex flex-wrap gap-1.5">
              {card.interests.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {photos.length > 0 && (
          <Section title="Photos">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p) => (
                <GalleryImage
                  key={p}
                  src={p}
                  likes={summary?.photo_likes?.[p]?.likes ?? 0}
                  liked={!!summary?.photo_likes?.[p]?.liked}
                  canLike={!mine && !!summary}
                  onLike={() => likePhoto(p)}
                />
              ))}
            </div>
          </Section>
        )}

        <Section title={mine ? 'Your posts' : `Posts by ${name}`}>
          {posts?.length ? (
            <ul className="divide-y divide-border">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link to={`/thread/${post.id}`} className="block py-2.5">
                    <p className="line-clamp-2 text-sm font-semibold">{post.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {post.place ? `${post.place} · ` : ''}
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {mine ? 'Share a post in the forum and it will show here, so people can find and follow you.' : 'No public posts yet.'}
            </p>
          )}
        </Section>
      </div>
    </div>
  )
}

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <>
      <span className="block text-lg font-extrabold leading-tight">{value}</span>
      <span className="block text-xs text-muted-foreground">{label}</span>
    </>
  )
  return to ? (
    <Link to={to} className="py-2.5">{body}</Link>
  ) : (
    <div className="py-2.5">{body}</div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  )
}

function CoverImage({ rawCover, name }: { rawCover: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [rawCover])
  if (!rawCover || broken) return null
  return (
    <img
      src={rawCover}
      alt={name}
      onError={() => setBroken(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}

function GalleryImage({
  src,
  likes,
  liked,
  canLike,
  onLike,
}: {
  src: string
  likes: number
  liked: boolean
  canLike: boolean
  onLike: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted/60 to-muted" />}
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setHidden(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {(canLike || likes > 0) && (
        <button
          type="button"
          onClick={onLike}
          disabled={!canLike}
          aria-pressed={liked}
          aria-label={liked ? 'Remove your like from this photo' : 'Like this photo'}
          className="absolute bottom-1.5 right-1.5 inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full bg-black/60 px-2 text-xs font-bold text-white"
        >
          <Heart className={cn('size-4', liked && 'fill-rose-500 text-rose-500')} />
          {likes > 0 && likes}
        </button>
      )}
    </div>
  )
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-emerald-700 dark:text-emerald-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="whitespace-pre-line break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
