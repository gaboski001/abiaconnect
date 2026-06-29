import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronDown, Flame, Hash } from 'lucide-react'
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
        <div className="flex flex-col gap-2">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
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
  const [open, setOpen] = useState(false)
  const color = category.color ?? MOBILE_BRAND.gold

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] transition hover:border-[#F8C301]/20"
      style={{ boxShadow: '0 12px 32px -28px rgba(7,17,31,0.95)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg"
          style={{ backgroundColor: `${color}26`, borderColor: `${color}55` }}
        >
          {category.icon ?? '💬'}
        </span>
        <span className="flex-1 truncate text-sm font-bold text-white">{category.name}</span>
        {category.is_popular ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-[#F8C301]/20 px-2 py-0.5 text-[10px] font-semibold text-slate-950"
            style={{ backgroundImage: GOLD_GRADIENT }}
          >
            <Flame className="size-3" /> Hot
          </span>
        ) : null}
        <span className="text-[11px] font-semibold text-slate-400">{category.thread_count ?? 0}</span>
        <ChevronDown
          className="size-4 text-slate-300 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 py-4">
              <div
                className="absolute inset-x-0 top-0 h-px opacity-40"
                style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
              />
              {category.description ? (
                <p className="text-sm leading-6 text-slate-300/75">{category.description}</p>
              ) : (
                <p className="text-sm text-slate-400/70">Join the conversation in {category.name}.</p>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Threads</p>
                  <p className="mt-1 text-sm font-bold text-white">{category.thread_count ?? 0}</p>
                </div>
                <Link
                  to={`/category/${category.id}`}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-950"
                  style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                >
                  Browse <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default CategoryList

