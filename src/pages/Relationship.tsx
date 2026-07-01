import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Sparkles, X, LayoutGrid, Layers, MapPin, Pencil, Filter, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { SEO } from '@/components/SEO'
import { UserAvatar } from '@/components/ui/UserAvatar'
import {
  calcAge,
  LOOKING_FOR_LABELS,
  LookingFor,
  RelationshipCard,
  RelationshipProfile,
  startConversationWith,
} from '@/lib/relationship'

const PAGE_SIZE = 24

interface FeedFilters {
  lookingFor: LookingFor | 'all'
  lga: string | 'all'
}


/**
 * Rank a candidate card for Tinder/Badoo-style ordering.
 * Blends recency, activity, profile quality, and mutual interest with the viewer.
 * Higher score = shown earlier.
 */
function scoreCard(c: RelationshipCard, me?: RelationshipProfile | null): number {
  const now = Date.now()
  const updatedAt = new Date(c.updated_at).getTime()
  const createdAt = new Date(c.created_at).getTime()
  const daysSinceUpdate = Math.max(0, (now - updatedAt) / 86_400_000)
  const daysSinceCreate = Math.max(0, (now - createdAt) / 86_400_000)

  // Recency: exponential decay with 7-day half-life (max ~40)
  const recency = 40 * Math.exp(-daysSinceUpdate / 7)

  // "New joiner" boost for first 3 days
  const freshBoost = daysSinceCreate < 3 ? 12 * (1 - daysSinceCreate / 3) : 0

  // Profile quality / activity signals
  const photos = c.photos?.length ?? 0
  const photoScore = Math.min(photos, 4) * 4 // up to 16
  const completeness =
    (c.headline ? 3 : 0) +
    (c.about ? 4 : 0) +
    (c.dob ? 2 : 0) +
    (c.occupation ? 2 : 0) +
    (c.height_cm ? 1 : 0) +
    (c.looking_for ? 3 : 0) +
    ((c.interests?.length ?? 0) > 0 ? 3 : 0)

  // Mutual interest signals vs viewer
  let mutual = 0
  if (me) {
    if (me.looking_for && c.looking_for && me.looking_for === c.looking_for) mutual += 18
    if (me.lga && c.lga && me.lga === c.lga) mutual += 8
    if (me.current_location && c.current_location && me.current_location === c.current_location) mutual += 6
    const mine = new Set((me.interests ?? []).map((i) => i.toLowerCase()))
    const shared = (c.interests ?? []).filter((i) => mine.has(i.toLowerCase())).length
    mutual += Math.min(shared, 5) * 3 // up to 15
  }

  // Small deterministic jitter so equal scores don't lock the same order
  const jitter = (parseInt(c.id.replace(/\D/g, '').slice(0, 6) || '0', 10) % 100) / 100

  return recency + freshBoost + photoScore + completeness + mutual + jitter
}

async function fetchFeed(
  myId?: string,
  me?: RelationshipProfile | null,
): Promise<RelationshipCard[]> {
  const { data, error } = await supabase
    .from('relationship_profiles' as never)
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(120)
  if (error) throw error
  const rows = ((data ?? []) as unknown as RelationshipProfile[]).filter(
    (r) => r.user_id !== myId,
  )
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.user_id)
  const { data: profiles } = await supabase.rpc('get_public_profiles', { _ids: ids })
  const map = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>()
  ;(profiles ?? []).forEach((p: any) => {
    map.set(p.id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url })
  })
  const cards: RelationshipCard[] = rows.map((r) => ({
    ...r,
    display_name: map.get(r.user_id)?.display_name ?? null,
    username: map.get(r.user_id)?.username ?? null,
    avatar_url: map.get(r.user_id)?.avatar_url ?? null,
  }))
  return cards.sort((a, b) => scoreCard(b, me) - scoreCard(a, me)).slice(0, 60)
}

export default function Relationship() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'grid' | 'discover'>('grid')

  const { data: myProfile } = useQuery({
    queryKey: ['my-relationship-profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('relationship_profiles' as never)
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      return (data as unknown as RelationshipProfile | null) ?? null
    },
  })

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['relationship-feed', user?.id, myProfile?.id ?? null],
    queryFn: () => fetchFeed(user?.id, myProfile),
  })


  return (
    <div className="max-w-6xl mx-auto">
      <SEO
        title="Relationship — Meet Abia members"
        description="Discover Abia members open to friendship, dating, and serious relationships. Chat directly with profiles you like."
        path="/relationship"
      />

      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 grid place-items-center shadow-lg shadow-pink-500/25">
            <Heart className="size-5 text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Relationship</h1>
            <p className="text-xs text-muted-foreground">Meet real Abia members near you</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full bg-muted p-1">
            <button
              onClick={() => setMode('grid')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                mode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <LayoutGrid className="size-3.5" /> Grid
            </button>
            <button
              onClick={() => setMode('discover')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                mode === 'discover' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Layers className="size-3.5" /> Discover
            </button>
          </div>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/relationship/edit">
              {myProfile ? (
                <><Pencil className="size-4" /> Edit my profile</>
              ) : (
                <><Sparkles className="size-4" /> Create my profile</>
              )}
            </Link>
          </Button>
        </div>
      </header>

      {!user && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Sign in to browse and chat.</p>
        </div>
      )}

      {user && isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {user && !isLoading && cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Heart className="size-8 mx-auto text-pink-500 mb-3" />
          <p className="font-semibold">No profiles yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first — create your relationship profile and get discovered.
          </p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/relationship/edit">Create my profile</Link>
          </Button>
        </div>
      )}

      {user && cards.length > 0 && (mode === 'grid' ? <GridView cards={cards} /> : <DiscoverView cards={cards} />)}
    </div>
  )
}

