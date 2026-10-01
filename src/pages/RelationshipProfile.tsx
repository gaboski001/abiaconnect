import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, Heart, MapPin, MessageCircle, Ruler, ShieldAlert, Loader2 } from 'lucide-react'
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
  LOOKING_FOR_LABELS,
  RelationshipCard,
  RelationshipProfile,
} from '@/lib/relationship'
import { isValidHttpUrl } from '@/lib/images'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { useStartDatingChat } from '@/hooks/useStartDatingChat'
import { reactToProfile } from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'
import { PaywallDialog } from '@/components/dating/PaywallDialog'
import { MatchDialog, type MatchPartner } from '@/components/dating/MatchDialog'

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
        else toast.success(`You liked ${card.display_name || card.username || 'them'}`)
        refetchReaction()
        queryClient.invalidateQueries({ queryKey: ['dating-my-reactions'] })
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLiking(false)
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
  const age = calcAge(card.dob)
  const rawCover = card.photos?.[0] ?? null
  const gallery = (card.photos ?? []).slice(1).filter(isValidHttpUrl)

  return (
    <div className="max-w-3xl mx-auto">
      <SEO title={`${name} — Relationship profile`} description={card.headline || 'Meet Abia members on AbiaConnect.'} path={`/relationship/${card.user_id}`} />
      <Button asChild variant="ghost" className="mb-3">
        <Link to="/relationship"><ArrowLeft className="size-4" /> Back to discover</Link>
      </Button>

      <div className="relative w-full aspect-[16/10] sm:aspect-[16/8] rounded-3xl overflow-hidden bg-gradient-to-br from-pink-500/20 to-rose-600/20 border border-border">
        <CoverImage rawCover={rawCover} avatarUrl={card.avatar_url} name={name} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <UserAvatar avatarUrl={card.avatar_url} displayName={name} size="lg" />
              <div className="min-w-0">
                <h1 className="line-clamp-2 break-words text-xl font-extrabold leading-tight sm:text-3xl">
                  {name}{age ? `, ${age}` : ''}
                </h1>
                {card.username && <p className="text-sm opacity-90">@{card.username}</p>}
              </div>
            </div>
          </div>
          {card.looking_for && (
            <span className="rounded-full bg-pink-600 text-white text-xs font-semibold px-3 py-1">
              {LOOKING_FOR_LABELS[card.looking_for]}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {user && user.id !== card.user_id && (
          <Button
            onClick={like}
            disabled={liking || myReaction === 'like'}
            className="rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white hover:opacity-95"
          >
            {liking ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" fill={myReaction === 'like' ? 'white' : 'none'} />}
            {myReaction === 'like' ? t('profile.liked') : t('profile.like')}
          </Button>
        )}
        <Button
          onClick={startChat}
          variant="outline"
          disabled={!!chat.busyWith || !user || user.id === card.user_id}
          className="rounded-full"
        >
          {chat.busyWith ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
          {t('profile.chat')}
        </Button>

        {user && user.id !== card.user_id && (
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
                  They won't see your Relationship profile and won't appear in your feed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={block}>Block</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {user && user.id !== card.user_id && (
        <p className="mt-2 text-xs text-muted-foreground">{t('profile.match_hint')}</p>
      )}
      <PaywallDialog reason="message_first" open={chat.paywallOpen} onOpenChange={chat.setPaywallOpen} />
      <PaywallDialog reason="likes_limit" open={likePaywall} onOpenChange={setLikePaywall} />
      <MatchDialog partner={match} onClose={() => setMatch(null)} />

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="md:col-span-2 space-y-4">
          {card.headline && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold text-lg">{card.headline}</p>
            </div>
          )}
          {card.about && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-semibold mb-1">About</h3>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{card.about}</p>
            </div>
          )}
          {card.interests?.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-semibold mb-2">Interests</h3>
              <div className="flex flex-wrap gap-1.5">
                {card.interests.map((t) => (
                  <span key={t} className="rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs font-medium px-2.5 py-1">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {gallery.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((p) => (
                <GalleryImage key={p} src={p} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-2 text-sm">
          <InfoRow icon={<MapPin className="size-4" />} label="Location" value={card.current_location || card.lga} />
          <InfoRow icon={<Briefcase className="size-4" />} label="Occupation" value={card.occupation} />
          <InfoRow icon={<Heart className="size-4" />} label="Marital status" value={card.marital_status ? String(card.marital_status).replace(/_/g, ' ') : null} />
          <InfoRow icon={<Ruler className="size-4" />} label="Height" value={card.height_cm ? `${card.height_cm} cm` : null} />
        </aside>
      </div>
    </div>
  )
}

function CoverImage({ rawCover, avatarUrl, name }: { rawCover: string | null; avatarUrl: string | null | undefined; name: string }) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const signedAvatar = useSignedUrl(avatarUrl, 'avatars')
  const avatarFallback = signedAvatar || (isValidHttpUrl(avatarUrl) ? (avatarUrl as string) : null)
  const src = !broken ? (isValidHttpUrl(rawCover) ? rawCover : avatarFallback) : null

  useEffect(() => {
    setBroken(false)
    setLoaded(false)
  }, [src])

  // Only show shimmer while we actually have a candidate URL loading.
  const showSkeleton = !!src && !loaded

  return (
    <>
      {showSkeleton && (
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/60 to-muted animate-pulse" />
      )}
      {src && (
        <img
          src={src}
          alt={name}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </>
  )
}

function GalleryImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted/60 to-muted" />}
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setHidden(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <span className="text-pink-500">{icon}</span>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium capitalize">{value}</p>
      </div>
    </div>
  )
}
