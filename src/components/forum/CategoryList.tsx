import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Hash } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface Category {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  thread_count: number
  is_popular: boolean
  is_active: boolean
  display_order: number
}

type Tab = 'all' | 'popular'

export function CategoryList() {
  const [tab, setTab] = useState<Tab>('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })

  const filtered = (data ?? []).filter((c) => (tab === 'popular' ? c.is_popular : true))

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Hash className="size-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Forum Categories</h2>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(['all', 'popular'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'all' ? 'All Categories' : 'Popular'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-muted animate-pulse h-44" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-muted-foreground">Failed to load categories.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No categories found. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <CategoryCard category={c} />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  )
}

function CategoryCard({ category }: { category: Category }) {
  const color = category.color ?? '#013220'
  return (
    <Link
      to={`/category/${category.id}`}
      className="group relative bg-card border border-border rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:border-secondary/60 hover:shadow-lg hover:shadow-secondary/10 hover:-translate-y-1 flex flex-col h-full"
    >
      <div className="flex items-start justify-between">
        <span
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
          style={{
            backgroundColor: `${color}26`,
            borderColor: `${color}4D`,
          }}
        >
          {category.icon ?? '💬'}
        </span>
        {category.is_popular && (
          <span className="bg-secondary/15 text-secondary text-xs font-semibold px-2 py-0.5 rounded-full">
            🔥 Popular
          </span>
        )}
      </div>
      <h3 className="text-foreground font-bold text-base mt-3 group-hover:text-secondary transition-colors">
        {category.name}
      </h3>
      {category.description && (
        <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
          {category.description}
        </p>
      )}
      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {category.thread_count ?? 0} threads
        </span>
        <span className="text-secondary text-xs font-semibold">Browse →</span>
      </div>
    </Link>
  )
}

export default CategoryList
