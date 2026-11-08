import { useEffect, useState, type ReactNode } from 'react'
import { canDonateHere } from '@/lib/storePolicy'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Award,
  ChevronRight,
  Gift,
  CircleHelp,
  MessageCircleQuestion,
  Download,
  Flag,
  HandHeart,
  Info,
  LayoutDashboard,
  LogOut,
  Moon,
  PenSquare,
  Phone,
  Radio,
  Search,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Target,
  Trophy,
  UsersRound,
  Vote,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { ViewableAvatar } from '@/components/ui/ViewableAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import {
  areCallsEnabled,
  hydrateCallsEnabledFromProfile,
  setCallsEnabled,
  subscribeCallsEnabled,
} from '@/lib/callPreferences'
import { GOLD_GRADIENT } from '@/lib/mobileBrand'
import { cn } from '@/lib/utils'
import { useVolunteerPowers } from '@/lib/volunteerTeam'

interface Row {
  label: string
  /** One short line in plain words, so new members know what they'll find. */
  hint?: string
  to: string
  icon: LucideIcon
  external?: boolean
  highlight?: boolean
  dot?: boolean
}

/**
 * The app's "More" menu: everything that isn't a bottom tab, grouped so it is
 * easy to scan. Each destination appears exactly once across the top bar,
 * the bottom tabs and this sheet (Home, Community, Messages and Connect are
 * tabs; Notifications is the bell; your profile is the card at the top).
 */
