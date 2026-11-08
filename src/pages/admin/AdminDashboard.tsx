import { AiProviderSection } from '@/components/admin/AiProviderSection'
import { NewcomerFunnelSection } from '@/components/admin/NewcomerFunnelSection'
import { ChampionsSection } from '@/components/admin/ChampionsSection'
import { LiveRoomsSection } from '@/components/admin/LiveRoomsSection'
import { TrustedMembersSection } from '@/components/admin/TrustedMembersSection'
import { useEffect, useMemo, useState } from 'react'
import { toWebP } from '@/lib/image'
import { useAuth } from '@/contexts/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { AlertTriangle, BarChart3, Ban, CheckCircle2, Flag, FolderTree, Inbox, Loader2, Mail, MessageSquare, Pencil, Plus, Save, Search, Settings, Shield, Star, Trash2, Users, Vote, Bot } from 'lucide-react'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { useSiteSettings, SiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { SafeImage } from '@/components/ui/SafeImage'

import CategoriesSection from '@/components/admin/CategoriesSection'
import HeroSlidesSection, {
  HeroSlidesExpiryAlert,
} from '@/components/admin/HeroSlidesSection'
import { Image as ImageIcon } from 'lucide-react'
import AppReleasesSection from '@/components/admin/AppReleasesSection'
import TestPushSection from '@/components/admin/TestPushSection'
import BirthdaysTodaySection from '@/components/admin/BirthdaysTodaySection'
import IssueReportsSection from '@/components/admin/IssueReportsSection'
import MemberEmailsSection from '@/components/admin/MemberEmailsSection'
import VolunteerApplicationsSection from '@/components/admin/VolunteerApplicationsSection'
import { HandHelping } from 'lucide-react'
import NewsdeskSection from '@/components/admin/NewsdeskSection'
import { Newspaper } from 'lucide-react'
import DatingMonetizationSection from '@/components/admin/DatingMonetizationSection'
import { HeartHandshake, Radio } from 'lucide-react'
import { Download as DownloadIcon, BellRing, Cake, Award, BadgeCheck } from 'lucide-react'
import { deleteAttachmentPaths, extractAttachmentPaths } from '@/lib/threadAttachments'

type SectionId =
  | 'overview'
  | 'users'
  | 'champions'
  | 'trusted'
  | 'categories'
  | 'moderation'
  | 'polls'
  | 'subgroups'
  | 'settings'
  | 'slides'
  | 'email'
  | 'native-apps'
  | 'test-push'
  | 'birthdays'
  | 'newsdesk'
  | 'ai'
  | 'problem-reports'
  | 'volunteers'
  | 'monetization'
  | 'live'

type NavItem = { id: SectionId; label: string; hint: string; Icon: any }

