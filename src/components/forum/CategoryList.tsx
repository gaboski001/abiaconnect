import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Hash } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Category {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  color?: string | null
  thread_count?: number | null
  is_popular?: boolean | null
  order?: number | null
}

export function CategoryList() {
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('is_popular', { ascending: false })
        .order('order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })

  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        <Hash className="size-5 text-primary" />
        <h2 className="text-2xl font-bold">Forum Categories</h2>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground animate-pulse">
          Loading Forum Categories…
        </div>
      ) : !data || data.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No categories yet — check back soon
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.35 }}
            >
              <Link
                to={`/category/${c.id}`}
                className="group block rounded-2xl border border-border bg-card p-5 transition-all hover:scale-[1.02] hover:border-secondary hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-primary-foreground"
                    style={{
                      background:
                        c.color ?? 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    }}
                  >
                    {c.icon ?? c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold truncate">{c.name}</h3>
                      <span className="text-xs font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        {c.thread_count ?? 0} threads
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {c.description}
                      </p>
                    )}
                    <span className="mt-3 inline-block text-sm font-medium text-primary group-hover:underline">
                      View Threads →
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  )
}

export default CategoryList
