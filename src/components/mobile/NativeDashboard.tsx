import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Star,
  FileText,
  MessageCircle,
  Bookmark,
  Bell,
  TrendingUp,
  ChevronRight,
  Plus,
  Phone,
  PhoneOff,
} from 'lucide-react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { GOLD_GRADIENT, GOLD_SHADOW, PREMIUM_SHADOW } from '@/lib/mobileBrand'
import { AppUpdateCard } from '@/components/pwa/AppUpdateCard'
import { useAuth } from '@/contexts/AuthContext'
import {
  areCallsEnabled,
  hydrateCallsEnabledFromProfile,
  setCallsEnabled,
  subscribeCallsEnabled,
} from '@/lib/callPreferences'
import { toast } from '@/lib/toast'
import { formatDistanceToNow } from 'date-fns'

const ActivityChart = lazy(() => import('@/components/dashboard/ActivityChart'))

interface NativeDashboardProps {
  profile: {
    display_name?: string | null
    username?: string | null
    avatar_url?: string | null
    reputation?: number | null
  }
  stats: {
    posts: number
    replies: number
    bookmarks: number
    reputation: number
  }
  chartData: Array<{ label: string; posts: number }>
  recentThreads: Array<{ id: string; title: string; created_at: string }>
}

export function NativeDashboard({ profile, stats, chartData, recentThreads }: NativeDashboardProps) {
  const displayName = profile.display_name || 'User'
  const { user } = useAuth()
  const [callsOn, setCallsOnState] = useState(() => areCallsEnabled())

  useEffect(() => subscribeCallsEnabled(setCallsOnState), [])
  useEffect(() => {
    if (user?.id) void hydrateCallsEnabledFromProfile(user.id)
  }, [user?.id])

  const toggleCalls = (v: boolean) => {
    void setCallsEnabled(v, { userId: user?.id })
    toast.success(v ? 'Calls turned on' : 'Calls turned off')
  }

  return (
    <div className="flex flex-col gap-6 pb-32 animate-in fade-in duration-500">
      {/* App update banner (only shows on native when a newer release exists) */}
      <AppUpdateCard />


      {/* Header Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[#0B1220] p-6 text-white shadow-2xl">
        {/* Glow effect */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#F8C301]/10 blur-[80px]" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#F8C301] blur-md opacity-40 animate-pulse" />
              <div className="relative rounded-full border-2 border-[#F8C301]/50 p-0.5">
                <UserAvatar
                  avatarUrl={profile.avatar_url}
                  displayName={displayName}
                  size="xl"
                  className="h-20 w-20 border-2 border-[#0B1220]"
                />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight tracking-tight">
                Hello, {displayName}!
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F8C301]">
                PREMIUM MEMBER
              </p>
            </div>
          </div>

          <Link to="/notifications" className="relative h-12 w-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <Bell className="size-5 text-[#F8C301]" />
            <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-red-500 ring-4 ring-[#0B1220]" />
          </Link>
        </div>

        <div className="relative mt-8 flex gap-3">
          <Button
            asChild
            className="h-12 flex-1 gap-2 rounded-2xl border-0 text-sm font-bold text-[#0B1220] active:scale-95 transition-transform"
            style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
          >
            <Link to="/create-thread">
              <Plus className="size-4 stroke-[3]" />
              Start Discussion
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 flex-1 rounded-2xl border-white/10 bg-white/5 text-sm font-bold text-white backdrop-blur-md active:scale-95 transition-transform"
          >
            <Link to="/profile">My Profile</Link>
          </Button>
        </div>
      </section>

      {/* Voice calls toggle */}
      <section className="rounded-[2rem] border border-white/5 bg-[#161D2D] p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              callsOn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'
            }`}
          >
            {callsOn ? <Phone className="size-5" /> : <PhoneOff className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F8C301]">
              Voice calls
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {callsOn ? 'Enabled on this device' : 'Disabled on this device'}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/60">
              {callsOn
                ? "You can make and receive voice calls."
                : "You can't start calls and incoming calls are declined automatically."}
            </p>
          </div>
          <Switch
            checked={callsOn}
            onCheckedChange={toggleCalls}
            aria-label="Toggle voice calls"
          />
        </div>
      </section>



      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        {[
          { label: 'Reputation', value: stats.reputation, icon: Star, color: 'text-[#F8C301]', bg: 'bg-[#F8C301]/10' },
          { label: 'Threads', value: stats.posts, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Replies', value: stats.replies, icon: MessageCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Saved', value: stats.bookmarks, icon: Bookmark, color: 'text-orange-400', bg: 'bg-orange-400/10' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-3 rounded-[2rem] border border-slate-200/50 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#161D2D]"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
              <item.icon className={`size-5 ${item.color}`} />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                {item.value}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {item.label}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Activity Insight */}
      <section className="rounded-[2rem] border border-slate-200/50 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#161D2D]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-blue-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Activity Insight
            </h2>
          </div>
          <TrendingUp className="size-4 text-slate-300 dark:text-white/20" />
        </div>

        <div className="h-48 w-full">
          <Suspense fallback={<div className="h-full w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />}>
            <ActivityChart data={chartData} />
          </Suspense>
        </div>
      </section>

      {/* Latest Posts */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
            My Latest Posts
          </h2>
          <Link to="/dashboard?tab=posts" className="text-[10px] font-black uppercase tracking-widest text-[#F8C301] hover:underline">
            View All
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {recentThreads.length > 0 ? (
            recentThreads.map((thread) => (
              <Link
                key={thread.id}
                to={`/thread/${thread.id}`}
                className="group flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200/50 bg-white p-4 shadow-sm active:scale-[0.98] transition-all dark:border-white/5 dark:bg-[#161D2D]"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#F8C301]">
                    {thread.title}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                  </p>
                </div>
                <ChevronRight className="size-4 text-slate-300 dark:text-white/20" />
              </Link>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">No threads yet</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