// Grouped by the job an admin is doing, each with a one-line plain explanation.
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Start here',
    items: [{ id: 'overview', label: 'Today', hint: 'What needs your attention and how the site is doing.', Icon: BarChart3 }],
  },
  {
    title: 'Keep the site safe',
    items: [
      { id: 'moderation', label: 'Reported posts', hint: 'Posts and comments members reported. Keep or remove them.', Icon: Flag },
      { id: 'problem-reports', label: 'Problem reports', hint: 'Bugs and problems members told us about.', Icon: AlertTriangle },
    ],
  },
  {
    title: 'Members',
    items: [
      { id: 'users', label: 'All members', hint: 'Find a member, change their role, or block them.', Icon: Users },
      { id: 'champions', label: 'LGA Champions', hint: 'Members who lead each Local Government Area group.', Icon: Award },
      { id: 'trusted', label: 'Trusted members', hint: 'Members whose posts go up without waiting for review.', Icon: BadgeCheck },
      { id: 'volunteers', label: 'Volunteer applications', hint: 'People who offered to help. Approve or decline.', Icon: HandHelping },
      { id: 'birthdays', label: 'Birthdays today', hint: 'Members celebrating today, and the greeting they get.', Icon: Cake },
    ],
  },
  {
    title: 'Content',
    items: [
      { id: 'slides', label: 'Home page slides', hint: 'The big pictures at the top of the home page.', Icon: ImageIcon },
      { id: 'categories', label: 'Forum categories', hint: 'The topics discussions are sorted into.', Icon: FolderTree },
      { id: 'subgroups', label: 'Groups', hint: 'Community groups, their owners and members.', Icon: Shield },
      { id: 'polls', label: 'Polls', hint: 'Create, close or remove polls.', Icon: Vote },
      { id: 'newsdesk', label: 'Newsdesk bot', hint: 'Automatic news posts: sources and timing.', Icon: Newspaper },
    ],
  },
  {
    title: 'Live, app & notifications',
    items: [
      { id: 'live', label: 'Live rooms', hint: 'Turn Live on or off, see free minutes left, handle reports.', Icon: Radio },
      { id: 'native-apps', label: 'Mobile app', hint: 'App versions and download links.', Icon: DownloadIcon },
      { id: 'test-push', label: 'Test a notification', hint: 'Send yourself a test notification to check it works.', Icon: BellRing },
    ],
  },
  {
    title: 'Money',
    items: [{ id: 'monetization', label: 'Relationship & Premium', hint: 'Plans, prices and paid features.', Icon: HeartHandshake }],
  },
  {
    title: 'Settings',
    items: [
      { id: 'settings', label: 'Site settings', hint: 'Site name, look, and features you can switch on or off.', Icon: Settings },
      { id: 'email', label: 'Emails', hint: 'Which emails members get and how they are sent.', Icon: Mail },
      { id: 'ai', label: 'Writing assistant', hint: 'The service that helps write posts and replies.', Icon: Bot },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })))

function isSectionId(v: string | null): v is SectionId {
  return !!v && ALL_ITEMS.some((i) => i.id === v)
}

