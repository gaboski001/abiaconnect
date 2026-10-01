import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Hash, MessagesSquare, Search as SearchIcon, Users } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

/** Escape LIKE wildcards so a search for "50%" means the text "50%". */
const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`

export default function Search() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const q = (params.get('q') ?? '').trim()
  const [draft, setDraft] = useState(q)
  useEffect(() => setDraft(q), [q])

  const results = useQuery({
    queryKey: ['search', q],
    enabled: q.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const term = likeTerm(q)
      const [threads, topics, groups] = await Promise.all([
        supabase
          .from('threads')
          .select('id, title, created_at, view_count, categories(name, icon)')
          .eq('is_deleted', false)
          .ilike('title', term)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('categories').select('id, name, icon, description, slug').eq('is_active', true).ilike('name', term).limit(10),
        supabase.from('subgroups').select('id, name, description').eq('is_active', true).ilike('name', term).limit(10),
      ])
      return {
        threads: (threads.data ?? []) as unknown as Array<{
          id: string
          title: string
          created_at: string
          view_count: number
          categories: { name: string; icon: string | null } | null
        }>,
        topics: (topics.data ?? []) as Array<{ id: string; name: string; icon: string | null; description: string | null; slug: string | null }>,
        groups: (groups.data ?? []) as Array<{ id: string; name: string; description: string | null }>,
      }
    },
  })

  const total = results.data ? results.data.threads.length + results.data.topics.length + results.data.groups.length : 0

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SEO title={q ? `Search: ${q}` : 'Search'} description="Search AbiaConnect discussions, topics and groups." path="/search" />
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold">Search</h1>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) navigate(`/search?q=${encodeURIComponent(draft.trim())}`)
          }}
          className="relative"
        >
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search discussions, topics and groups"
            aria-label="Search"
            autoFocus={!q}
            className="h-12 rounded-full pl-12 text-base"
          />
        </form>
        {q.length >= 2 && results.isSuccess ? (
          <p className="text-sm text-muted-foreground">
            {total === 0 ? 'No results' : `${total} result${total === 1 ? '' : 's'}`} for “<span className="font-medium text-foreground">{q}</span>”
          </p>
        ) : null}
      </header>

      {q.length < 2 ? (
        <p className="text-muted-foreground">Type at least two letters to search.</p>
      ) : results.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : results.data ? (
        <>
          {results.data.topics.length || results.data.groups.length ? (
            <section className={`grid gap-6 ${results.data.topics.length && results.data.groups.length ? 'sm:grid-cols-2' : ''}`}>
              {results.data.topics.length ? (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                    <Hash className="size-4 text-primary" /> Topics
                  </h2>
                  <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {results.data.topics.map((t) => (
                      <li key={t.id}>
                        <Link
                          to={t.slug === 'relationship' ? '/relationship' : `/category/${t.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60"
                        >
                          <span aria-hidden>{t.icon ?? '💬'}</span>
                          <span className="font-medium">{t.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {results.data.groups.length ? (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                    <Users className="size-4 text-primary" /> Groups
                  </h2>
                  <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {results.data.groups.map((g) => (
                      <li key={g.id}>
                        <Link to={`/subgroups/${g.id}`} className="block px-4 py-3 hover:bg-muted/60">
                          <span className="font-medium">{g.name}</span>
                          {g.description ? <span className="mt-0.5 block line-clamp-1 text-sm text-muted-foreground">{g.description}</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <MessagesSquare className="size-4 text-primary" /> Discussions
            </h2>
            {results.data.threads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">No discussions match “{q}”.</p>
                <Link to="/create-thread" className="mt-2 inline-block font-medium text-primary hover:underline">
                  Start a discussion about it
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {results.data.threads.map((t) => (
                  <li key={t.id}>
                    <Link to={`/thread/${t.id}`} className="block px-4 py-3.5 hover:bg-muted/60">
                      <span className="font-medium text-foreground">{t.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                        {t.categories ? (
                          <span>
                            {t.categories.icon ?? '💬'} {t.categories.name}
                          </span>
                        ) : null}
                        <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                        <span>{t.view_count.toLocaleString()} {t.view_count === 1 ? 'view' : 'views'}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