export function NativeMoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, role, isAdmin, signOut } = useAuth()
  const powers = useVolunteerPowers().data
  const { data: profile } = useProfile()
  const { settings } = useSiteSettings()
  const { theme, toggleTheme } = useTheme()
  const { hasUpdate } = useAppUpdate()
  const navigate = useNavigate()
  const location = useLocation()
  const [callsOn, setCallsOn] = useState(() => areCallsEnabled())
  const [find, setFind] = useState('')

  useEffect(() => subscribeCallsEnabled(setCallsOn), [])
  useEffect(() => {
    if (user?.id) void hydrateCallsEnabledFromProfile(user.id)
  }, [user?.id])

  // Leaving the screen (including the Android back button) closes the sheet.
  useEffect(() => {
    onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Start each time with the full menu, not the last search.
  useEffect(() => {
    if (!open) setFind('')
  }, [open])

  const member = !!user && role !== 'guest'
  const displayName = profile?.display_name || profile?.username || user?.email || 'Member'

  // Big shortcuts: the engagement features members use most.
  const quick: Row[] = user
    ? [
        { label: 'Rewards', to: '/rewards', icon: Gift },
        { label: 'Leaderboard', to: '/leaderboard', icon: Trophy },
        { label: 'Contests', to: '/contests', icon: Vote },
        { label: 'Polls', to: '/polls', icon: BarChart3 },
      ]
    : [
        { label: 'Events', to: '/events', icon: CalendarDays },
        { label: 'Success stories', to: '/success-stories', icon: Award },
      ]

  const community: Row[] = [
    ...(member ? [{ label: 'My dashboard', hint: 'Your activity, groups and points in one place', to: '/dashboard', icon: LayoutDashboard }] : []),
    ...(user ? [{ label: 'Start a discussion', hint: 'Ask a question or share news', to: '/create-thread', icon: PenSquare }] : []),
    { label: 'Live rooms', hint: 'Listen to or join live voice chats', to: '/live', icon: Radio },
    { label: 'Jobs and services', hint: 'Find work, or offer what you do', to: '/opportunities', icon: Briefcase },
    ...(user ? [{ label: 'Events', hint: 'Meetings and gatherings coming up', to: '/events', icon: CalendarDays }] : []),
    { label: 'Member spotlight', hint: 'Meet members doing great things', to: '/member-spotlight', icon: Star },
    ...(user ? [{ label: 'Success stories', hint: 'Good news from Abians', to: '/success-stories', icon: Award }] : []),
  ]

  const about: Row[] = [
    { label: 'About AbiaConnect', hint: 'What this app is and who it is for', to: '/about', icon: Info },
    { label: 'Our mission', to: '/mission', icon: Target },
    { label: 'Our team', to: '/team', icon: UsersRound },
    { label: 'Careers', hint: 'Work or volunteer with us', to: '/careers', icon: Briefcase },
    ...(settings.store_link ? [{ label: 'Store', to: settings.store_link, icon: ShoppingBag, external: true }] : []),
    ...(canDonateHere() ? [{ label: 'Donate', to: '/donate', icon: HandHeart, highlight: true }] : []),
  ]

  const help: Row[] = [
    { label: 'Ask a question', hint: 'Get an instant answer from our Help Centre', to: '/help?ask=1', icon: MessageCircleQuestion },
    { label: 'Help centre', hint: 'How-to guides and answers to common questions', to: '/help', icon: CircleHelp },
    { label: 'Report a problem', hint: 'Something not working? Tell us', to: '/report-issue', icon: Flag },
    { label: 'Community standards', hint: 'How we treat each other here', to: '/community-standards', icon: ShieldCheck },
    { label: 'Forum guidelines', hint: 'What you can and cannot post', to: '/forum-guidelines', icon: BookOpen },
    { label: 'Privacy policy', to: '/privacy-policy', icon: ScrollText },
    { label: 'Terms of service', to: '/terms-of-service', icon: ScrollText },
  ]

  const admin: Row[] = isAdmin
    ? [
        { label: 'Admin portal', hint: 'Manage members, posts and settings', to: '/admin/dashboard', icon: ShieldCheck },
        { label: 'Moderator tools', hint: 'Reported posts, stories and events to review', to: '/moderate', icon: Flag },
        { label: 'Moderation history', hint: 'Every decision made on reported posts', to: '/admin/moderation', icon: ScrollText },
        { label: 'Donations', to: '/admin/donations', icon: Wallet },
      ]
    : powers?.moderate || powers?.review
      ? [{ label: 'Moderator tools', hint: powers.moderate ? 'Reported posts, stories and events to review' : 'Stories, events and Member of the Month to review', to: '/moderate', icon: Flag }]
      : []

  const appRows: Row[] = [
    ...(user ? [{ label: 'Devices & security', hint: 'Where you are signed in', to: '/settings/devices', icon: Smartphone }] : []),
    { label: 'App version & updates', hint: hasUpdate ? 'A new version is ready' : undefined, to: '/version', icon: Download, dot: hasUpdate },
  ]

  const close = () => onOpenChange(false)

  // Search across every item in the menu.
  const term = find.trim().toLowerCase()
  const matches = term
    ? [...quick, ...community, ...admin, ...appRows, ...about, ...help].filter(
        (r, i, all) =>
          `${r.label} ${r.hint ?? ''}`.toLowerCase().includes(term) && all.findIndex((x) => x.to === r.to) === i,
      )
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="dark max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[28px] border-white/10 bg-[#0B1F0B] p-0 text-slate-50 [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:bg-white/10 [&>button]:p-1.5 [&>button]:text-slate-200 [&>button]:opacity-100"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        // Don't jump focus to the close button (it showed a focus ring on open).
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20" aria-hidden />
        <div className="px-5 pb-2 pt-4">
          <SheetTitle className="text-lg font-bold text-white">Menu</SheetTitle>
          <SheetDescription className="sr-only">All AbiaConnect features and settings</SheetDescription>
        </div>

        <div className="space-y-6 px-5 pb-4">
          {/* Account */}
          {user ? (
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              {/* Tap the photo to see it full size; tap the name to open the profile. */}
              <ViewableAvatar avatarUrl={profile?.avatar_url} displayName={displayName} size="md" className="h-14 w-14" />
              <Link to="/profile" onClick={close} className="flex min-w-0 flex-1 items-center gap-2 active:opacity-80">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-white">{displayName}</span>
                  {profile?.username ? <span className="block truncate text-[13px] text-slate-400">@{profile.username}</span> : null}
                  <span className="block text-[13px] font-medium text-amber-300">View or edit your profile</span>
                </span>
                <ChevronRight className="size-5 text-slate-500" />
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[16px] font-semibold text-white">Join the community</p>
              <p className="mt-1 text-[13px] text-slate-400">Sign in to post, message members and get alerts.</p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Link
                  to="/register"
                  onClick={close}
                  className="flex h-11 items-center justify-center rounded-xl text-[14px] font-bold text-[#0B1F0B]"
                  style={{ backgroundImage: GOLD_GRADIENT }}
                >
                  Create account
                </Link>
                <Link
                  to="/login"
                  onClick={close}
                  className="flex h-11 items-center justify-center rounded-xl border border-white/15 text-[14px] font-semibold text-white"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="What are you looking for?"
              aria-label="Search the menu"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-11 pr-4 text-[15px] text-white placeholder:text-slate-500 focus:border-amber-300/50 focus:outline-none"
            />
          </div>

          {term ? (
            matches.length ? (
              <Section title="Results">
                {matches.map((r) => <MenuRow key={r.to} row={r} onClick={close} />)}
              </Section>
            ) : (
              <p className="rounded-2xl bg-white/[0.04] p-4 text-center text-[14px] text-slate-400">
                Nothing found for “{find}”. Try another word, or open the Help centre.
              </p>
            )
          ) : (
          <>
          {/* Quick actions */}
          <div className={cn('grid gap-2.5', { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[quick.length])}>
            {quick.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                onClick={close}
                className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.04] px-1 py-3.5 active:bg-white/[0.08]"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-300/10">
                  <q.icon className="size-5 text-amber-300" />
                </span>
                <span className="text-center text-[12px] font-medium leading-tight text-slate-200">{q.label}</span>
              </Link>
            ))}
          </div>

          <Section title="Take part">
            {community.map((r) => <MenuRow key={r.to} row={r} onClick={close} />)}
          </Section>

          {admin.length ? (
            <Section title={isAdmin ? 'Admin' : 'Volunteer team'}>
              {admin.map((r) => <MenuRow key={r.to} row={r} onClick={close} />)}
            </Section>
          ) : null}

          <Section title="Settings">
            {user ? (
              <ToggleRow
                icon={Phone}
                label="Voice & video calls"
                hint={callsOn ? 'Members can call you' : 'Calls are turned off'}
                checked={callsOn}
                onChange={(v) => void setCallsEnabled(v, { userId: user.id })}
              />
            ) : null}
            <ToggleRow icon={Moon} label="Dark mode" checked={theme === 'dark'} onChange={() => toggleTheme()} />
            {appRows.map((r) => <MenuRow key={r.to} row={r} onClick={close} />)}
          </Section>

          <Section title="About">
            {about.map((r) => <MenuRow key={r.to} row={r} onClick={close} />)}
          </Section>

          <Section title="Help & rules">
            {help.map((r) => <MenuRow key={r.to} row={r} onClick={close} />)}
          </Section>
          </>
          )}

          {user ? (
            <button
              type="button"
              onClick={async () => {
                close()
                await signOut()
                navigate('/')
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/30 text-[15px] font-semibold text-rose-300 active:bg-rose-400/10"
            >
              <LogOut className="size-[18px]" />
              Sign out
            </button>
          ) : null}

          <p className="flex items-center justify-center gap-1.5 pb-1 text-center text-xs text-slate-500">
            <Sparkles className="size-3.5" /> AbiaConnect · One People. One Voice.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.04]">{children}</div>
    </section>
  )
}

function MenuRow({ row, onClick }: { row: Row; onClick: () => void }) {
  const content = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          row.highlight ? 'bg-amber-300/15' : 'bg-white/[0.06]',
        )}
      >
        <row.icon className={cn('size-[18px]', row.highlight ? 'text-amber-300' : 'text-slate-300')} />
      </span>
      <span className="min-w-0 flex-1 py-2">
        <span className={cn('block text-[15px]', row.highlight ? 'font-semibold text-amber-200' : 'text-slate-100')}>
          {row.label}
        </span>
        {row.hint ? <span className="block text-[12.5px] leading-snug text-slate-400">{row.hint}</span> : null}
      </span>
      {row.dot ? <span className="size-2 rounded-full bg-red-500" aria-label="Update available" /> : null}
      <ChevronRight className="size-[18px] text-slate-600" />
    </>
  )
  const className = 'flex min-h-[52px] items-center gap-3 px-3.5 active:bg-white/[0.06]'
  return row.external ? (
    <a href={row.to} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {content}
    </a>
  ) : (
    <Link to={row.to} onClick={onClick} className={className}>
      {content}
    </Link>
  )
}

function ToggleRow({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3.5 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
        <Icon className="size-[18px] text-slate-300" />
      </span>
      <span className="flex-1">
        <span className="block text-[15px] text-slate-100">{label}</span>
        {hint ? <span className="block text-[12px] text-slate-400">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

export default NativeMoreSheet
