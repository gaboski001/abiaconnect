import { ArrowUpRight, Globe2, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react'
import { CategoryList } from '@/components/forum/CategoryList'
import { SEO } from '@/components/SEO'
import { SidebarWidgets } from '@/components/forum/SidebarWidgets'
import { HeroSlider } from '@/components/forum/HeroSlider'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'Professional community home',
    body: 'A cleaner landing experience gives members clearer hierarchy, richer polish, and faster decision-making across every section.',
  },
  {
    icon: Zap,
    title: 'Faster discovery flow',
    body: 'Move from slider hero to categories, threads, and live activity with surfaces designed for mobile-native scanning.',
  },
  {
    icon: ShieldCheck,
    title: 'Consistent premium UI',
    body: 'The same refined visual language now extends through category browsing, profile, chat, alerts, and the wider community experience.',
  },
]

const STAT_CARDS = [
  { label: 'Design language', value: 'Premium' },
  { label: 'Navigation', value: 'Sharper' },
  { label: 'Readability', value: 'Improved' },
  { label: 'Experience', value: 'Native' },
]

export default function Home() {
  return (
    <>
      <SEO
        title="AbiaConnect — Connecting Abians Worldwide"
        description="Community forum for Abians worldwide. Join discussions on culture, news, events, polls, and subgroups across all 17 LGAs of Abia State."
        path="/"
      />
      <div className="space-y-6 md:space-y-8">
        <section
          className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/96 p-5 text-slate-950 sm:p-6 dark:border-white/10 dark:bg-[#091220] dark:text-white"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <div
            className="absolute inset-0 opacity-80 dark:opacity-95"
            style={{
              background:
                'linear-gradient(160deg, rgba(255,255,255,0.94) 4%, rgba(248,250,252,0.98) 44%, rgba(241,245,249,0.92) 100%)',
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                'linear-gradient(160deg, rgba(5,12,22,0.98) 10%, rgba(10,20,36,0.96) 55%, rgba(5,11,20,1) 100%)',
            }}
          />
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full blur-3xl" style={{ background: 'rgba(248,195,1,0.16)' }} />
          <div className="absolute -left-8 bottom-0 h-36 w-36 rounded-full blur-3xl" style={{ background: 'rgba(28,169,217,0.16)' }} />

          <div className="relative space-y-5">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:text-slate-200/80"
              style={{ background: GOLD_GRADIENT_SOFT }}
            >
              <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
              Community home, upgraded
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                  A cleaner, more professional AbiaConnect home
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base dark:text-slate-300/78">
                  Browse categories, discover live conversations, and move into community discussions with a premium interface that feels clearer, more polished, and easier to use in both light and dark mode.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-950"
                    style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                  >
                    <Users className="size-4" /> Built for members first
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    <ArrowUpRight className="size-4" style={{ color: MOBILE_BRAND.gold }} /> Better visibility in light theme
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {STAT_CARDS.map((card) => (
                  <StatCard key={card.label} label={card.label} value={card.value} />
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className="rounded-[1.4rem] border border-slate-200/80 bg-white/92 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.06]">
                      <Icon className="size-5" style={{ color: MOBILE_BRAND.gold }} />
                    </div>
                    <h2 className="mt-4 text-sm font-bold text-slate-950 dark:text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300/74">{item.body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <HeroSlider />

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-8">
            <CategoryList />
          </div>
          <div className="lg:col-span-4">
            <SidebarWidgets />
          </div>
        </div>

        <section
          className="grid gap-4 rounded-[1.8rem] border border-slate-200/80 bg-white/96 p-4 text-slate-950 sm:grid-cols-3 sm:p-5 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-white"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <MiniFeature
            icon={Globe2}
            title="Worldwide community"
            copy="A stronger diaspora-first browsing experience keeps culture, discussion, and updates within easy reach."
          />
          <MiniFeature
            icon={Sparkles}
            title="Sharper category discovery"
            copy="Categories now feel more editorial, more premium, and easier to browse quickly on mobile screens."
          />
          <MiniFeature
            icon={ShieldCheck}
            title="Consistent app polish"
            copy="The upgraded visual system now aligns homepage, categories, threads, dashboard, chat, notifications, and profile surfaces."
          />
        </section>
      </div>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/92 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300/62">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

function MiniFeature({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Sparkles
  title: string
  copy: string
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <Icon className="size-5" style={{ color: MOBILE_BRAND.gold }} />
      <h2 className="mt-3 text-sm font-bold text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300/74">{copy}</p>
    </div>
  )
}
