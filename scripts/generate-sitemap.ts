// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = 'https://abiaconnect.com'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tnwgnowjmrbjugheorkv.supabase.co'
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4'

interface SitemapEntry {
  path: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: string
}

const staticEntries: SitemapEntry[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/login', changefreq: 'monthly', priority: '0.5' },
  { path: '/register', changefreq: 'monthly', priority: '0.5' },
  { path: '/forgot-password', changefreq: 'yearly', priority: '0.2' },
  { path: '/about/lgas', changefreq: 'monthly', priority: '0.7' },
  { path: '/about/known-for', changefreq: 'monthly', priority: '0.7' },
  { path: '/about/absu', changefreq: 'monthly', priority: '0.7' },
  { path: '/polls', changefreq: 'weekly', priority: '0.7' },
  { path: '/subgroups', changefreq: 'weekly', priority: '0.7' },
]

async function fetchRows(table: string, select = 'id,updated_at'): Promise<Array<Record<string, string>>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    )
    if (!res.ok) return []
    return (await res.json()) as Array<Record<string, string>>
  } catch {
    return []
  }
}

function toEntry(prefix: string, row: Record<string, string>, changefreq: SitemapEntry['changefreq'], priority: string): SitemapEntry {
  return {
    path: `${prefix}/${row.id}`,
    lastmod: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : undefined,
    changefreq,
    priority,
  }
}

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join('\n')
}

async function main() {
  const [categories, threads, subgroups] = await Promise.all([
    fetchRows('categories', 'id'),
    fetchRows('threads', 'id,updated_at'),
    fetchRows('subgroups', 'id,updated_at'),
  ])

  const dynamic: SitemapEntry[] = [
    ...categories.map((r) => toEntry('/category', r, 'weekly', '0.6')),
    ...threads.map((r) => toEntry('/thread', r, 'weekly', '0.6')),
    ...subgroups.map((r) => toEntry('/subgroups', r, 'weekly', '0.6')),
  ]

  const entries = [...staticEntries, ...dynamic]
  writeFileSync(resolve('public/sitemap.xml'), generateSitemap(entries))
  console.log(`sitemap.xml written (${entries.length} entries)`)
}

void main()
