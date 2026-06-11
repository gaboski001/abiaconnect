import { useEffect, useMemo, useState } from 'react'
import { toWebP } from '@/lib/image'
import { seedDatabase } from '@/lib/seed'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  BarChart3,
  Ban,
  CheckCircle2,
  Flag,
  FolderTree,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  Star,
  Trash2,
  Users,
  Vote,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSiteSettings, SiteSettings } from '@/hooks/useSiteSettings'
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

type SectionId =
  | 'overview'
  | 'users'
  | 'categories'
  | 'moderation'
  | 'polls'
  | 'subgroups'
  | 'settings'
  | 'email'

const SECTIONS: { id: SectionId; label: string; Icon: any }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'users', label: 'User Management', Icon: Users },
  { id: 'categories', label: 'Categories', Icon: FolderTree },
  { id: 'moderation', label: 'Moderation Queue', Icon: Flag },
  { id: 'polls', label: 'Polls Management', Icon: Vote },
  { id: 'subgroups', label: 'Subgroups', Icon: Shield },
  { id: 'settings', label: 'Site Settings', Icon: Settings },
  { id: 'email', label: 'Email Settings', Icon: Mail },
]

export default function AdminDashboard() {
  const [section, setSection] = useState<SectionId>('overview')
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <div className="rounded-2xl border bg-card p-3 sticky top-24">
            <p className="px-3 pt-2 pb-3 text-xs uppercase tracking-wide text-muted-foreground">
              Admin Portal
            </p>
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:flex-col">
              {SECTIONS.map((s) => {
                const active = s.id === section
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                      active
                        ? 'bg-secondary/10 text-secondary border-l-4 border-secondary'
                        : 'hover:bg-muted/60 border-l-4 border-transparent',
                    )}
                  >
                    <s.Icon className="h-4 w-4" />
                    {s.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {section === 'overview' && <OverviewSection />}
          {section === 'users' && <UsersSection />}
          {section === 'categories' && <CategoriesSection />}
          {section === 'moderation' && <ModerationSection />}
          {section === 'polls' && <PollsSection />}
          {section === 'subgroups' && <SubgroupsSection />}
          {section === 'settings' && <SiteSettingsSection />}
          {section === 'email' && <EmailSettingsSection />}
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
}: {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
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
function OverviewSection() {
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
    { label: 'Total Users', value: statsQ.data?.users ?? 0, Icon: Users },
    { label: 'Total Threads', value: statsQ.data?.threads ?? 0, Icon: MessageSquare },
    { label: 'Active Today', value: statsQ.data?.active ?? 0, Icon: BarChart3 },
    { label: 'Pending Reports', value: statsQ.data?.reports ?? 0, Icon: Flag },
  ]

  return (
    <SectionShell title="Admin Portal" description="System overview and recent activity">
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
          <h3 className="font-semibold mb-3">Recent Registrations</h3>
          {recentUsersQ.isLoading ? (
            <Spinner />
          ) : (recentUsersQ.data ?? []).length === 0 ? (
            <EmptyState icon={Users} message="No users yet" />
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
          <h3 className="font-semibold mb-3">Recent Reports</h3>
          {recentReportsQ.isLoading ? (
            <Spinner />
          ) : (recentReportsQ.data ?? []).length === 0 ? (
            <EmptyState icon={Flag} message="No reports filed" />
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
      let q = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (search.trim()) {
        const term = `%${search.trim()}%`
        if (search.includes('@')) {
          const { data: matches } = await supabase.rpc('admin_search_user_ids_by_email', {
            _term: search.trim(),
          })
          const ids = ((matches as { id: string }[] | null) ?? []).map((r) => r.id)
          if (ids.length === 0) return { rows: [], total: 0 }
          q = q.in('id', ids)
        } else {
          q = q.or(`display_name.ilike.${term},username.ilike.${term}`)
        }
      }
      const { data, error, count } = await q
      if (error) throw error
      const rows = (data ?? []) as any[]
      if (rows.length > 0) {
        const { data: emails } = await supabase.rpc('admin_get_user_emails', {
          _ids: rows.map((r) => r.id),
        })
        const emailMap = new Map(
          ((emails as { id: string; email: string | null }[] | null) ?? []).map((e) => [
            e.id,
            e.email,
          ]),
        )
        rows.forEach((r) => {
          r.email = emailMap.get(r.id) ?? null
        })
      }
      return { rows, total: count ?? 0 }
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
      const { error } = await supabase
        .from('profiles')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('User deleted')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

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
                      defaultValue="Member"
                      onValueChange={(role) => roleMut.mutate({ id: u.id, role })}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Member', 'Moderator', 'Admin', 'Ban'].map((r) => (
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
                        if (confirm('Soft delete this user?')) deleteMut.mutate(u.id)
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

// ---------- 3. CATEGORIES ----------
function CategoriesSection() {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '💬',
    color: '#10b981',
    display_order: 0,
    is_popular: false,
  })

  const catsQ = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as any[]
    },
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name is required')
      if (editingId) {
        const { error } = await supabase
          .from('categories')
          .update(form)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert(form)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Category updated' : 'Category created')
      setEditingId(null)
      setForm({
        name: '',
        description: '',
        icon: '💬',
        color: '#10b981',
        display_order: 0,
        is_popular: false,
      })
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Deleted')
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const startEdit = (c: any) => {
    setEditingId(c.id)
    setForm({
      name: c.name || '',
      description: c.description || '',
      icon: c.icon || '💬',
      color: c.color || '#10b981',
      display_order: c.display_order || 0,
      is_popular: !!c.is_popular,
    })
  }

  return (
    <SectionShell title="Categories" description="Forum categories displayed on the home page">
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold">{editingId ? 'Edit Category' : 'Add Category'}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Icon (emoji)</Label>
            <Input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              maxLength={4}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <Input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-10 p-1"
            />
          </div>
          <div className="space-y-1">
            <Label>Display Order</Label>
            <Input
              type="number"
              value={form.display_order}
              onChange={(e) =>
                setForm({ ...form, display_order: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_popular}
              onCheckedChange={(v) => setForm({ ...form, is_popular: v })}
            />
            <Label>Mark as popular</Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : editingId ? (
              <Save className="h-4 w-4 mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            {editingId ? 'Save' : 'Add Category'}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        {catsQ.isLoading ? (
          <Spinner />
        ) : (catsQ.data ?? []).length === 0 ? (
          <EmptyState icon={FolderTree} message="No categories yet" />
        ) : (
          <ul className="divide-y">
            {catsQ.data!.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <span className="text-xl">{c.icon || '💬'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    {c.is_popular && <Badge variant="secondary">Popular</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <DeleteButton onConfirm={() => delMut.mutate(c.id)} />
              </li>
            ))}
          </ul>
        )}
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
      if (r.thread_id) {
        await supabase.from('threads').delete().eq('id', r.thread_id)
      } else if (r.reply_id) {
        await supabase.from('replies').delete().eq('id', r.reply_id)
      }
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', r.id)
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
      const { error } = await supabase.storage.from('site-assets').upload(path, webp, {
        upsert: true,
        contentType: webp.type,
      })
      if (error) throw error
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path)
      const url = data.publicUrl
      await updateSetting.mutateAsync({ key: 'site_logo', value: url })
      setKey('site_logo', url)
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
      <SeedDatabaseCard />

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
                <img
                  src={draft.site_logo}
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

function SeedDatabaseCard() {
  const { user } = useAuth()
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!user) {
      toast.error('You must be signed in as an admin')
      return
    }
    setRunning(true)
    try {
      const result = await seedDatabase(user.id)
      localStorage.setItem('abiaconnect_seeded', 'true')
      toast.success(
        `✅ Database seeded successfully! ${result.counts.categories} categories, ${result.counts.threads} threads, ${result.counts.subgroups} subgroups are ready.`,
      )
    } catch (e: any) {
      toast.error(e.message || 'Seeding failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-orange-400/70 bg-orange-50/60 dark:bg-orange-950/20 p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-orange-900 dark:text-orange-200">
          ⚠️ Seed Initial Content
        </h3>
        <p className="text-sm text-orange-900/80 dark:text-orange-200/80 mt-1">
          This will populate the forum with starter categories, sample threads, and subgroups. Run
          once only.
        </p>
      </div>
      <Button onClick={run} disabled={running} variant="default">
        {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
        Seed Database Now
      </Button>
    </div>
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
      const { error } = await supabase.functions.invoke('test-email')
      if (error) throw error
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
