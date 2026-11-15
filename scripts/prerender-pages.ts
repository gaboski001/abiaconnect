// Runs right after `vite build` (see package.json "build"). Writes a ready-made
// HTML page for every public address, dist/<path>/index.html, so Google, Bing,
// AI search and link previews see each page's own title, description and text
// instead of one empty app shell. The app loads on top exactly as before:
// React replaces the ready-made content the moment it starts.
//
// - Information pages (About, LGAs, Known for, ABSU...) are rendered with the
//   same components visitors see (src/prerender/entry.tsx).
// - Discussions, forum categories and groups come from the database with the
//   visitor (anon) key, so only what any visitor may read is ever written.
//
// It never fails the build: if anything goes wrong it logs and stops, and the
// site works exactly as before (just without the ready-made pages).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const SITE = 'https://abiaconnect.com'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tnwgnowjmrbjugheorkv.supabase.co'
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4'
const DIST = resolve('dist')

export const HOME_TITLE = 'AbiaConnect: Abia State & Igbo Community Forum Online'
export const HOME_DESCRIPTION =
  'The online community for Abia State and Igbo people in Nigeria and abroad: news from Aba, Umuahia and all 17 LGAs, culture, business, jobs and more.'

// ---------------------------------------------------------------- helpers

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }

/** Plain text from stored post HTML (for descriptions and structured data). */
export function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|blockquote|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

const ALLOWED = new Set(['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'blockquote', 'a'])

/** Post HTML reduced to safe, simple tags (headings become h2-h4, links keep only a safe href). */
export function safeHtml(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<(script|style|iframe|object|embed|svg|form)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_m, close: string, rawTag: string, attrs: string) => {
      let tag = rawTag.toLowerCase()
      if (tag === 'h1') tag = 'h2'
      if (tag === 'h5' || tag === 'h6') tag = 'h4'
      if (!ALLOWED.has(tag)) return ''
      if (close) return `</${tag}>`
      if (tag === 'a') {
        const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? ''
        if (!/^(https?:\/\/|\/)/i.test(href)) return '<a>'
        const external = !href.startsWith('/') && !href.startsWith(SITE)
        return `<a href="${esc(href.replace(/&amp;/g, '&'))}"${external ? ' rel="nofollow ugc noopener"' : ''}>`
      }
      return tag === 'br' ? '<br>' : `<${tag}>`
    })
}

export function cut(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max - 1)
  const space = slice.lastIndexOf(' ')
  return (space > max * 0.6 ? slice.slice(0, space) : slice).replace(/[\s,.;:]+$/, '') + '…'
}

export function niceDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
}

/** fetch with a few retries, so one network blip doesn't skip the pages. */
async function fetchRetry(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.status < 500 || attempt >= 4) return res
    } catch (e) {
      if (attempt >= 4) throw e
    }
    await new Promise((r) => setTimeout(r, attempt * 1500))
  }
}

