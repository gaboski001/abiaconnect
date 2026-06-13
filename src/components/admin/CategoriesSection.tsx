import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FolderTree,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sprout,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

interface Category {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  display_order: number
  is_popular: boolean
  is_active: boolean
  thread_count: number
}

const EMOJI_PICKS = ['💬','💼','🗳️','🏛️','📚','❤️','🌿','💻','🏠','🎭','✈️','🏆','🛡️','🙏','🎓','⚽','🍽️','🎵','🌍','💡']

const schema = z.object({
  name: z.string().trim().min(3, 'At least 3 characters').max(60),
  description: z.string().trim().min(10, 'At least 10 characters').max(200),
  icon: z.string().trim().min(1, 'Pick an emoji').max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Hex color required'),
  display_order: z.coerce.number().int().min(1),
  is_popular: z.boolean(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const DEFAULTS: FormValues = {
  name: '',
  description: '',
  icon: '💬',
  color: '#013220',
  display_order: 1,
  is_popular: false,
  is_active: true,
}

type FilterKey = 'all' | 'active' | 'inactive' | 'popular'

export default function CategoriesSection() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [seeding, setSeeding] = useState(false)

  const catsQ = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })

  const all = catsQ.data ?? []
  const highestOrder = useMemo(
    () => all.reduce((m, c) => Math.max(m, c.display_order || 0), 0),
    [all],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return all.filter((c) => {
      if (filter === 'active' && !c.is_active) return false
      if (filter === 'inactive' && c.is_active) return false
      if (filter === 'popular' && !c.is_popular) return false
      if (!term) return true
      return (
        c.name.toLowerCase().includes(term) ||
        (c.description ?? '').toLowerCase().includes(term)
      )
    })
  }, [all, search, filter])

  // ---------- mutations ----------
  const upsertMut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const { error } = await supabase.from('categories').update(values).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert(values)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editing ? '✅ Category updated' : '✅ Category created successfully')
      setDialogOpen(false)
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Category deleted')
      setDeleting(null)
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  })

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('categories')
        .update({ is_active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const reorderMut = useMutation({
    mutationFn: async (rows: Category[]) => {
      // batch update each affected row with new display_order
      const updates = rows.map((r, idx) =>
        supabase.from('categories').update({ display_order: idx + 1 }).eq('id', r.id),
      )
      const results = await Promise.all(updates)
      const firstErr = results.find((r) => r.error)
      if (firstErr?.error) throw firstErr.error
    },
    onSuccess: () => {
      toast.success('Reorder saved')
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'Reorder failed'),
  })

  const bulkMut = useMutation({
    mutationFn: async ({
      ids,
      action,
    }: {
      ids: string[]
      action: 'activate' | 'deactivate' | 'delete'
    }) => {
      if (action === 'delete') {
        const { error } = await supabase.from('categories').delete().in('id', ids)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('categories')
          .update({ is_active: action === 'activate' })
          .in('id', ids)
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === 'delete'
          ? `${vars.ids.length} categories deleted`
          : `${vars.ids.length} categories ${vars.action}d`,
      )
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'Bulk action failed'),
  })

  // ---------- dnd ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = filtered.findIndex((c) => c.id === active.id)
    const newIdx = filtered.findIndex((c) => c.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    // Reorder only within the full list space
    const ids = all.map((c) => c.id)
    const fromIdx = ids.indexOf(active.id as string)
    const toIdx = ids.indexOf(over.id as string)
    const next = arrayMove(all, fromIdx, toIdx)
    // optimistic
    qc.setQueryData(['admin-categories'], next)
    reorderMut.mutate(next)
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (c: Category) => {
    setEditing(c)
    setDialogOpen(true)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Manage the forum categories displayed across the site.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>


      {/* search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="pl-8"
          />
        </div>
        {(['all', 'active', 'inactive', 'popular'] as FilterKey[]).map((k) => (
          <Button
            key={k}
            variant={filter === k ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(k)}
            className="capitalize"
          >
            {k}
          </Button>
        ))}
      </div>

      {/* bulk action bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkMut.mutate({ ids: [...selected], action: 'activate' })
              }
            >
              Activate All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkMut.mutate({ ids: [...selected], action: 'deactivate' })
              }
            >
              Deactivate All
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                bulkMut.mutate({ ids: [...selected], action: 'delete' })
              }
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* list */}
      <div className="rounded-2xl border border-border bg-card">
        {catsQ.isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FolderTree className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No categories match your filters.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border">
                {filtered.map((c) => (
                  <SortableRow
                    key={c.id}
                    category={c}
                    selected={selected.has(c.id)}
                    onSelect={() => toggleSelect(c.id)}
                    onEdit={() => openEdit(c)}
                    onDelete={() => setDeleting(c)}
                    onToggleActive={(v) =>
                      toggleActiveMut.mutate({ id: c.id, is_active: v })
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* form dialog */}
      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditing(null)
        }}
        editing={editing}
        highestOrder={highestOrder}
        submitting={upsertMut.isPending}
        onSubmit={(v) => upsertMut.mutate(v)}
      />

      {/* delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting "{deleting?.name}" will NOT delete its threads — threads will become
              uncategorised. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SortableRow({
  category,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  category: Category
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleActive: (v: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3',
        isDragging && 'opacity-60',
        !category.is_active && 'opacity-50',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked={selected} onCheckedChange={onSelect} />
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center text-xl border"
        style={{
          backgroundColor: `${category.color ?? '#013220'}26`,
          borderColor: `${category.color ?? '#013220'}4D`,
        }}
      >
        {category.icon ?? '💬'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-foreground truncate">{category.name}</p>
          {category.is_popular && (
            <Badge variant="secondary" className="text-[10px]">
              🔥 Popular
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {category.thread_count} threads
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{category.description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={category.is_active}
          onCheckedChange={onToggleActive}
          aria-label="Active"
        />
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  )
}

function CategoryFormDialog({
  open,
  onOpenChange,
  editing,
  highestOrder,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: Category | null
  highestOrder: number
  submitting: boolean
  onSubmit: (v: FormValues) => void
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing
      ? {
          name: editing.name,
          description: editing.description ?? '',
          icon: editing.icon ?? '💬',
          color: editing.color ?? '#013220',
          display_order: editing.display_order || 1,
          is_popular: editing.is_popular,
          is_active: editing.is_active,
        }
      : { ...DEFAULTS, display_order: highestOrder + 1 },
  })

  const desc = form.watch('description') ?? ''
  const icon = form.watch('icon')
  const color = form.watch('color')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            All fields marked * are required.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>Category Name *</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Description *</Label>
            <Textarea rows={3} {...form.register('description')} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {form.formState.errors.description?.message ?? ' '}
              </span>
              <span>{desc.length} / 200</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Icon (Emoji) *</Label>
            <Input
              placeholder="Paste an emoji e.g. 💬"
              {...form.register('icon')}
              maxLength={4}
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {EMOJI_PICKS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => form.setValue('icon', e, { shouldValidate: true })}
                  className={cn(
                    'h-8 w-8 rounded-md border border-border flex items-center justify-center text-lg hover:bg-muted',
                    icon === e && 'ring-2 ring-primary',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            {form.formState.errors.icon && (
              <p className="text-xs text-destructive">{form.formState.errors.icon.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Accent Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => form.setValue('color', e.target.value, { shouldValidate: true })}
                className="h-10 w-14 rounded border border-border bg-transparent cursor-pointer"
              />
              <span
                className="h-10 flex-1 rounded-md border border-border flex items-center px-3 text-sm text-foreground"
                style={{ backgroundColor: `${color}26` }}
              >
                {color}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              This color tints the category icon background.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Display Order</Label>
            <Input type="number" min={1} {...form.register('display_order')} />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first. Current highest is {highestOrder}.
            </p>
            {form.formState.errors.display_order && (
              <p className="text-xs text-destructive">
                {form.formState.errors.display_order.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Mark as Popular</Label>
              <p className="text-xs text-muted-foreground">
                Show this category in the Popular tab
              </p>
            </div>
            <Switch
              checked={form.watch('is_popular')}
              onCheckedChange={(v) => form.setValue('is_popular', v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">
                Uncheck to hide from public
              </p>
            </div>
            <Switch
              checked={form.watch('is_active')}
              onCheckedChange={(v) => form.setValue('is_active', v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
