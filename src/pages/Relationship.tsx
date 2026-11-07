import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { Hand, Heart, MessageCircle, Sparkles, X, LayoutGrid, Layers, MapPin, Filter, Handshake, RefreshCw, Search, UserRound, Users, AlertCircle, Crown, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { SEO } from '@/components/SEO'
import { UserAvatar } from '@/components/ui/UserAvatar'
import {
  calcAge,
  isPersonalReason,
  REASON_FILTERS,
  ReasonFilterId,
  RelationshipCard,
  RelationshipProfile,
} from '@/lib/relationship'
import { isValidHttpUrl } from '@/lib/images'
import { selectRelationshipCards } from '@/lib/relationshipFeed'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { useDatingEntitlements } from '@/hooks/useDatingEntitlements'
import { canPurchaseHere, getLikesReceived, getMyReactedIds, reactToProfile, track, type ReactResult } from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'
import { PaywallDialog } from '@/components/dating/PaywallDialog'
import { MatchDialog, type MatchPartner } from '@/components/dating/MatchDialog'
import { HowItWorks } from '@/components/dating/HowItWorks'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { PrivacySettingsDialog } from '@/components/dating/PrivacySettingsDialog'
import { useStartDatingChat } from '@/hooks/useStartDatingChat'
import { ReasonBadge } from '@/components/connect/ReasonBadge'
import { searchConnectMembers } from '@/lib/connect'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 24
const MODE_KEY = 'abia:dating-mode'

const FILTER_SELECT =
  'w-full min-w-0 truncate rounded-full border border-border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:w-auto sm:py-1.5'

type SexFilter = 'all' | 'male' | 'female'
type AgeBracket = 'all' | '18-24' | '25-34' | '35-44' | '45-54' | '55+'

const AGE_BRACKETS: Record<Exclude<AgeBracket, 'all'>, { min: number; max: number }> = {
  '18-24': { min: 18, max: 24 },
  '25-34': { min: 25, max: 34 },
  '35-44': { min: 35, max: 44 },
  '45-54': { min: 45, max: 54 },
  '55+':   { min: 55, max: 120 },
}

/** Convert an age bracket into a `dob` date range (inclusive). */
function ageBracketToDobRange(bracket: Exclude<AgeBracket, 'all'>) {
  const { min, max } = AGE_BRACKETS[bracket]
  const now = new Date()
  // Someone aged `min` was born on or before today - min years.
  const dobMax = new Date(now.getFullYear() - min, now.getMonth(), now.getDate())
  // Someone aged `max` was born after today - (max+1) years.
  const dobMin = new Date(now.getFullYear() - max - 1, now.getMonth(), now.getDate() + 1)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { dobMin: fmt(dobMin), dobMax: fmt(dobMax) }
}

interface FeedFilters {
  reason: ReasonFilterId | 'all'
  lga: string | 'all'
  sex: SexFilter
  age: AgeBracket
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

interface FeedPage {
  cards: RelationshipCard[]
  nextPage: number | null
}

async function fetchFeedPage(
  page: number,
  filters: FeedFilters,
  myId?: string,
  me?: RelationshipProfile | null,
  onlyIds?: string[],
): Promise<FeedPage> {
  if (onlyIds?.length === 0) return { cards: [], nextPage: null }
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  let q = supabase
    .from('relationship_profiles' as never)
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .range(from, to)
  if (onlyIds) q = q.in('user_id', onlyIds)
  if (filters.reason !== 'all') {
    const chosen = REASON_FILTERS.find((r) => r.id === filters.reason)
    q = q.in('looking_for', [...(chosen?.reasons ?? [])])
  }
  if (filters.lga !== 'all') q = q.eq('lga', filters.lga)
  if (filters.sex !== 'all') q = q.eq('sex', filters.sex)
  if (filters.age !== 'all') {
    const { dobMin, dobMax } = ageBracketToDobRange(filters.age)
    q = q.gte('dob', dobMin).lte('dob', dobMax)
  }
  const { data, error } = await q
  if (error) throw error
  const rows = ((data ?? []) as unknown as RelationshipProfile[]).filter(
    (r) => r.user_id !== myId,
  )
  const nextPage = (data?.length ?? 0) < PAGE_SIZE ? null : page + 1
  if (rows.length === 0) return { cards: [], nextPage }
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
  cards.sort((a, b) => scoreCard(b, me) - scoreCard(a, me))
  return { cards, nextPage }
}

async function fetchLgaOptions(): Promise<string[]> {
  const { data } = await supabase
    .from('relationship_profiles' as never)
    .select('lga')
    .eq('is_active', true)
    .not('lga', 'is', null)
    .limit(500)
  const set = new Set<string>()
  ;((data ?? []) as any[]).forEach((r) => {
    const v = (r.lga ?? '').toString().trim()
    if (v) set.add(v)
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}



export default function Relationship() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'grid' | 'discover'>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'discover' ? 'discover' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const changeMode = (m: 'grid' | 'discover') => {
    setMode(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* ignore */
    }
  }

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

  const [filters, setFilters] = useState<FeedFilters>({ reason: 'all', lga: 'all', sex: 'all', age: 'all' })

  // Search by name. Waits for a pause in typing before asking the server.
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])
  const searching = searchTerm.length >= 2
  const { data: searchIds, error: searchError } = useQuery({
    queryKey: ['connect-search', searchTerm],
    enabled: !!user && searching,
    queryFn: () => searchConnectMembers(searchTerm),
    staleTime: 60_000,
  })
  const onlyIds = searching ? searchIds : undefined

  const { data: lgaOptions = [] } = useQuery({
    queryKey: ['relationship-lga-options'],
    queryFn: fetchLgaOptions,
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['relationship-feed', user?.id, myProfile?.id ?? null, filters.reason, searching ? (onlyIds ?? null) : null, filters.lga, filters.sex, filters.age],
    enabled: !!user && (!searching || !!onlyIds),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as number, filters, user?.id, myProfile, onlyIds),
    getNextPageParam: (last) => last.nextPage,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  // Realtime: keep the feed fresh without polling. Any insert/update/delete on
  // relationship_profiles invalidates the cached pages so React Query refetches
  // in the background (no full-page spinner).
  useRealtimeChannel({
    channelName: 'relationship-feed',
    enabled: !!user,
    subscriptions: [
      {
        filter: { event: '*', schema: 'public', table: 'relationship_profiles' },
        handler: () => {
          queryClient.invalidateQueries({ queryKey: ['relationship-feed'] })
        },
      },
    ],
  })

  const moreFilterCount = [filters.lga, filters.sex, filters.age].filter((v) => v !== 'all').length
  const hasActiveFilters = moreFilterCount > 0 || filters.reason !== 'all' || searching
  // Gender and age only matter when someone is looking for people, not work.
  const showPersonalFilters = filters.reason === 'dating' || filters.reason === 'friendship'
  const chooseReason = (reason: FeedFilters['reason']) =>
    setFilters((f) => {
      const personal = reason === 'dating' || reason === 'friendship'
      return { ...f, reason, sex: personal ? f.sex : 'all', age: personal ? f.age : 'all' }
    })
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Stable per-mount seed so the "random 10" order doesn't reshuffle on every render
  const shuffleSeedRef = useRef(Math.random())
  const cards = useMemo(() => {
    const all = (data?.pages ?? []).flatMap((p) => p.cards)
    return selectRelationshipCards(all, hasActiveFilters, shuffleSeedRef.current)
  }, [data, hasActiveFilters])

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const clearFilters = () => {
    setFilters({ reason: 'all', lga: 'all', sex: 'all', age: 'all' })
    setSearchInput('')
  }

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-clip">
      <SEO
        title="Connect — Meet Abia professionals, friends and partners"
        description="Connect with Abia members for business, networking, friendship and relationships. Build trusted connections across Abia and beyond."
        path="/relationship"
      />

      <header className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-lg shadow-emerald-500/25 sm:size-11 sm:rounded-2xl native:hidden">
              <Handshake className="size-4 text-white sm:size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight sm:text-2xl native:hidden">Connect</h1>
              <p className="truncate text-xs text-muted-foreground">
                <span className="sm:hidden">Work, business, friendship &amp; more</span>
                <span className="hidden sm:inline">Find Abians for work, business, services, friendship and more</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <PrivacySettingsDialog />
            <PremiumLink />
            {myProfile !== undefined && (
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-full border-border bg-card px-3 text-sm shadow-sm hover:bg-muted sm:px-4"
              >
                <Link to={myProfile ? `/relationship/${user?.id}` : '/relationship/edit'}>
                  {myProfile ? <UserRound className="size-4" /> : <Sparkles className="size-4" />}
                  <span>{myProfile ? 'My profile' : 'Create'}</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        <nav className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1 sm:inline-grid sm:w-auto" aria-label="Connect sections">
          <button
            onClick={() => changeMode('grid')}
            aria-current={mode === 'grid' ? 'page' : undefined}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:px-5 ${
              mode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <LayoutGrid className="size-4" /> {t('tabs.browse')}
          </button>
          <button
            onClick={() => changeMode('discover')}
            aria-current={mode === 'discover' ? 'page' : undefined}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:px-5 ${
              mode === 'discover' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Layers className="size-4" /> {t('tabs.discover')}
          </button>
          <LikesTabLink />
        </nav>
      </header>

      {/* The app teaches the swipe on the card itself, so the card stays on screen. */}
      {user && !isNativeApp() && <HowItWorks />}

      {user && myProfile === null && (
        <section className="mb-4 flex flex-col items-start gap-3 rounded-2xl border border-emerald-500/30 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{t('profile_cta.title')}</p>
            <p className="text-sm text-muted-foreground">{t('profile_cta.body')}</p>
          </div>
          <Button asChild className="w-full shrink-0 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white sm:w-auto">
            <Link to="/relationship/edit">
              <Sparkles className="size-4" /> {t('profile_cta.button')}
            </Link>
          </Button>
        </section>
      )}

      {user && myProfile && !myProfile.looking_for && (
        <Link
          to="/relationship/edit"
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium"
        >
          <span>Tell people why you are here, so the right ones can find you.</span>
          <span className="shrink-0 font-bold text-amber-700 dark:text-amber-300">Add</span>
        </Link>
      )}

      {user && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search people by name"
              aria-label="Search people by name"
              className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
            />
          </div>

          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Show people who are here for">
            {[{ id: 'all' as const, label: 'Everyone' }, ...REASON_FILTERS].map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={filters.reason === r.id}
                onClick={() => chooseReason(r.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  filters.reason === r.id
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="relationship-filters"
              className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold text-muted-foreground"
            >
              <Filter className="size-3.5" /> More filters
              {moreFilterCount > 0 && (
                <span className="rounded-full bg-emerald-700 px-1.5 text-[10px] font-bold leading-4 text-white">{moreFilterCount}</span>
              )}
              <ChevronDown className={`size-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <div className="flex items-center gap-3">
              {isFetching && !isFetchingNextPage && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <RefreshCw className="size-3 animate-spin" /> Updating…
                </span>
              )}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  <X className="size-3" /> Clear
                </button>
              )}
            </div>
          </div>
          {filtersOpen && (
            <div id="relationship-filters" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <select
                aria-label="LGA"
                value={filters.lga}
                onChange={(e) => setFilters((f) => ({ ...f, lga: e.target.value }))}
                className={FILTER_SELECT}
              >
                <option value="all">LGA: Any</option>
                {lgaOptions.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {showPersonalFilters && (
                <>
                  <select
                    aria-label="Gender"
                    value={filters.sex}
                    onChange={(e) => setFilters((f) => ({ ...f, sex: e.target.value as SexFilter }))}
                    className={FILTER_SELECT}
                  >
                    <option value="all">Gender: Any</option>
                    <option value="male">Men</option>
                    <option value="female">Women</option>
                  </select>
                  <select
                    aria-label="Age"
                    value={filters.age}
                    onChange={(e) => setFilters((f) => ({ ...f, age: e.target.value as AgeBracket }))}
                    className={FILTER_SELECT}
                  >
                    <option value="all">Age: Any</option>
                    {(Object.keys(AGE_BRACKETS) as Exclude<AgeBracket, 'all'>[]).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!user && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Sign in to discover members and grow your network.</p>
        </div>
      )}

      {user && searchError && (
        <p className="mb-4 text-center text-sm text-muted-foreground">Search is not available right now. Please try again shortly.</p>
      )}

      {user && error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertCircle className="size-6 mx-auto text-destructive mb-2" />
          <p className="font-semibold">Couldn't load profiles</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error as Error).message || 'Please check your connection and try again.'}
          </p>
          <Button className="mt-4 rounded-full" onClick={() => refetch()}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        </div>
      )}

      {user && !error && isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {user && !error && !isLoading && cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Users className="size-8 mx-auto text-emerald-600 mb-3" />
          <p className="font-semibold">
            {searching ? `Nobody found for "${searchTerm}"` : hasActiveFilters ? 'Nobody here yet' : 'No members to show yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? 'Try another name or choice, or clear your search.'
              : 'Be among the first: create your Connect profile so the right people can find you.'}
          </p>
          {hasActiveFilters ? (
            <Button className="mt-4 rounded-full" onClick={clearFilters} variant="secondary">
              Clear
            </Button>
          ) : (
            <Button asChild className="mt-4 rounded-full">
              <Link to="/relationship/edit">Create my profile</Link>
            </Button>
          )}
        </div>
      )}

      {user && !error && cards.length > 0 && (
        <>
          {mode === 'grid' || searching ? <GridView cards={cards} /> : <DiscoverView cards={cards} />}

          {(mode === 'grid' || searching) && (
            <>
              <div ref={sentinelRef} className="h-8" aria-hidden />
              {isFetchingNextPage && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-[4/5] rounded-2xl bg-muted animate-pulse" />
                  ))}
                </div>
              )}
              {!hasNextPage && cards.length >= PAGE_SIZE && (
                <p className="text-center text-xs text-muted-foreground mt-6">
                  You've seen everyone for now. New members join every day.
                </p>
              )}
            </>
          )}
        </>
      )}
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

const CardTile = memo(function CardTile({ card }: { card: RelationshipCard }) {
  const age = isPersonalReason(card.looking_for) ? calcAge(card.dob) : null
  const name = card.display_name || card.username || 'Member'
  const [broken, setBroken] = useState(false)
  const rawPhoto = card.photos?.[0] ?? null
  const signedAvatar = useSignedUrl(card.avatar_url, 'avatars')
  const fallback = signedAvatar || (isValidHttpUrl(card.avatar_url) ? card.avatar_url : null)
  const cover = !broken ? (isValidHttpUrl(rawPhoto) ? rawPhoto : fallback) : null
  const work = card.occupation || card.business_name || card.headline
  return (
    <Link
      to={`/relationship/${card.user_id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <UserAvatar avatarUrl={null} displayName={name} size="lg" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 p-3">
        <ReasonBadge reason={card.looking_for} />
        <p className="mt-0.5 w-full truncate text-sm font-bold leading-tight">
          {name}{age ? `, ${age}` : ''}
        </p>
        {work && <p className="line-clamp-2 w-full text-xs text-muted-foreground">{work}</p>}
        {(card.lga || card.current_location) && (
          <p className="mt-auto flex w-full items-center gap-1 pt-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" /> <span className="truncate">{card.current_location || card.lga}</span>
          </p>
        )}
      </div>
    </Link>
  )
}, (prev, next) => prev.card.id === next.card.id && prev.card.updated_at === next.card.updated_at)

/** Likes tab with the number of people waiting for a reply. */
function LikesTabLink() {
  const { user } = useAuth()
  const { data: likes } = useQuery({
    queryKey: ['dating-likes-count', user?.id],
    queryFn: () => getLikesReceived(1, 0),
    enabled: !!user,
    staleTime: 60_000,
  })
  const pending = likes?.total ?? 0
  return (
    <Link
      to="/relationship/likes"
      aria-label={`${t('tabs.likes')}${pending ? `, ${pending} waiting` : ''}`}
      className="relative inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:px-5"
    >
      <Heart className="size-4 text-emerald-600" /> {t('tabs.likes')}
      {pending > 0 && (
        <span className="min-w-5 rounded-full bg-emerald-600 px-1 text-center text-[10px] font-bold leading-5 text-white">
          {pending > 99 ? '99+' : pending}
        </span>
      )}
    </Link>
  )
}

/** Premium shortcut (hidden in the Android app unless already premium). */
function PremiumLink() {
  const { data: ent } = useDatingEntitlements()
  if (!(ent?.is_premium || canPurchaseHere())) return null
  return (
    <Button asChild variant="outline" className="size-10 rounded-full border-amber-500/40 bg-card p-0 shadow-sm hover:bg-amber-500/10 sm:w-auto sm:px-4">
      <Link to="/relationship/premium" aria-label={ent?.is_premium ? `${ent.plan_name} plan` : 'Upgrade to Premium'}>
        <Crown className="size-4 text-amber-500" />
        <span className="hidden sm:inline">{ent?.is_premium ? ent.plan_name : 'Premium'}</span>
      </Link>
    </Button>
  )
}

function DiscoverView({ cards: allCards }: { cards: RelationshipCard[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: ent } = useDatingEntitlements()
  const { data: reacted } = useQuery({
    queryKey: ['dating-my-reactions', user?.id],
    queryFn: getMyReactedIds,
    enabled: !!user,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const cards = useMemo(
    () => (reacted ? allCards.filter((c) => !reacted.has(c.user_id)) : allCards),
    [allCards, reacted],
  )
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [paywall, setPaywall] = useState(false)
  const [match, setMatch] = useState<MatchPartner | null>(null)
  const [likesLeft, setLikesLeft] = useState<number | null>(null)
  const [direction, setDirection] = useState<'like' | 'pass'>('pass')
  const chat = useStartDatingChat()
  const current = cards[index]
  const remaining = cards.length - index

  useEffect(() => {
    track('DISCOVERY_VIEWED')
  }, [])

  // Free-plan counter (the server is authoritative; this is display only).
  const dailyLimit = ent?.limits?.daily_likes
  const shownLikesLeft =
    likesLeft ?? (typeof dailyLimit === 'number' ? Math.max(dailyLimit - (ent?.likes_used_today ?? 0), 0) : null)

  const next = () => setIndex((i) => Math.min(i + 1, cards.length))

  /** Returns true when the card should advance. */
  const handleResult = (r: ReactResult, name: string, userId: string) => {
    if (r.status === 'limit_reached') {
      setLikesLeft(0)
      setPaywall(true)
      return false
    }
    if (r.status === 'profile_required') {
      toast.error(t('discover.profile_required'))
      navigate('/relationship/edit')
      return false
    }
    if (r.status === 'account_restricted') {
      toast.error(t('discover.restricted'))
      return false
    }
    if (r.status === 'unavailable') toast.error(t('discover.unavailable'))
    if (typeof r.likes_remaining === 'number') setLikesLeft(r.likes_remaining)
    if (r.matched) {
      setMatch({ userId, name })
      queryClient.invalidateQueries({ queryKey: ['dating-matches'] })
    }
    return true
  }

  const react = async (kind: 'like' | 'pass') => {
    if (!current || !user || busy) return
    setBusy(true)
    setDirection(kind)
    const name = current.display_name || current.username || 'them'
    try {
      const r = await reactToProfile(current.user_id, kind)
      if (handleResult(r, name, current.user_id)) next()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Keyboard: right arrow = like, left arrow = pass (ignored while typing or in dialogs).
  const reactRef = useRef(react)
  reactRef.current = react
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowRight') reactRef.current('like')
      if (e.key === 'ArrowLeft') reactRef.current('pass')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!current) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="font-semibold">You're all caught up</p>
        <p className="mt-1 text-sm text-muted-foreground">You have seen everyone for now. Check your requests, or come back later.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild className="rounded-full">
            <Link to="/relationship/likes">View requests & connections</Link>
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => setIndex(0)}>
            Start over
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <SwipeDeck card={current} direction={direction} disabled={busy} hasMore={remaining > 1} onSwipe={react} />

      <div className="mt-4 flex items-center justify-center gap-4 sm:mt-5">
        <button
          onClick={() => react('pass')}
          disabled={busy}
          className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card shadow-md transition hover:bg-muted disabled:opacity-60"
          aria-label={t('discover.pass')}
        >
          <X className="size-6 text-muted-foreground" />
        </button>
        <button
          onClick={() => react('like')}
          disabled={busy}
          className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-lg shadow-emerald-700/30 transition hover:scale-105 active:scale-95 disabled:opacity-60"
          aria-label={t('discover.like')}
        >
          <Handshake className="size-7 text-white" />
        </button>
        <button
          onClick={() => chat.start(current.user_id)}
          disabled={busy || !!chat.busyWith}
          className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card shadow-md transition hover:bg-muted disabled:opacity-60"
          aria-label={t('discover.message')}
        >
          <MessageCircle className="size-6 text-emerald-600" />
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground sm:mt-3">
        <span className="font-medium">{t('discover.hint')}</span>
        <br />
        {remaining} {remaining === 1 ? 'profile' : 'profiles'} to discover
        {typeof shownLikesLeft === 'number' && <> · {t('discover.likes_left', { count: shownLikesLeft })}</>}
      </p>

      <PaywallDialog reason="likes_limit" open={paywall} onOpenChange={setPaywall} />
      <PaywallDialog
        reason="message_first"
        open={chat.paywallOpen}
        onOpenChange={chat.setPaywallOpen}
        onSecondary={() => react('like')}
      />
      <MatchDialog partner={match} onClose={() => setMatch(null)} />
    </div>
  )
}

const SWIPE_DISTANCE = 110
const SWIPE_VELOCITY = 700
const SWIPE_COACHED_KEY = 'abia:swipe-coached'

/**
 * The current Discover card. Drag right to like, left to pass (touch or
 * mouse); a "CONNECT"/"SKIP" stamp follows the drag. Short drags snap back.
 */
function SwipeDeck({
  card,
  direction,
  disabled,
  hasMore,
  onSwipe,
}: {
  card: RelationshipCard
  direction: 'like' | 'pass'
  disabled: boolean
  hasMore: boolean
  onSwipe: (kind: 'like' | 'pass') => void
}) {
  const [coached, setCoached] = useState(() => {
    try {
      return localStorage.getItem(SWIPE_COACHED_KEY) === '1'
    } catch {
      return true
    }
  })
  // Any reaction (a swipe or a button) means the member has got it.
  const firstCard = useRef(card.id)
  useEffect(() => {
    if (coached || card.id === firstCard.current) return
    setCoached(true)
    try {
      localStorage.setItem(SWIPE_COACHED_KEY, '1')
    } catch {
      /* private mode: the hint just comes back next visit */
    }
  }, [card.id, coached])

  return (
    // Phones: cap the height so the card and the like/pass buttons fit on one
    // screen; larger screens keep the classic 3:4 card.
    <div className="relative h-[min(calc((100vw-1.5rem)*4/3),47svh)] w-full native:h-[min(calc((100vw-2rem)*4/3),calc(100svh-24.5rem))] sm:h-auto sm:aspect-[3/4]">
      {hasMore && (
        <div
          className="absolute inset-x-3 -bottom-2 h-16 rounded-3xl border border-border bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-rose-950"
          aria-hidden
        />
      )}
      <AnimatePresence initial={false} custom={direction}>
        <SwipeCard key={card.id} card={card} disabled={disabled} onSwipe={onSwipe} />
      </AnimatePresence>
      {!coached && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 flex justify-center" aria-hidden>
          <motion.span
            className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-[13px] font-bold text-white shadow-lg"
            animate={{ x: [0, 22, 0, -22, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Hand className="size-4" /> Swipe the card
          </motion.span>
        </div>
      )}
    </div>
  )
}

const cardVariants = {
  enter: { opacity: 0, scale: 0.96 },
  center: { opacity: 1, scale: 1, x: 0, rotate: 0 },
  exit: (dir: 'like' | 'pass') => ({ x: dir === 'like' ? 480 : -480, rotate: dir === 'like' ? 18 : -18, opacity: 0 }),
}

function SwipeCard({
  card,
  disabled,
  onSwipe,
}: {
  card: RelationshipCard
  disabled: boolean
  onSwipe: (kind: 'like' | 'pass') => void
}) {
  const age = isPersonalReason(card.looking_for) ? calcAge(card.dob) : null
  const name = card.display_name || card.username || 'Member'
  const [broken, setBroken] = useState(false)
  const rawPhoto = card.photos?.[0] ?? null
  const signedAvatar = useSignedUrl(card.avatar_url, 'avatars')
  const fallback = signedAvatar || (isValidHttpUrl(card.avatar_url) ? card.avatar_url : null)
  const cover = !broken ? (isValidHttpUrl(rawPhoto) ? rawPhoto : fallback) : null

  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-14, 14])
  const likeOpacity = useTransform(x, [30, SWIPE_DISTANCE], [0, 1])
  const nopeOpacity = useTransform(x, [-SWIPE_DISTANCE, -30], [1, 0])
  const dragged = useRef(false)

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y overflow-hidden rounded-3xl [-webkit-touch-callout:none] border border-border bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 shadow-2xl active:cursor-grabbing"
      style={{ x, rotate }}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.28 }}
      drag={disabled ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={(_, info) => {
        const kind =
          info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY
            ? 'like'
            : info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY
              ? 'pass'
              : null
        if (kind) {
          try {
            navigator.vibrate?.(15)
          } catch {
            /* noop */
          }
          onSwipe(kind)
        }
        // Let the click that ends a drag be ignored by the profile link.
        setTimeout(() => {
          dragged.current = false
        }, 0)
      }}
    >
      {cover && (
        <img
          src={cover}
          alt={name}
          draggable={false}
          onError={() => setBroken(true)}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      <motion.span
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-emerald-400 px-3 py-1 text-2xl font-black tracking-wider text-emerald-400"
        aria-hidden
      >
        CONNECT
      </motion.span>
      <motion.span
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-xl border-4 border-rose-500 px-3 py-1 text-2xl font-black tracking-wider text-rose-500"
        aria-hidden
      >
        SKIP
      </motion.span>

      <Link
        to={`/relationship/${card.user_id}`}
        draggable={false}
        onClickCapture={(e) => {
          if (dragged.current) e.preventDefault()
        }}
        className="absolute bottom-0 left-0 right-0 p-5 text-white"
      >
        <ReasonBadge reason={card.looking_for} className="mb-2 text-xs" />
        <p className="text-2xl font-extrabold leading-tight">
          {name}
          {age ? `, ${age}` : ''}
        </p>
        {card.occupation && <p className="mt-1 line-clamp-1 text-sm font-medium opacity-95">{card.occupation}</p>}
        {(card.current_location || card.lga) && (
          <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
            <MapPin className="size-3.5" /> {card.current_location || card.lga}
          </p>
        )}
        {card.headline && <p className="mt-1 line-clamp-2 text-sm opacity-90">{card.headline}</p>}
        <p className="mt-2 text-[10px] opacity-70">Tap card to view full profile</p>
      </Link>
    </motion.div>
  )
}