async function rest<T>(path: string): Promise<T[]> {
  const res = await fetchRetry(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T[]
}

async function rpc<T>(name: string, body: unknown): Promise<T[]> {
  const res = await fetchRetry(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${name}: ${res.status}`)
  return (await res.json()) as T[]
}

// ---------------------------------------------------------------- the page

export interface PageMeta {
  path: string
  title: string
  description: string
  ogType?: 'website' | 'article'
  jsonLd?: unknown[]
  noindex?: boolean
}

/** The built index.html, lighter: one normal stylesheet instead of 50 KB of inlined CSS per page. */
export function prepareTemplate(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]{2000,}?<\/style>/g, '')
    .replace(/<link rel="preload"([^>]*?)href="([^"]+\.css)"[^>]*>/g, '<link rel="stylesheet" crossorigin href="$2">')
    .replace(/<noscript>\s*<link rel="stylesheet"[^>]*>\s*<\/noscript>/g, '')
}

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`)
  const tag = `<meta ${attr}="${key}" content="${esc(value)}">`
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

const SHELL_CSS = `<style>[data-prerender]{max-width:56rem;margin:0 auto;padding:1.5rem 1rem 3rem;font-family:'Nunito Sans',system-ui,sans-serif;line-height:1.6}[data-prerender] nav a{margin-right:1rem}[data-prerender] h1{font-size:1.9rem;line-height:1.25;margin:1rem 0}[data-prerender] h2{font-size:1.35rem;margin:1.5rem 0 .5rem}[data-prerender] li{margin:.35rem 0}[data-prerender] a{color:#1a4f3a;text-decoration:underline}[data-prerender] .meta{color:#666;font-size:.9rem}.native-app [data-prerender]{display:none}</style>`

const NAV = `<nav aria-label="Main"><a href="/">AbiaConnect</a><a href="/subgroups">Groups</a><a href="/about/lgas">Abia LGAs</a><a href="/about">About</a><a href="/register">Join free</a></nav>`
const FOOTER = `<footer><p class="meta">AbiaConnect is the online community for people of Abia State, Nigeria, at home and abroad. <a href="/about">About us</a> · <a href="/about/known-for">What Abia is known for</a> · <a href="/about/absu">ABSU guide</a> · <a href="/help">Help</a> · <a href="/privacy-policy">Privacy</a></p></footer>`

export function buildPage(template: string, meta: PageMeta, body: string): string {
  const url = `${SITE}${meta.path === '/' ? '/' : meta.path}`
  const title = meta.title
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  html = setMeta(html, 'name', 'description', meta.description)
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'property', 'og:description', meta.description)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'property', 'og:type', meta.ogType ?? 'website')
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'name', 'twitter:description', meta.description)
  html = setMeta(html, 'name', 'twitter:url', url)
  const extra = [
    meta.noindex ? '<meta name="robots" content="noindex, follow">' : `<link rel="canonical" href="${esc(url)}">`,
    ...(meta.jsonLd ?? []).map(
      (ld) => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    ),
    SHELL_CSS,
  ].join('\n    ')
  html = html.replace('</head>', `    ${extra}\n  </head>`)
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root"><div data-prerender>${NAV}<main>${body}</main>${FOOTER}</div></div>`,
  )
}

