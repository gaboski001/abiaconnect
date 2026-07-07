import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SEO } from '@/components/SEO'
import { showModerationBlocked } from '@/components/moderation/ModerationBlockedDialog'
import { ThreadEditor } from '@/components/thread/ThreadEditor'
import { clearDraft, loadDraft, saveDraft } from '@/lib/threadDraft'

const schema = z.object({
  category_id: z.string().optional(),
  subgroup_id: z.string().optional(),
  title: z.string().trim().min(10, 'At least 10 characters').max(200, 'Max 200 characters'),
  content: z.string().min(30, 'At least 30 characters'),
  flair: z.string().optional(),
  allow_replies: z.boolean(),
  is_anonymous: z.boolean(),
}).refine((v) => !!v.category_id || !!v.subgroup_id, {
  message: 'Choose a category',
  path: ['category_id'],
})

const FLAIRS = ['Question', 'Discussion', 'Announcement'] as const

type FormValues = z.infer<typeof schema>

interface Category {
  id: string
  name: string
}

const TIPS = [
  'Choose a clear, specific title that describes your topic.',
  'Be respectful — we celebrate Abia State together.',
  'Use tags so others can discover your post.',
  'Add images or links to support your points.',
  'Search first to avoid duplicate threads.',
]

// Lightweight client-side moderation. Keep tight & fast.
const BANNED_KEYWORDS = [
  'kill yourself', 'kys', 'nigger', 'faggot', 'retard',
  'scam link', 'porn', 'xxx', 'rape',
]

function findBanned(text: string): string | null {
  const lower = text.toLowerCase()
  return BANNED_KEYWORDS.find((w) => lower.includes(w)) ?? null
}