/** Things waiting for an admin, shown as numbers in the menu and on the Today page. */
export function useAdminTodo() {
  return useQuery({
    queryKey: ['admin-todo'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const count = async (q: PromiseLike<{ count: number | null }>) => {
        try {
          return (await q).count ?? 0
        } catch {
          return 0
        }
      }
      const db = supabase as any
      const [reports, problems, volunteers] = await Promise.all([
        count(supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
        count(db.from('issue_reports').select('*', { count: 'exact', head: true }).neq('status', 'resolved')),
        count(db.from('volunteer_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      ])
      return { moderation: reports, 'problem-reports': problems, volunteers } as Partial<Record<SectionId, number>>
    },
  })
}

export default function AdminDashboard() {
  // The open section is kept in the address (?section=live), so refresh and Back work.
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('section')
  const section: SectionId = isSectionId(fromUrl) ? fromUrl : 'overview'
  const [menuOpen, setMenuOpen] = useState(false)
  const [find, setFind] = useState('')
  const todo = useAdminTodo()
  const current = ALL_ITEMS.find((i) => i.id === section)!

  const go = (id: SectionId) => {
    setParams(id === 'overview' ? {} : { section: id })
    setMenuOpen(false)
    setFind('')
    window.scrollTo({ top: 0 })
  }

  const term = find.trim().toLowerCase()
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: term ? g.items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(term)) : g.items,
  })).filter((g) => g.items.length)

  const menu = (
    <nav aria-label="Admin sections" className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="Find a section…"
          aria-label="Find a section"
          className="h-9 pl-8 text-sm"
        />
      </div>
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((s) => {
              const active = s.id === section
              const waiting = todo.data?.[s.id] ?? 0
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={active ? 'page' : undefined}
                    title={s.hint}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted/70',
                    )}
                  >
                    <s.Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {waiting > 0 ? (
                      <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${waiting} waiting`}>
                        {waiting > 99 ? '99+' : waiting}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {!groups.length ? <p className="px-2 text-sm text-muted-foreground">Nothing matches “{find}”.</p> : null}
    </nav>
  )

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="shrink-0 lg:w-64">
          {/* Phones: one button that opens the menu, instead of a wall of buttons. */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left"
            >
              <current.Icon className="h-5 w-5 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Admin · {current.group}</span>
                <span className="block font-semibold">{current.label}</span>
              </span>
              <span className="text-sm font-medium text-primary">{menuOpen ? 'Close' : 'Menu'}</span>
            </button>
            {menuOpen ? <div className="mt-2 rounded-2xl border bg-card p-3">{menu}</div> : null}
          </div>
          <div className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border bg-card p-3 lg:block">
            <p className="px-2 pb-3 text-sm font-bold">Admin</p>
            {menu}
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          {section !== 'overview' ? (
            <header className="rounded-2xl border bg-card px-5 py-4">
              <p className="text-[12px] text-muted-foreground">
                <button type="button" onClick={() => go('overview')} className="hover:underline">
                  Admin
                </button>{' '}
                › {current.group}
              </p>
              <h1 className="mt-0.5 flex items-center gap-2 text-xl font-bold">
                <current.Icon className="h-5 w-5 text-primary" /> {current.label}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{current.hint}</p>
            </header>
          ) : null}

          {section === 'overview' && (
            <>
              <HeroSlidesExpiryAlert />
              <OverviewSection onOpen={go} />
              <NewcomerFunnelSection />
            </>
          )}
          {section === 'users' && <UsersSection />}
          {section === 'champions' && <ChampionsSection />}
          {section === 'trusted' && <TrustedMembersSection />}
          {section === 'categories' && <CategoriesSection />}
          {section === 'moderation' && <ModerationSection />}
          {section === 'polls' && <PollsSection />}
          {section === 'subgroups' && <SubgroupsSection />}
          {section === 'settings' && <SiteSettingsSection />}
          {section === 'slides' && <HeroSlidesSection />}
          {section === 'email' && (
            <>
              <MemberEmailsSection />
              <EmailSettingsSection />
            </>
          )}
          {section === 'native-apps' && <AppReleasesSection />}
          {section === 'test-push' && <TestPushSection />}
          {section === 'birthdays' && <BirthdaysTodaySection />}
          {section === 'newsdesk' && <NewsdeskSection />}
          {section === 'ai' && <AiProviderSection />}
          {section === 'problem-reports' && <IssueReportsSection />}
          {section === 'volunteers' && <VolunteerApplicationsSection />}
          {section === 'monetization' && <DatingMonetizationSection />}
          {section === 'live' && <LiveRoomsSection />}
        </main>
      </div>
    </div>
  )
}

// ---------- helpers ----------
function SectionShell({
  title,
  description,
  children,
  actions,
  showTitle = false,
}: {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
  /** The page header above already names the section; only Today shows its own title. */
  showTitle?: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className={showTitle ? 'text-2xl font-bold' : 'sr-only'}>{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-12 rounded-xl border border-dashed text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-60" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

// ---------- 1. OVERVIEW ----------
function OverviewSection({ onOpen }: { onOpen: (id: SectionId) => void }) {
  const todo = useAdminTodo()
  const statsQ = useQuery({
    queryKey: ['admin-overview-stats'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const [users, threads, active, reports] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('threads').select('*', { count: 'exact', head: true }),
        supabase
          .from('threads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since),
        supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ])
      return {
        users: users.count ?? 0,
        threads: threads.count ?? 0,
        active: active.count ?? 0,
        reports: reports.count ?? 0,
      }
    },
  })

  const recentUsersQ = useQuery({
    queryKey: ['admin-recent-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as any[]
    },
  })

  const recentReportsQ = useQuery({
    queryKey: ['admin-recent-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as any[]
    },
  })

  const stats = [
    { label: 'Members', value: statsQ.data?.users ?? 0, Icon: Users },
    { label: 'Discussions', value: statsQ.data?.threads ?? 0, Icon: MessageSquare },
    { label: 'New discussions (24 hours)', value: statsQ.data?.active ?? 0, Icon: BarChart3 },
    { label: 'Reports waiting', value: statsQ.data?.reports ?? 0, Icon: Flag },
  ]

  const waiting: { id: SectionId; count: number; text: string; action: string }[] = [
    { id: 'moderation' as SectionId, count: todo.data?.moderation ?? 0, text: 'reported posts to review', action: 'Review' },
    { id: 'problem-reports' as SectionId, count: todo.data?.['problem-reports'] ?? 0, text: 'problem reports not yet solved', action: 'Open' },
    { id: 'volunteers' as SectionId, count: todo.data?.volunteers ?? 0, text: 'volunteer applications waiting', action: 'Decide' },
  ].filter((w) => w.count > 0)

  const shortcuts: { id: SectionId; label: string; Icon: any }[] = [
    { id: 'users', label: 'Find a member', Icon: Users },
    { id: 'slides', label: 'Change home page slides', Icon: ImageIcon },
    { id: 'live', label: 'Live rooms & free minutes', Icon: Radio },
    { id: 'test-push', label: 'Test a notification', Icon: BellRing },
  ]

  return (
    <SectionShell title="Today" description="What needs your attention, and how AbiaConnect is doing." showTitle>
      <section className="rounded-2xl border bg-card p-4" aria-label="Needs your attention">
        <h2 className="font-semibold">Needs your attention</h2>
        {todo.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Checking…</p>
        ) : waiting.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> All clear. Nothing is waiting for you.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {waiting.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <span>
                  <span className="mr-1.5 inline-flex min-w-6 justify-center rounded-full bg-rose-600 px-1.5 text-[12px] font-bold leading-6 text-white">
                    {w.count}
                  </span>
                  {w.text}
                </span>
                <Button size="sm" onClick={() => onOpen(w.id)}>
                  {w.action}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Shortcuts">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Shortcuts</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {shortcuts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              className="flex items-center gap-2 rounded-xl border bg-card p-3 text-left text-sm font-medium hover:bg-muted/60"
            >
              <c.Icon className="h-4 w-4 shrink-0 text-primary" /> {c.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <s.Icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="text-2xl font-bold mt-2">
              {statsQ.isLoading ? '—' : s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="font-semibold mb-3">Newest members</h3>
          {recentUsersQ.isLoading ? (
            <Spinner />
          ) : (recentUsersQ.data ?? []).length === 0 ? (
            <EmptyState icon={Users} message="No members yet" />
          ) : (
            <ul className="space-y-2">
              {recentUsersQ.data!.map((u) => (
                <li key={u.id} className="flex items-center gap-3 text-sm">
                  <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                    {(u.display_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{u.display_name || u.username || 'User'}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.created_at &&
                        formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Latest reports</h3>
            <button type="button" onClick={() => onOpen('moderation')} className="text-sm font-medium text-primary hover:underline">
              See all
            </button>
          </div>
          {recentReportsQ.isLoading ? (
            <Spinner />
          ) : (recentReportsQ.data ?? []).length === 0 ? (
            <EmptyState icon={Flag} message="No one has reported anything." />
          ) : (
            <ul className="space-y-2">
              {recentReportsQ.data!.map((r) => (
                <li key={r.id} className="rounded-lg border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{r.reason || 'Reported'}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionShell>
  )
}

// ---------- 2. USERS ----------
function UsersSection() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 10

  const usersQ = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: async () => {
      let ids: string[] | null = null
      if (search.trim() && search.includes('@')) {
        const { data: matches } = await supabase.rpc('admin_search_user_ids_by_email', {
          _term: search.trim(),
        })
        ids = ((matches as { id: string }[] | null) ?? []).map((r) => r.id)
        if (ids.length === 0) return { rows: [], total: 0 }
      }
      const { data, error } = await supabase.rpc('admin_list_users', {
        _search: search.trim() && !search.includes('@') ? search.trim() : undefined,
        _ids: ids ?? undefined,
        _limit: pageSize,
        _offset: page * pageSize,
      })
      if (error) throw error
      const rows = (data ?? []) as any[]
      const total = rows[0]?.total_count ?? 0
      return { rows, total: Number(total) }
    },
  })

  const banMut = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: banned })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('User updated')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const roleMut = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      // Delete existing roles then insert new
      await supabase.from('user_roles').delete().eq('user_id', id)
      if (role !== 'Member') {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: id, role: role as 'Admin' | 'Member' | 'Super Admin' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Role updated')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_delete_user', { _user_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('User permanently deleted')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-overview-stats'] })
      qc.invalidateQueries({ queryKey: ['admin-recent-users'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  useEffect(() => {
    const channel = supabase
      .channel('admin-users-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-users'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-users'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  const total = usersQ.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <SectionShell title="User Management" description={`${total} users`}>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search by name, username or email..."
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQ.isLoading ? (
              <tr>
                <td colSpan={6}>
                  <Spinner />
                </td>
              </tr>
            ) : (usersQ.data?.rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon={Users} message="No users found" />
                </td>
              </tr>
            ) : (
              usersQ.data!.rows.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {(u.display_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium">
                          {u.display_name || u.username || 'User'}
                        </p>
                        {u.username && (
                          <p className="text-xs text-muted-foreground">@{u.username}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{u.email || '—'}</td>
                  <td className="p-3">
                    <Select
                      value={u.role || 'Member'}
                      onValueChange={(role) => roleMut.mutate({ id: u.id, role })}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Member', 'Moderator', 'Admin', 'Super Admin'].map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {u.created_at ? format(new Date(u.created_at), 'PP') : '—'}
                  </td>
                  <td className="p-3">
                    {u.is_banned ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : u.is_deleted ? (
                      <Badge variant="outline">Deleted</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/profile?id=${u.id}`}>View</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => banMut.mutate({ id: u.id, banned: !u.is_banned })}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      {u.is_banned ? 'Unban' : 'Suspend'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Permanently delete this user and ALL their content? This cannot be undone.')) deleteMut.mutate(u.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {page + 1} of {pages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </SectionShell>
  )
}


function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ---------- 4. MODERATION ----------
function ModerationSection() {
  const qc = useQueryClient()

  const reportsQ = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('reports').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Report updated')
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const removeContent = useMutation({
    mutationFn: async (r: any) => {
      let paths: string[] = []
      if (r.thread_id) {
        const { data } = await supabase.from('threads').select('content').eq('id', r.thread_id).maybeSingle()
        paths = extractAttachmentPaths((data as { content?: string } | null)?.content)
        await supabase.from('threads').delete().eq('id', r.thread_id)
      } else if (r.reply_id) {
        const { data } = await supabase.from('replies').select('content').eq('id', r.reply_id).maybeSingle()
        paths = extractAttachmentPaths((data as { content?: string } | null)?.content)
        await supabase.from('replies').delete().eq('id', r.reply_id)
      }
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', r.id)
      if (paths.length) await deleteAttachmentPaths(paths)
    },
    onSuccess: () => {
      toast.success('Content removed')
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const warnUser = useMutation({
    mutationFn: async (r: any) => {
      if (!r.reported_user_id) throw new Error('No user attached')
      const { error } = await supabase.from('notifications').insert({
        user_id: r.reported_user_id,
        type: 'system',
        message: `You have received a warning from moderators: ${r.reason || 'Community guidelines violation'}`,
      })
      if (error) throw error
    },
    onSuccess: () => toast.success('User warned'),
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const banUser = useMutation({
    mutationFn: async (r: any) => {
      if (!r.reported_user_id) throw new Error('No user attached')
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', r.reported_user_id)
      if (error) throw error
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', r.id)
    },
    onSuccess: () => {
      toast.success('User banned')
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  return (
    <SectionShell title="Moderation Queue" description="Pending reports needing review">
      {reportsQ.isLoading ? (
        <Spinner />
      ) : (reportsQ.data ?? []).length === 0 ? (
        <EmptyState icon={CheckCircle2} message="No pending reports — you're all caught up." />
      ) : (
        <div className="space-y-3">
          {reportsQ.data!.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <Badge variant="outline" className="mb-2">
                    <AlertTriangle className="h-3 w-3 mr-1" /> {r.reason || 'Reported'}
                  </Badge>
                  <p className="text-sm">
                    {r.thread_id
                      ? `Thread report (id: ${r.thread_id.slice(0, 8)}…)`
                      : r.reply_id
                        ? `Reply report (id: ${r.reply_id.slice(0, 8)}…)`
                        : 'Report'}
                  </p>
                  {r.details && (
                    <p className="text-xs text-muted-foreground mt-1">{r.details}</p>
                  )}
                  {r.ai_note && (
                    <p className="mt-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs text-foreground/80">
                      <span className="font-semibold">Ugo (AI guardian):</span> {r.ai_note}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus.mutate({ id: r.id, status: 'dismissed' })}
                >
                  Dismiss
                </Button>
                <Button size="sm" variant="outline" onClick={() => removeContent.mutate(r)}>
                  Remove Content
                </Button>
                <Button size="sm" variant="outline" onClick={() => warnUser.mutate(r)}>
                  Warn User
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => banUser.mutate(r)}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" /> Ban User
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  )
}

// ---------- 5. POLLS ----------
function PollsSection() {
  const qc = useQueryClient()

  const pollsQ = useQuery({
    queryKey: ['admin-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    },
  })

  const closeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('polls')
        .update({ expires_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Poll closed')
      qc.invalidateQueries({ queryKey: ['admin-polls'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Deleted')
      qc.invalidateQueries({ queryKey: ['admin-polls'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const pollStatus = (p: any) => {
    if (!p.is_active) return { label: 'Closed', variant: 'outline' as const }
    if (p.expires_at && new Date(p.expires_at) < new Date())
      return { label: 'Expired', variant: 'outline' as const }
    return { label: 'Active', variant: 'secondary' as const }
  }

  return (
    <SectionShell
      title="Polls Management"
      description="View, end, and remove community polls"
      actions={
        <Button asChild>
          <Link to="/polls">
            <Plus className="h-4 w-4 mr-1" /> Create Poll
          </Link>
        </Button>
      }
    >
      {pollsQ.isLoading ? (
        <Spinner />
      ) : (pollsQ.data ?? []).length === 0 ? (
        <EmptyState icon={Vote} message="No polls yet" />
      ) : (
        <div className="rounded-2xl border bg-card divide-y">
          {pollsQ.data!.map((p) => {
            const s = pollStatus(p)
            return (
              <div key={p.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.question}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant={s.variant}>{s.label}</Badge>
                {p.is_active && (
                  <Button variant="ghost" size="sm" onClick={() => closeMut.mutate(p.id)}>
                    End now
                  </Button>
                )}
                <DeleteButton onConfirm={() => delMut.mutate(p.id)} />
              </div>
            )
          })}
        </div>
      )}
    </SectionShell>
  )
}

// ---------- 6. SUBGROUPS ----------
function SubgroupsSection() {
  const qc = useQueryClient()

  const groupsQ = useQuery({
    queryKey: ['admin-subgroups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroups')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    },
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from('subgroups').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Updated')
      qc.invalidateQueries({ queryKey: ['admin-subgroups'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subgroups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Deleted')
      qc.invalidateQueries({ queryKey: ['admin-subgroups'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  return (
    <SectionShell title="Subgroups" description="Approve, feature, or remove subgroups">
      {groupsQ.isLoading ? (
        <Spinner />
      ) : (groupsQ.data ?? []).length === 0 ? (
        <EmptyState icon={Shield} message="No subgroups yet" />
      ) : (
        <div className="rounded-2xl border bg-card divide-y">
          {groupsQ.data!.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{s.name}</p>
                  {s.is_featured && <Badge variant="secondary">Featured</Badge>}
                  {!s.is_active && <Badge variant="outline">Pending</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{s.description}</p>
              </div>
              {!s.is_active && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMut.mutate({ id: s.id, patch: { is_active: true } })}
                >
                  Approve
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateMut.mutate({ id: s.id, patch: { is_featured: !s.is_featured } })
                }
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                {s.is_featured ? 'Unfeature' : 'Feature'}
              </Button>
              <DeleteButton onConfirm={() => delMut.mutate(s.id)} />
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  )
}

// ---------- 7. SITE SETTINGS ----------
const TOGGLE_KEYS = [
  'global_commenting_enabled',
  'global_voting_enabled',
  'global_bookmarks_enabled',
  'global_follows_enabled',
  'global_messages_enabled',
  'global_polls_enabled',
  'global_subgroups_enabled',
]

function SiteSettingsSection() {
  const { settings, isLoading, updateSetting } = useSiteSettings()
  const [draft, setDraft] = useState<SiteSettings>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const draftLogoUrl = useSignedUrl(draft.site_logo, 'site-assets')

  useEffect(() => {
    if (!isLoading) setDraft(settings)
  }, [isLoading, settings])

  const setKey = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const changed = Object.entries(draft).filter(([k, v]) => settings[k] !== v)
      for (const [key, value] of changed) {
        await updateSetting.mutateAsync({ key, value })
      }
      window.dispatchEvent(new Event('siteSettingsUpdated'))
      toast.success('Settings saved')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleLogo = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const webp = await toWebP(file)
      const path = `logos/${Date.now()}-${webp.name}`
      const { uploadAndScan } = await import('@/lib/scanAttachment')
      const res = await uploadAndScan('site-assets', path, webp, {
        contentType: webp.type,
        upsert: true,
      })
      if (!res.uploaded) throw new Error(res.error || 'Logo blocked by security scan')
      await updateSetting.mutateAsync({ key: 'site_logo', value: path })
      setKey('site_logo', path)
      window.dispatchEvent(new Event('siteSettingsUpdated'))
      toast.success('Logo updated')
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) return <Spinner />

  return (
    <SectionShell
      title="Site Settings"
      description="Branding, links, and global feature toggles"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Save Changes
        </Button>
      }
    >



      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Site Name</Label>
            <Input
              value={draft.site_name || ''}
              onChange={(e) => setKey('site_name', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Site Tagline</Label>
            <Input
              value={draft.site_tagline || ''}
              onChange={(e) => setKey('site_tagline', e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Store Link URL</Label>
            <Input
              value={draft.store_link || ''}
              onChange={(e) => setKey('store_link', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Google Play link (Android app)</Label>
            <Input
              value={draft.play_store_url || ''}
              onChange={(e) => setKey('play_store_url', e.target.value)}
              placeholder="https://play.google.com/store/apps/details?id=com.abiaconnect.app"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty until the app is live on Google Play: members see "Coming soon" and can download the uploaded APK
              instead. Once set, members and the app's update prompt use Google Play.
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>App Store link (iPhone app)</Label>
            <Input
              value={draft.app_store_url || ''}
              onChange={(e) => setKey('app_store_url', e.target.value)}
              placeholder="https://apps.apple.com/app/..."
            />
            <p className="text-xs text-muted-foreground">Leave empty until the app is live on the App Store ("Coming soon").</p>
          </div>
          <div className="space-y-1">
            <Label>Site Theme</Label>
            <Select
              value={draft.site_theme || 'classic'}
              onValueChange={(v) => setKey('site_theme', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="cyber-gold">Cyber Gold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Logo</Label>
            <div className="flex items-center gap-2">
              {draft.site_logo && (
                <SafeImage
                  src={draftLogoUrl}
                  fallback=""
                  alt="Logo"
                  className="h-10 w-10 rounded-lg object-cover border"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleLogo(e.target.files?.[0])}
                disabled={uploading}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="font-semibold mb-3">Feature Toggles</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {TOGGLE_KEYS.map((k) => {
            const on = (draft[k] ?? 'true') !== 'false'
            return (
              <div key={k} className="flex items-center justify-between rounded-lg border p-3">
                <Label className="capitalize">{k.replace(/_/g, ' ')}</Label>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => setKey(k, v ? 'true' : 'false')}
                />
              </div>
            )
          })}
        </div>
      </div>

    </SectionShell>
  )
}


// ---------- 8. EMAIL SETTINGS ----------
function EmailSettingsSection() {
  const { settings, updateSetting } = useSiteSettings()
  const [draft, setDraft] = useState({
    smtp_host: settings.smtp_host || '',
    smtp_port: settings.smtp_port || '587',
    smtp_user: settings.smtp_user || '',
    smtp_password: settings.smtp_password || '',
    smtp_from: settings.smtp_from || '',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')

  const save = async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(draft)) {
        await updateSetting.mutateAsync({ key, value })
      }
      toast.success('Saved')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    setTesting(true)
    setStatus('unknown')
    try {
      const { data, error } = await supabase.functions.invoke('test-email', { method: 'POST' })
      if (error) {
        let message = error.message
        const context = (error as { context?: Response }).context
        if (context) {
          try {
            const body = await context.clone().json()
            message = body?.error || message
          } catch {
            try {
              const body = await context.clone().text()
              message = body || message
            } catch {
              // Keep the original function error message.
            }
          }
        }
        throw new Error(message)
      }
      if (data?.ok === false) throw new Error(data.error || 'Test failed')
      setStatus('ok')
      toast.success('Test email sent')
    } catch (e: any) {
      setStatus('error')
      toast.error(e.message || 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <SectionShell
      title="Email Settings"
      description="SMTP configuration for outbound email"
      actions={
        <div className="flex gap-2">
          <Badge
            variant={
              status === 'ok' ? 'secondary' : status === 'error' ? 'destructive' : 'outline'
            }
          >
            {status === 'ok' ? 'Connected' : status === 'error' ? 'Failed' : 'Unknown'}
          </Badge>
          <Button variant="outline" onClick={sendTest} disabled={testing}>
            {testing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Inbox className="h-4 w-4 mr-1" />
            )}
            Test Email
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border bg-card p-4 grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>SMTP Host</Label>
          <Input
            value={draft.smtp_host}
            onChange={(e) => setDraft({ ...draft, smtp_host: e.target.value })}
            placeholder="smtp.example.com"
          />
        </div>
        <div className="space-y-1">
          <Label>Port</Label>
          <Input
            value={draft.smtp_port}
            onChange={(e) => setDraft({ ...draft, smtp_port: e.target.value })}
            placeholder="587"
          />
        </div>
        <div className="space-y-1">
          <Label>Username</Label>
          <Input
            value={draft.smtp_user}
            onChange={(e) => setDraft({ ...draft, smtp_user: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Password</Label>
          <Input
            type="password"
            value={draft.smtp_password}
            onChange={(e) => setDraft({ ...draft, smtp_password: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>From Address</Label>
          <Input
            value={draft.smtp_from}
            onChange={(e) => setDraft({ ...draft, smtp_from: e.target.value })}
            placeholder="no-reply@example.com"
          />
        </div>
      </div>
    </SectionShell>
  )
}