function write(path: string, html: string) {
  const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path.replace(/^\//, ''), 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}

// ---------------------------------------------------------------- data

interface Category { id: string; name: string; description: string | null; slug: string | null; display_order: number | null; is_active: boolean | null }
interface Subgroup { id: string; name: string; description: string | null; is_private: boolean; is_active: boolean | null; kind: string | null; lga: string | null; updated_at: string | null }
interface Thread {
  id: string; title: string; content: string | null; category_id: string | null; subgroup_id: string | null
  user_id: string | null; is_anonymous: boolean | null; created_at: string; updated_at: string; view_count: number | null; tags: string[] | null
}
interface Reply { id: string; thread_id: string; user_id: string | null; content: string | null; created_at: string; parent_reply_id: string | null }
interface Profile { id: string; username: string | null; display_name: string | null }

function threadLink(t: Thread, withSnippet = true): string {
  const snippet = withSnippet ? cut(plainText(t.content), 160) : ''
  return `<li><a href="/thread/${t.id}">${esc(t.title)}</a>${snippet ? `<br><span class="meta">${esc(snippet)}</span>` : ''}</li>`
}

// ---------------------------------------------------------------- main

async function main() {
  const shell = readFileSync(join(DIST, 'index.html'), 'utf8')
  const template = prepareTemplate(shell)
  let count = 0

  // 1. Information pages, rendered with the real components.
  const { createServer } = await import('vite')
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  try {
    const entry = (await vite.ssrLoadModule('/src/prerender/entry.tsx')) as {
      STATIC_PAGES: Record<string, unknown>
      render: (path: string) => string
    }
    for (const path of Object.keys(entry.STATIC_PAGES)) {
      try {
        let body = entry.render(path)
        const title = plainText(/<title>([\s\S]*?)<\/title>/.exec(body)?.[1]) || STATIC_META[path]?.title
        const description =
          plainText(/<meta name="description" content="([^"]*)"/.exec(body)?.[1]) || STATIC_META[path]?.description
        const jsonLd = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
          try {
            return [JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))]
          } catch {
            return []
          }
        })
        body = body
          .replace(/<title>[\s\S]*?<\/title>/g, '')
          .replace(/<meta [^>]*>/g, '')
          .replace(/<link rel="canonical"[^>]*>/g, '')
          .replace(/<script[\s\S]*?<\/script>/g, '')
        if (!title || !description) continue
        write(path, buildPage(template, { path, title, description, jsonLd }, body))
        count++
      } catch (e) {
        console.warn(`prerender: skipped ${path}: ${String(e).slice(0, 160)}`)
      }
    }
  } finally {
    await vite.close()
  }

  // 2. Database pages: what any visitor may read.
  const [categories, subgroups, threads, replies] = await Promise.all([
    rest<Category>('categories?select=id,name,description,slug,display_order,is_active&order=display_order.asc'),
    rest<Subgroup>('subgroups?select=id,name,description,is_private,is_active,kind,lga,updated_at&order=name.asc'),
    rest<Thread>(
      'threads?select=id,title,content,category_id,subgroup_id,user_id,is_anonymous,created_at,updated_at,view_count,tags&is_deleted=eq.false&order=created_at.desc',
    ),
    rest<Reply>('replies?select=id,thread_id,user_id,content,created_at,parent_reply_id&order=created_at.asc'),
  ])
  const activeCats = categories.filter((c) => c.is_active !== false)
  const catById = new Map(activeCats.map((c) => [c.id, c]))
  const groupById = new Map(subgroups.map((g) => [g.id, g]))
  const userIds = [...new Set([...threads, ...replies].map((r) => r.user_id).filter((v): v is string => !!v))]
  const profiles = new Map<string, Profile>()
  for (let i = 0; i < userIds.length; i += 200) {
    const rows = await rpc<Profile>('get_public_profiles', { _ids: userIds.slice(i, i + 200) }).catch(() => [])
    for (const p of rows) profiles.set(p.id, p)
  }
  const nameOf = (userId: string | null, anonymous?: boolean | null) =>
    anonymous ? 'Anonymous member' : (userId && (profiles.get(userId)?.display_name || profiles.get(userId)?.username)) || 'AbiaConnect member'
  const repliesByThread = new Map<string, Reply[]>()
  for (const r of replies) repliesByThread.set(r.thread_id, [...(repliesByThread.get(r.thread_id) ?? []), r])

  // Discussions
  for (const t of threads) {
    const path = `/thread/${t.id}`
    const cat = t.category_id ? catById.get(t.category_id) : undefined
    const group = t.subgroup_id ? groupById.get(t.subgroup_id) : undefined
    const where = cat ? { name: cat.name, href: `/category/${cat.id}` } : group ? { name: group.name, href: `/subgroups/${group.id}` } : null
    const text = plainText(t.content)
    const author = nameOf(t.user_id, t.is_anonymous)
    const rs = repliesByThread.get(t.id) ?? []
    const related = threads.filter((o) => o.id !== t.id && ((cat && o.category_id === cat.id) || (group && o.subgroup_id === group.id))).slice(0, 6)
    const body = [
      where ? `<p class="meta"><a href="/">Home</a> › <a href="${where.href}">${esc(where.name)}</a></p>` : '',
      `<article><h1>${esc(t.title)}</h1>`,
      `<p class="meta">By ${esc(author)} · ${esc(niceDate(t.created_at))}${rs.length ? ` · ${rs.length} ${rs.length === 1 ? 'reply' : 'replies'}` : ''}</p>`,
      `<div>${safeHtml(t.content)}</div></article>`,
      rs.length
        ? `<section><h2>Replies</h2><ol>${rs
            .map((r) => `<li><p class="meta">${esc(nameOf(r.user_id))} · ${esc(niceDate(r.created_at))}</p>${safeHtml(r.content)}</li>`)
            .join('')}</ol></section>`
        : '',
      `<p><a href="/register">Join AbiaConnect free</a> to reply, react and meet Abians at home and abroad.</p>`,
      related.length ? `<section><h2>More discussions${where ? ` in ${esc(where.name)}` : ''}</h2><ul>${related.map((o) => threadLink(o, false)).join('')}</ul></section>` : '',
    ].join('')
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'DiscussionForumPosting',
        headline: cut(t.title, 110),
        text: cut(text, 5000),
        url: `${SITE}${path}`,
        mainEntityOfPage: `${SITE}${path}`,
        datePublished: t.created_at,
        dateModified: t.updated_at,
        author: { '@type': 'Person', name: author },
        ...(t.tags?.length ? { keywords: t.tags.join(', ') } : {}),
        interactionStatistic: [
          { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: rs.length },
          ...(t.view_count ? [{ '@type': 'InteractionCounter', interactionType: 'https://schema.org/ViewAction', userInteractionCount: t.view_count }] : []),
        ],
        ...(rs.length
          ? {
              comment: rs.slice(0, 50).map((r) => ({
                '@type': 'Comment',
                text: cut(plainText(r.content), 2000),
                datePublished: r.created_at,
                author: { '@type': 'Person', name: nameOf(r.user_id) },
              })),
            }
          : {}),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AbiaConnect', item: `${SITE}/` },
          ...(where ? [{ '@type': 'ListItem', position: 2, name: where.name, item: `${SITE}${where.href}` }] : []),
          { '@type': 'ListItem', position: where ? 3 : 2, name: cut(t.title, 110) },
        ],
      },
    ]
    write(
      path,
      buildPage(
        template,
        {
          path,
          title: `${cut(t.title, 60)} | AbiaConnect`,
          description: cut(text, 155) || `${t.title}: a discussion on AbiaConnect, the online community for Abia State.`,
          ogType: 'article',
          jsonLd,
        },
        body,
      ),
    )
    count++
  }

  // Forum categories
  for (const c of activeCats) {
    const path = `/category/${c.id}`
    const list = threads.filter((t) => t.category_id === c.id)
    const body = [
      `<h1>${esc(c.name)}: Abia State discussions</h1>`,
      c.description ? `<p>${esc(c.description)}</p>` : '',
      list.length ? `<h2>Latest discussions</h2><ul>${list.slice(0, 60).map((t) => threadLink(t)).join('')}</ul>` : '<p>No discussions yet. Start the first one.</p>',
      `<h2>Other forums</h2><ul>${activeCats.filter((o) => o.id !== c.id).map((o) => `<li><a href="/category/${o.id}">${esc(o.name)}</a></li>`).join('')}</ul>`,
    ].join('')
    write(
      path,
      buildPage(template, {
        path,
        title: `${c.name}: Abia State discussions | AbiaConnect`,
        description: cut(c.description || `${c.name} discussions for Abians at home and abroad on AbiaConnect.`, 155),
      }, body),
    )
    count++
  }

  // Groups
  const liveGroups = subgroups.filter((g) => g.is_active !== false)
  for (const g of liveGroups) {
    const path = `/subgroups/${g.id}`
    const list = g.is_private ? [] : threads.filter((t) => t.subgroup_id === g.id)
    const body = [
      `<h1>${esc(g.name)}</h1>`,
      g.description ? `<p>${esc(g.description)}</p>` : '',
      g.is_private ? '<p>This is a private group: posts are for its members only.</p>' : '',
      list.length ? `<h2>Discussions</h2><ul>${list.slice(0, 60).map((t) => threadLink(t)).join('')}</ul>` : '',
      `<p><a href="/register">Join AbiaConnect free</a> to take part in ${esc(g.name)}.</p>`,
      `<p><a href="/subgroups">See all AbiaConnect groups</a></p>`,
    ].join('')
    const what = g.kind === 'lga' || g.lga ? 'Abia State LGA group' : 'AbiaConnect group'
    write(
      path,
      buildPage(template, {
        path,
        title: `${cut(g.name, 50)}: ${what} | AbiaConnect`,
        description: cut(g.description || `${g.name}, an ${what} on AbiaConnect for Abians at home and abroad.`, 155),
      }, body),
    )
    count++
  }

  // Groups list
  const lgaGroups = liveGroups.filter((g) => g.kind === 'lga' || g.lga)
  const otherGroups = liveGroups.filter((g) => !(g.kind === 'lga' || g.lga))
  const groupItem = (g: Subgroup) =>
    `<li><a href="/subgroups/${g.id}">${esc(g.name)}</a>${g.description ? `<br><span class="meta">${esc(cut(g.description, 140))}</span>` : ''}</li>`
  write(
    '/subgroups',
    buildPage(template, {
      path: '/subgroups',
      title: 'Abia State LGA & community groups | AbiaConnect',
      description: 'Join groups for every Abia State LGA, professions, diaspora cities and shared interests: Aba, Umuahia, Ohafia, Arochukwu, Bende and more.',
    }, [
      '<h1>Groups for every Abia State LGA and interest</h1>',
      '<p>Find your people: a group for each of the 17 local government areas of Abia State, plus groups for professions, diaspora cities and shared interests.</p>',
      lgaGroups.length ? `<h2>LGA groups</h2><ul>${lgaGroups.map(groupItem).join('')}</ul>` : '',
      otherGroups.length ? `<h2>More groups</h2><ul>${otherGroups.map(groupItem).join('')}</ul>` : '',
    ].join('')),
  )
  count++

  // Simple pages whose content is only for members or loads live
  const simple: Array<[string, string, string, string]> = [
    ['/polls', 'Community polls: what Abians think | AbiaConnect', 'Vote in quick polls on the issues that matter to Abia State and see what Abians at home and abroad think.', '<h1>Community polls</h1><p>Quick polls on the issues that matter to Abia State. Vote and see what Abians at home and abroad think.</p>'],
    ['/register', 'Join AbiaConnect free: the Abia State community', 'Create your free AbiaConnect account and connect with Abians and Igbo people at home and abroad: discussions, LGA groups, chat, events and jobs.', '<h1>Join AbiaConnect free</h1><p>Create your account to join discussions, your LGA group, chat and calls, events, jobs and more, with Abians at home and abroad.</p>'],
    ['/login', 'Sign in | AbiaConnect', 'Sign in to AbiaConnect, the online community for Abia State and Igbo people in Nigeria and the diaspora.', '<h1>Sign in to AbiaConnect</h1><p>New here? <a href="/register">Create a free account</a>.</p>'],
    ['/donate', 'Support AbiaConnect | AbiaConnect', 'Donate to keep AbiaConnect, the online community for Abia State, free and growing for Abians at home and abroad.', '<h1>Support AbiaConnect</h1><p>Your gift keeps the community free, safe and growing for Abians everywhere.</p>'],
  ]
  for (const [path, title, description, body] of simple) {
    write(path, buildPage(template, { path, title, description }, body))
    count++
  }

  // Homepage last: dist/index.html is also the app shell for every other address,
  // so it carries general content and no canonical tag (each page above has its own).
  const lgaGuide = '<p>New to Abia? Read our guides: <a href="/about/lgas">the 17 LGAs of Abia State</a>, <a href="/about/known-for">what Abia State is known for</a> and <a href="/about/absu">Abia State University (ABSU)</a>.</p>'
  const homeBody = [
    '<h1>AbiaConnect: the online community for Abia State and Igbo people</h1>',
    '<p>AbiaConnect brings together the sons and daughters of Abia State, Nigeria, at home and across the world. Talk about news from Aba, Umuahia, Ohafia, Arochukwu and every one of the 17 LGAs; share culture, business, jobs and opportunities; join your LGA group; chat, call and meet other Abians.</p>',
    lgaGuide,
    `<h2>Forums</h2><ul>${activeCats.map((c) => `<li><a href="/category/${c.id}">${esc(c.name)}</a>${c.description ? `<br><span class="meta">${esc(cut(c.description, 140))}</span>` : ''}</li>`).join('')}</ul>`,
    `<h2>Latest discussions</h2><ul>${threads.slice(0, 30).map((t) => threadLink(t, false)).join('')}</ul>`,
    lgaGroups.length ? `<h2>LGA groups</h2><ul>${lgaGroups.map((g) => `<li><a href="/subgroups/${g.id}">${esc(g.name)}</a></li>`).join('')}</ul>` : '',
    '<p><a href="/register">Join AbiaConnect free</a></p>',
  ].join('')
  // The shell keeps its inlined critical CSS so app pages still paint fast.
  const homeHtml = buildPage(shell, { path: '/', title: HOME_TITLE, description: HOME_DESCRIPTION }, homeBody).replace(
    /\s*<link rel="canonical"[^>]*>/,
    '',
  )
  write('/', homeHtml)
  count++

  console.log(`prerender: wrote ${count} ready-made pages`)
}