export default function CreateThread() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const presetCategory = params.get('category') ?? ''
  const presetSubgroup = params.get('subgroup') ?? ''

  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'list'],
    enabled: !presetSubgroup,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name').order('name')
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })

  const subgroupQ = useQuery({
    queryKey: ['subgroup-mini', presetSubgroup],
    enabled: !!presetSubgroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroups')
        .select('id, name')
        .eq('id', presetSubgroup)
        .single()
      if (error) throw error
      return data
    },
  })

  const membershipQ = useQuery({
    queryKey: ['subgroup-membership', presetSubgroup, user?.id],
    enabled: !!presetSubgroup && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroup_members')
        .select('user_id')
        .eq('subgroup_id', presetSubgroup)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    if (presetSubgroup && membershipQ.isFetched && membershipQ.data === false) {
      toast.error('Join this subgroup to post')
      navigate(`/subgroups/${presetSubgroup}`)
    }
  }, [presetSubgroup, membershipQ.isFetched, membershipQ.data, navigate])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category_id: presetCategory,
      subgroup_id: presetSubgroup,
      title: '',
      content: '',
      flair: undefined,
      allow_replies: true,
      is_anonymous: false,
    },
  })

  useEffect(() => {
    if (presetCategory) form.setValue('category_id', presetCategory)
  }, [presetCategory, form])

  const title = form.watch('title')
  const currentCategoryId = form.watch('category_id')
  void currentCategoryId

  const content = form.watch('content')

  // ---------- Autosave draft ----------
  const draftScope = useMemo(() => {
    if (presetSubgroup) return `subgroup:${presetSubgroup}`
    if (presetCategory) return `category:${presetCategory}`
    return 'new'
  }, [presetSubgroup, presetCategory])
  const restoredRef = useRef(false)
  const submittedRef = useRef(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)

  // Restore once on mount (per scope).
  useEffect(() => {
    if (restoredRef.current) return
    const d = loadDraft(draftScope)
    if (d) {
      form.setValue('title', d.title, { shouldValidate: false })
      form.setValue('content', d.content, { shouldValidate: false })
      setTags(d.tags ?? [])
      setDraftSavedAt(d.updatedAt)
      toast.success('Draft restored')
    }
    restoredRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftScope])

  // Debounced save on any change.
  useEffect(() => {
    if (!restoredRef.current || submittedRef.current) return
    const t = window.setTimeout(() => {
      saveDraft(draftScope, { title, content, tags })
      setDraftSavedAt(Date.now())
    }, 600)
    return () => window.clearTimeout(t)
  }, [draftScope, title, content, tags])

  const discardDraft = () => {
    clearDraft(draftScope)
    form.setValue('title', '')
    form.setValue('content', '')
    setTags([])
    setDraftSavedAt(null)
    toast.success('Draft discarded')
  }



  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').slice(0, 30)
    if (!t || tags.includes(t) || tags.length >= 10) return
    setTags((prev) => [...prev, t])
  }

  const onTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault()
      addTag(tagInput)
      setTagInput('')
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) {
      toast.error('Please sign in')
      return
    }
    const plain = values.content.replace(/<[^>]+>/g, ' ')
    const banned = findBanned(`${values.title} ${plain}`)
    if (banned) {
      toast.error('Your post was flagged for review and not published. Please revise and try again.')
      return
    }

    // AI moderation — blocks abusive content before publishing.
    const moderating = toast.loading('Checking your post…')
    try {
      const { data: mod, error: modErr } = await supabase.functions.invoke('moderate-thread', {
        body: { title: values.title, content: values.content },
      })
      toast.dismiss(moderating)
      if (!modErr && mod && mod.allowed === false) {
        showModerationBlocked({
          surface: 'thread',
          allowed: false,
          reason: mod.reason,
          categories: mod.categories,
          title: values.title,
          content: values.content,
        })
        toast.error('Your post was blocked by AI moderation.')
        return
      }
    } catch {
      toast.dismiss(moderating)
      // fail-open on network error — don't block legitimate users
    }

    const finalTags = values.flair && !tags.includes(values.flair) ? [values.flair, ...tags] : tags
    const { data, error } = await supabase
      .from('threads')
      .insert({
        user_id: user.id,
        title: values.title.trim(),
        content: values.content,
        tags: finalTags,
        allow_replies: values.allow_replies,
        is_anonymous: values.is_anonymous,
        subgroup_id: values.subgroup_id || null,
        category_id: values.category_id || null,
      })
      .select('id')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }
    // Reset content to signal ThreadEditor's cleanup path (mark as submitted).
    submittedRef.current = true
    clearDraft(draftScope)
    form.setValue('content', '')
    toast.success('Thread posted!')
    navigate(`/thread/${(data as { id: string }).id}`)
  })

  const submitting = form.formState.isSubmitting

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <SEO
        title="Start a New Discussion"
        description="Share your thoughts, ask a question, or open a new conversation with the AbiaConnect community. Post in a forum category or your subgroup."
        path="/create-thread"
      />
      <form onSubmit={onSubmit} className="lg:col-span-2 space-y-6">
        <h1 className="text-2xl font-bold">Create a Thread</h1>

        {presetSubgroup ? (
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            Posting in subgroup{' '}
            <span className="font-semibold">{subgroupQ.data?.name ?? '…'}</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={form.watch('category_id')}
              onValueChange={(v) => form.setValue('category_id', v, { shouldValidate: true })}
            >
              <SelectTrigger className="focus:border-primary focus:ring-primary/30">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category_id && (
              <p className="text-xs text-destructive">{form.formState.errors.category_id.message}</p>
            )}
          </div>
        )}



        {presetSubgroup && (
          <div className="space-y-1.5">
            <Label>Flair (optional)</Label>
            <Select
              value={form.watch('flair') ?? ''}
              onValueChange={(v) => form.setValue('flair', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Question, Discussion, Announcement…" />
              </SelectTrigger>
              <SelectContent>
                {FLAIRS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            {...form.register('title')}
            maxLength={200}
            placeholder="What's your thread about?"
          />
          <div className="flex justify-between text-xs">
            <span className="text-destructive">{form.formState.errors.title?.message}</span>
            <span className="text-muted-foreground">{title.length}/200</span>
          </div>
        </div>

        {/* Rich-text content */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label>Your story</Label>
            <span className="text-xs text-muted-foreground">
              Select text for formatting · Empty line shows a “+” to add an image or heading
            </span>
          </div>
          <ThreadEditor
            value={content}
            onChange={(html) => form.setValue('content', html, { shouldValidate: true })}
            placeholder="Open with a strong first line… Then use the toolbar or the + button on the left to structure your post."
            minHeight={360}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              {draftSavedAt
                ? `Draft saved · ${new Date(draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Autosave on — your draft is kept safely on this device.'}
            </span>
            {draftSavedAt && (
              <button
                type="button"
                onClick={discardDraft}
                className="text-destructive hover:underline"
              >
                Discard draft
              </button>
            )}
          </div>
          {form.formState.errors.content && (
            <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
          )}
        </div>


        {/* Tags */}
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-input bg-background p-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                  aria-label={`Remove ${t}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => {
                if (tagInput) {
                  addTag(tagInput)
                  setTagInput('')
                }
              }}
              placeholder={tags.length ? '' : 'comma separated, e.g. culture, sports'}
              className="flex-1 min-w-32 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-6 rounded-xl border border-border bg-card p-4">
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={form.watch('allow_replies')}
              onCheckedChange={(v) => form.setValue('allow_replies', v)}
            />
            Allow Replies
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={form.watch('is_anonymous')}
              onCheckedChange={(v) => form.setValue('is_anonymous', v)}
            />
            Anonymous Post
          </label>
        </div>

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? <><Loader2 className="animate-spin" /> Posting…</> : 'Post Thread'}
        </Button>
      </form>

      <aside className="lg:col-span-1">
        <div className="rounded-2xl border border-border bg-card p-5 sticky top-24">
          <h3 className="font-bold mb-3">Posting Tips</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
            {TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
