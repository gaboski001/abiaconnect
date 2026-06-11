import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { handleImgError } from '@/lib/image'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ArrowBigUp, ChevronRight, Eye, Flame, MessageSquare, Pin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface Category {
  id: string
  name: string
  description?: string | null
  thread_count?: number | null
  icon?: string | null
  color?: string | null
}

type SortKey = 'latest' | 'replies' | 'views' | 'pinned'

interface Thread {
  id: string
  title: string
  created_at: string
  is_pinned?: boolean | null
  upvotes?: number | null
  view_count?: number | null
  user_id?: string | null
  reply_count?: number
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null
}

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const { user } = useAuth()

  const categoryQ = useQuery({
    queryKey: ['category', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId!)
        .maybeSingle()
      if (error) throw error
      return data as Category | null
    },
  })

  const threadsQ = useQuery({
    queryKey: ['threads', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('*, profiles(display_name, avatar_url), replies(count)')
        .eq('category_id', categoryId!)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as Array<Thread & { replies?: { count: number }[] }>).map((t) => ({
        ...t,
        reply_count: t.replies?.[0]?.count ?? 0,
      })) as Thread[]
    },
  })

  const category = categoryQ.data
  const threads = threadsQ.data ?? []

  return (
    <>
      <SEO
        title={category?.name ? `${category.name} discussions` : 'Category'}
        description={category?.description ?? `Browse threads and discussions in the ${category?.name ?? 'category'} on AbiaConnect.`}
        path={`/category/${categoryId ?? ''}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: category?.name || 'Category',
            description: category?.description || `Browse threads in the ${category?.name || 'category'} on AbiaConnect.`,
            url: `https://abiaconnect.com/category/${categoryId}`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://abiaconnect.com/' },
              { '@type': 'ListItem', position: 2, name: category?.name || 'Category', item: `https://abiaconnect.com/category/${categoryId}` },
            ],
          },
        ]}
      />
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-3xl font-bold">{category?.name ?? 'Category'}</h1>
        {category?.description && (
          <p className="text-muted-foreground mt-2">{category.description}</p>
        )}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            {threads.length} {threads.length === 1 ? 'thread' : 'threads'}
          </span>
          {user && (
            <Button asChild>
              <Link to={`/create-thread?category=${categoryId}`}>
                <Plus /> New Thread
              </Link>
            </Button>
          )}
        </div>
      </header>

      {threadsQ.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No threads yet. Be the first to post!
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => {
            const author = t.profiles?.display_name ?? 'Member'
            const replyCount = t.reply_count ?? 0
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-border bg-card p-5 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {t.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/20 text-secondary-foreground px-2 py-0.5 text-xs font-semibold">
                          <Pin className="size-3" /> Pinned
                        </span>
                      )}
                      {replyCount > 10 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-xs font-semibold">
                          <Flame className="size-3" /> Hot
                        </span>
                      )}
                    </div>
                    <Link to={`/thread/${t.id}`} className="block font-bold text-lg hover:text-primary">
                      {t.title}
                    </Link>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {t.profiles?.avatar_url ? (
                        <img src={t.profiles.avatar_url} alt={`Profile photo of ${author}`} onError={handleImgError} loading="lazy" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">
                          {author.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium text-foreground">{author}</span>
                      <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
                      <MessageSquare className="size-4" />
                      {replyCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowBigUp className="size-3.5" />
                      {t.upvotes ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" />
                      {t.view_count ?? 0}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
    </>
  )
}