/** Titles and descriptions for information pages that don't set their own. */
const STATIC_META: Record<string, { title: string; description: string }> = {
  '/about': {
    title: 'About AbiaConnect: the Abia State online community',
    description: 'AbiaConnect is the online community for Abians and Igbo people at home and abroad, founded in Abia State, Nigeria by Okechukwu Gabriel E.',
  },
  '/mission': {
    title: 'Our mission | AbiaConnect',
    description: 'What AbiaConnect stands for: identity, community, knowledge and progress for Abia State and Abians everywhere.',
  },
  '/team': {
    title: 'The AbiaConnect team',
    description: 'Meet the founder and the volunteers who build and look after AbiaConnect, the online community for Abia State.',
  },
  '/careers': {
    title: 'Careers and volunteering | AbiaConnect',
    description: "Help build Abia State's online community: open roles and volunteering at AbiaConnect.",
  },
  '/events': {
    title: 'Abia community events | AbiaConnect',
    description: 'Gatherings, meetings and celebrations for Abians at home and abroad, shared by the AbiaConnect community.',
  },
  '/success-stories': {
    title: 'Abian success stories | AbiaConnect',
    description: 'Real wins from Abians at home and abroad, shared by members of AbiaConnect.',
  },
  '/member-spotlight': {
    title: 'Member of the Month | AbiaConnect',
    description: 'Each month AbiaConnect celebrates a member who makes the Abia community better for everyone.',
  },
  '/help': {
    title: 'Help Centre | AbiaConnect',
    description: 'Answers to common questions about using AbiaConnect: accounts, discussions, groups, chat, calls, the app and more.',
  },
  '/forum-guidelines': {
    title: 'Forum guidelines | AbiaConnect',
    description: 'The rules that keep AbiaConnect discussions safe, respectful and useful for every Abian.',
  },
  '/community-standards': {
    title: 'Community standards | AbiaConnect',
    description: 'The values and behaviour that define the AbiaConnect community.',
  },
  '/privacy-policy': {
    title: 'Privacy policy | AbiaConnect',
    description: 'How AbiaConnect collects, uses and protects your personal information.',
  },
  '/terms-of-service': {
    title: 'Terms of service | AbiaConnect',
    description: 'The terms for using AbiaConnect, the online community for Abia State.',
  },
  '/cookie-policy': {
    title: 'Cookie policy | AbiaConnect',
    description: 'How AbiaConnect uses cookies and how you can control them.',
  },
}

if (process.argv[1] && /prerender-pages/.test(process.argv[1])) {
  main().catch((e) => {
    console.warn(`prerender: stopped, the site builds without ready-made pages: ${String(e).slice(0, 300)}`)
  })
}
