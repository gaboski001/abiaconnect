import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Flame, Hash, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

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
    <section
      className="rounded-[2rem] border border-white/10 bg-[rgba(8,14,26,0.92)] p-4 text-white sm:p-5"
      style={{ boxShadow: PREMIUM_SHADOW }}
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Hash className="size-5" style={{ color: MOBILE_BRAND.gold }} />
            <h2 className="text-2xl font-black tracking-tight text-white">Forum Categories</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300/72">
            Join conversations across culture, news, events, politics and the 17 LGAs of Abia State.
          </p>
        </div>

        <div className="flex gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1.5">
          {(['all', 'popular'] as Tab[]).map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-full px-4 py-2 text-xs font-semibold transition"
                style={
                  active
                    ? { backgroundImage: GOLD_GRADIENT, color: MOBILE_BRAND.ink, boxShadow: GOLD_SHADOW }
                    : { color: 'rgba(226,232,240,0.74)' }
                }
              >
                {t === 'all' ? 'All Categories' : 'Popular'}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-[1.6rem] bg-white/[0.05]" />
          ))}
        </div>
      ) : isError ? (
        <div className="space-y-3 py-16 text-center">
          <p className="text-sm text-slate-300/72">Failed to load categories.</p>
          <Button onClick={() => refetch()} className="rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-5 py-14 text-center text-sm text-slate-300/70">
          No categories found. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
  const color = category.color ?? MOBILE_BRAND.gold

  return (
    <Link
      to={`/category/${category.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#F8C301]/20"
      style={{ boxShadow: '0 18px 50px -34px rgba(7,17,31,0.95)' }}
    >
      <div className="absolute inset-x-0 top-0 h-px opacity-40" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl"
          style={{ backgroundColor: `${color}26`, borderColor: `${color}55` }}
        >
          {category.icon ?? '💬'}
        </span>
        {category.is_popular ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#F8C301]/20 px-2.5 py-1 text-[11px] font-semibold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
            <Flame className="size-3" /> Popular
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-black tracking-tight text-white transition-colors group-hover:text-white">{category.name}</h3>
      {category.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300/72">{category.description}</p> : null}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Threads</p>
          <p className="mt-1 text-sm font-bold text-white">{category.thread_count ?? 0}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: MOBILE_BRAND.gold }}>
          Browse <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

export default CategoryList