function GridView({ cards }: { cards: RelationshipCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.25 }}
        >
          <CardTile card={c} />
        </motion.div>
      ))}
    </div>
  )
}

function CardTile({ card }: { card: RelationshipCard }) {
  const age = calcAge(card.dob)
  const name = card.display_name || card.username || 'Member'
  const cover = card.photos?.[0] || card.avatar_url
  return (
    <Link
      to={`/relationship/${card.user_id}`}
      className="group relative block aspect-[3/4] rounded-2xl overflow-hidden bg-muted border border-border hover:border-pink-500/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-500/10"
    >
      {cover ? (
        <img
          src={cover}
          alt={name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-pink-500/20 to-rose-600/20">
          <Heart className="size-10 text-pink-500/60" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      {card.looking_for && (
        <span className="absolute top-2 right-2 rounded-full bg-pink-600/90 text-white text-[10px] font-semibold px-2 py-0.5 backdrop-blur">
          {LOOKING_FOR_LABELS[card.looking_for]}
        </span>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <p className="font-bold text-sm leading-tight line-clamp-1">
          {name}{age ? `, ${age}` : ''}
        </p>
        {(card.lga || card.current_location) && (
          <p className="text-[11px] opacity-90 line-clamp-1 flex items-center gap-1 mt-0.5">
            <MapPin className="size-3" /> {card.current_location || card.lga}
          </p>
        )}
        {card.headline && (
          <p className="text-[11px] opacity-80 line-clamp-1 mt-0.5">{card.headline}</p>
        )}
      </div>
    </Link>
  )
}

function DiscoverView({ cards }: { cards: RelationshipCard[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const current = cards[index]
  const remaining = useMemo(() => cards.length - index, [cards, index])

  const next = () => setIndex((i) => Math.min(i + 1, cards.length))

  const like = async () => {
    if (!current || !user || busy) return
    setBusy(true)
    try {
      const convo = await startConversationWith(current.user_id, user.id)
      toast.success(`Say hi to ${current.display_name || current.username || 'them'}`)
      navigate(`/messages/${convo}`)
    } catch (e: any) {
      toast.error(e.message || 'Could not start chat')
      setBusy(false)
    }
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="font-semibold">You're all caught up</p>
        <p className="text-sm text-muted-foreground mt-1">Check back later for more profiles.</p>
        <Button className="mt-4 rounded-full" onClick={() => setIndex(0)}>Start over</Button>
      </div>
    )
  }

  const age = calcAge(current.dob)
  const name = current.display_name || current.username || 'Member'
  const cover = current.photos?.[0] || current.avatar_url

  return (
    <div className="mx-auto max-w-md">
      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-muted border border-border shadow-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            {cover ? (
              <img src={cover} alt={name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-pink-500/20 to-rose-600/20">
                <Heart className="size-16 text-pink-500/60" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <Link
              to={`/relationship/${current.user_id}`}
              className="absolute bottom-0 left-0 right-0 p-5 text-white"
            >
              <p className="text-2xl font-extrabold leading-tight">
                {name}{age ? `, ${age}` : ''}
              </p>
              {(current.current_location || current.lga) && (
                <p className="text-sm opacity-90 flex items-center gap-1 mt-1">
                  <MapPin className="size-3.5" /> {current.current_location || current.lga}
                </p>
              )}
              {current.headline && (
                <p className="text-sm opacity-90 mt-1 line-clamp-2">{current.headline}</p>
              )}
              {current.looking_for && (
                <span className="mt-2 inline-block rounded-full bg-pink-600 text-white text-xs font-semibold px-2.5 py-0.5">
                  {LOOKING_FOR_LABELS[current.looking_for]}
                </span>
              )}
              <p className="text-[10px] opacity-70 mt-2">Tap card to view full profile</p>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-4 mt-5">
        <button
          onClick={next}
          className="h-14 w-14 rounded-full bg-card border border-border grid place-items-center shadow-md hover:bg-muted transition"
          aria-label="Skip"
        >
          <X className="size-6 text-muted-foreground" />
        </button>
        <button
          onClick={like}
          disabled={busy}
          className="h-16 w-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 grid place-items-center shadow-lg shadow-pink-500/40 hover:scale-105 active:scale-95 transition disabled:opacity-60"
          aria-label="Say hi"
        >
          <MessageCircle className="size-7 text-white" />
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-3">
        {remaining} {remaining === 1 ? 'profile' : 'profiles'} to discover
      </p>
    </div>
  )
}
