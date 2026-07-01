import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
  startConversationWith,
} from '@/lib/relationship'
import { isValidHttpUrl } from '@/lib/images'

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
  const [chatting, setChatting] = useState(false)

  const { data: card, isLoading, error } = useQuery({
    queryKey: ['relationship-profile', userId],
    enabled: !!userId,
    queryFn: () => loadProfile(userId!),
  })

  const startChat = async () => {
    if (!user || !card) return
    setChatting(true)
    try {
      const id = await startConversationWith(card.user_id, user.id)
      navigate(`/messages/${id}`)
    } catch (e: any) {
      toast.error(e.message || 'Could not start chat')
      setChatting(false)
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
  const [coverBroken, setCoverBroken] = useState(false)
  const rawCover = card.photos?.[0] ?? null
  const signedAvatar = useSignedUrl(card.avatar_url, 'avatars')
  const avatarFallback = signedAvatar || (isValidHttpUrl(card.avatar_url) ? card.avatar_url : null)
  const cover = !coverBroken ? (isValidHttpUrl(rawCover) ? rawCover : avatarFallback) : null
  const gallery = (card.photos ?? []).slice(1).filter(isValidHttpUrl)

  return (
    <div className="max-w-3xl mx-auto">
      <SEO title={`${name} — Relationship profile`} description={card.headline || 'Meet Abia members on AbiaConnect.'} path={`/relationship/${card.user_id}`} />
      <Button asChild variant="ghost" className="mb-3">
        <Link to="/relationship"><ArrowLeft className="size-4" /> Back to discover</Link>
      </Button>

      <div className="relative w-full aspect-[16/10] sm:aspect-[16/8] rounded-3xl overflow-hidden bg-gradient-to-br from-pink-500/20 to-rose-600/20 border border-border">
        {cover && (
          <img src={cover} alt={name} onError={() => setCoverBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <UserAvatar avatarUrl={card.avatar_url} displayName={name} size="lg" />
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold truncate">
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

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Button
          onClick={startChat}
          disabled={chatting || !user || user.id === card.user_id}
          className="rounded-full bg-gradient-to-br from-pink-500 to-rose-600 hover:opacity-95 text-white"
        >
          {chatting ? <Loader2 className="animate-spin size-4" /> : <MessageCircle className="size-4" />}
          Chat now
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
                <img
                  key={p}
                  src={p}
                  alt=""
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                  className="aspect-square object-cover rounded-xl border border-border bg-muted"
                />
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
