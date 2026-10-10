// Newsdesk bot: the parts with no network or database in them, so they can be
// unit-tested (src/test/newsdeskCore.test.ts). Reading news feeds, choosing one
// story per forum, checking what the AI wrote and turning it into a post.
//
// Two rules keep the posts honest:
//   - the post's HTML is built here from plain text (the AI never writes HTML),
//   - source links come from the news feed, never from the AI.

export type Scope = 'abia' | 'wider'

export interface Feed {
  name: string
  url: string
  /** 'abia': every item counts as Abia news. 'wider': Nigerian news; items naming Abia places still count as Abia. */
  scope: Scope
  /** Entertainment and celebrity news, for the Gossip forum. */
  showbiz?: boolean
}

const GOOGLE = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-NG&gl=NG&ceid=NG:en`

export const FEEDS: Feed[] = [
  { name: 'Google News', url: GOOGLE('Abia when:2d'), scope: 'abia' },
  { name: 'Google News', url: GOOGLE('Umuahia OR Enyimba OR Ariaria OR "Aba, Abia" when:2d'), scope: 'abia' },
  { name: 'Bing News', url: 'https://www.bing.com/news/search?q=Abia+State&format=rss', scope: 'abia' },
  { name: 'Vanguard', url: 'https://www.vanguardngr.com/feed/', scope: 'wider' },
  { name: 'Punch', url: 'https://rss.punchng.com/v1/category/latest_news', scope: 'wider' },
  { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed', scope: 'wider' },
  { name: 'Daily Post', url: 'https://dailypost.ng/feed/', scope: 'wider' },
  { name: 'BusinessDay', url: 'https://businessday.ng/feed/', scope: 'wider' },
  { name: 'Leadership', url: 'https://leadership.ng/feed/', scope: 'wider' },
  { name: 'Daily Trust', url: 'https://dailytrust.com/feed/', scope: 'wider' },
  { name: 'Channels TV', url: 'https://www.channelstv.com/feed/', scope: 'wider' },
  { name: 'Vanguard', url: 'https://www.vanguardngr.com/category/entertainment/feed/', scope: 'wider', showbiz: true },
  { name: 'Daily Post', url: 'https://dailypost.ng/entertainment/feed/', scope: 'wider', showbiz: true },
  { name: 'Premium Times', url: 'https://www.premiumtimesng.com/category/entertainment/feed', scope: 'wider', showbiz: true },
  { name: 'Nigerian Tribune', url: 'https://tribuneonlineng.com/category/entertainment/feed/', scope: 'wider', showbiz: true },
  { name: 'BellaNaija', url: 'https://www.bellanaija.com/feed/', scope: 'wider', showbiz: true },
]

/**
 * The only publishers the bot uses. Google News and Bing News gather stories
 * from every kind of site, blogs and rumour pages included; a story is kept
 * only when its publisher's website is on this list (established newspapers,
 * broadcasters, news agencies and specialist desks).
 */
export const TRUSTED_SITES = [
  // Nigerian newspapers
  'vanguardngr.com', 'punchng.com', 'premiumtimesng.com', 'dailypost.ng', 'guardian.ng', 'thisdaylive.com',
  'thenationonlineng.net', 'thesun.ng', 'sunnewsonline.com', 'tribuneonlineng.com', 'leadership.ng', 'dailytrust.com',
  'businessday.ng', 'independent.ng', 'newtelegraphng.com', 'thewhistler.ng', 'thecable.ng', 'saharareporters.com',
  'blueprint.ng', 'icirnigeria.org', 'nairametrics.com',
  // Broadcasters and agencies
  'channelstv.com', 'arise.tv', 'tvcnews.tv', 'nta.ng', 'nannews.ng', 'radionigeria.gov.ng',
  'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'aljazeera.com', 'dw.com', 'voanews.com', 'cnn.com',
  // Sport, technology, entertainment
  'completesports.com', 'goal.com', 'espn.com', 'cafonline.com', 'techcabal.com', 'techpoint.africa', 'bellanaija.com',
  'pulse.ng', 'legit.ng',
  // Government
  'abiastate.gov.ng',
]

/** Is this website (or a section of it, like www. or sport.) a trusted publisher? */
export function isTrustedSite(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '')
  if (/^(hausa|yoruba|igbo|fr|ar)\./.test(h)) return false // other-language editions
  return TRUSTED_SITES.some((site) => h === site || h.endsWith(`.${site}`))
}

/** Forums that have a share picture on the website (public/og/forum-<slug>.jpg). */
export const FORUM_CARDS = [
  'general-discussion',
  'relationship',
  'business-commerce',
  'politics-governance',
  'culture-heritage',
  'education-career',
  'health-wellness',
  'agriculture-farming',
  'technology-innovation',
  'real-estate-housing',
  'entertainment-lifestyle',
  'diaspora-connect',
  'success-stories',
  'security-safety',
  'faith-spirituality',
  'gossip',
]

/** The forum for entertainment and celebrity news. */
export const GOSSIP_FORUM = 'gossip'

export interface NewsItem {
  id: number
  title: string
  url: string
  publisher: string
  /** ISO time the story was published. */
  published: string
  snippet: string
  scope: Scope
  /** Entertainment or celebrity news. */
  showbiz: boolean
}

export interface Forum {
  slug: string
  name: string
  description: string | null
}

const ABIA_RE =
  /\b(abia|umuahia|aba|enyimba|ariaria|ohafia|arochukwu|bende|isuikwuato|ukwa|osisioma|obingwa|ikwuano|umunneochi|umu-?nneochi|isiala[- ]ngwa|ugwunagbo|otti)\b/i

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** Text of an XML/HTML fragment: CDATA unwrapped, tags removed, entities decoded, spaces tidied. */
export function plainText(fragment: string): string {
  let s = fragment.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  s = decodeEntities(s) // feeds escape their HTML: &lt;p&gt; -> <p>
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')
  return decodeEntities(s).replace(/\s+/g, ' ').trim()
}

function tag(item: string, name: string): string {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1] : ''
}

/** The real article address: unwraps Bing's redirect and drops tracking tags. */
export function cleanUrl(raw: string): string {
  let url = decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim()
  try {
    let u = new URL(url)
    if (/(^|\.)bing\.com$/i.test(u.hostname) && u.searchParams.get('url')) u = new URL(u.searchParams.get('url')!)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key)
    url = u.toString()
  } catch {
    return ''
  }
  return url
}

/** For spotting the same story twice: lower-case words only. */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type RawItem = Omit<NewsItem, 'id'>

/** Reads one RSS feed. Items without a title, link or date are left out. */
export function parseRss(xml: string, feed: Feed): RawItem[] {
  const out: RawItem[] = []
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const item = m[0]
    let title = plainText(tag(item, 'title'))
    const url = cleanUrl(tag(item, 'link'))
    const when = new Date(plainText(tag(item, 'pubDate')))
    if (!title || !url || Number.isNaN(when.getTime())) continue

    // Trusted publishers only. Google names the publisher's website on each
    // item (its own link is a redirect); for the others it is the link itself.
    const sourceSite = item.match(/<source\s[^>]*url="https?:\/\/([^"\/]+)/i)?.[1] ?? new URL(url).hostname
    if (!isTrustedSite(sourceSite)) continue

    // Publisher: Google and Bing name it per item; a newspaper's own feed is that newspaper.
    const named = plainText(tag(item, 'source')) || plainText(tag(item, 'News:Source'))
    const publisher = (named || feed.name).slice(0, 80)
    // Google writes "Headline - Publisher".
    if (named && title.toLowerCase().endsWith(` - ${named.toLowerCase()}`)) {
      title = title.slice(0, title.length - named.length - 3).trim()
    }

    let snippet = plainText(tag(item, 'description'))
      .replace(/The post .* appeared first on .*$/i, '')
      .replace(/Read More:\s*\S+\s*$/i, '')
      .replace(/\s*\[…\]\s*$|\s*\[\.\.\.\]\s*$/, '…')
      .trim()
    // Google's "description" is only the headline again.
    if (titleKey(snippet).startsWith(titleKey(title))) snippet = ''
    snippet = snippet.slice(0, 500)

    if (/\/promoted\/|\/sponsored\//i.test(url) || /\b(sponsored|advertorial)\b/i.test(title)) continue

    const scope: Scope = feed.scope === 'abia' || ABIA_RE.test(`${title} ${snippet}`) ? 'abia' : 'wider'
    out.push({ title: title.slice(0, 300), url, publisher, published: when.toISOString(), snippet, scope, showbiz: feed.showbiz === true })
  }
  return out
}

export interface CandidateOptions {
  now: Date
  /** Addresses and headlines the bot has already used, so a story is not posted twice. */
  usedUrls?: Iterable<string>
  usedTitles?: Iterable<string>
  maxAbia?: number
  maxWider?: number
  maxShowbiz?: number
}

/**
 * Fresh, unused stories, newest first, numbered for the AI. Abia: last 48
 * hours; national and entertainment: last 30. Each kind has its own share of
 * the list, so a busy day of one kind does not crowd out the others.
 */
export function buildCandidates(raw: RawItem[], opts: CandidateOptions): NewsItem[] {
  const usedUrls = new Set(opts.usedUrls ?? [])
  const seen = new Set([...(opts.usedTitles ?? [])].map(titleKey))
  const now = opts.now.getTime()
  const picked: RawItem[] = []
  const left = { abia: opts.maxAbia ?? 60, wider: opts.maxWider ?? 50, showbiz: opts.maxShowbiz ?? 25 }

  const sorted = [...raw].sort((a, b) => b.published.localeCompare(a.published))
  for (const item of sorted) {
    const age = now - new Date(item.published).getTime()
    const limit = (item.scope === 'abia' ? 48 : 30) * 3600_000
    if (age > limit || age < -3600_000) continue
    const key = titleKey(item.title)
    if (key.length < 12 || seen.has(key) || usedUrls.has(item.url)) continue
    const kind = item.showbiz ? 'showbiz' : item.scope
    if (left[kind] <= 0) continue
    seen.add(key)
    usedUrls.add(item.url)
    left[kind]--
    picked.push(item)
  }
  return picked.map((item, i) => ({ ...item, id: i + 1 }))
}

// ---------------------------------------------------------------------------
// Step 1: the AI chooses at most one story per forum.
// ---------------------------------------------------------------------------

export function selectionSystemPrompt(): string {
  return [
    'You are the news editor of AbiaConnect, a community forum for people of Abia State, Nigeria, at home and abroad.',
    'From a numbered list of today\'s headlines you choose which stories are worth a discussion thread, and in which forum.',
    '',
    'Rules:',
    '- At most ONE story per forum, and never the same story in two forums.',
    '- Only choose a story that clearly fits the forum and that members would really want to discuss. If a forum has no good story today, leave it out. Fewer, better picks are preferred; never pad.',
    '- Abia State stories (marked [ABIA]) come first. Use a wider Nigerian story (marked [NIGERIA]) only when the forum has no Abia story and the story clearly affects Abians (prices, jobs, schools, health, farming, travel, diaspora).',
    `- Entertainment and celebrity stories (marked [SHOWBIZ]) go ONLY in the "${GOSSIP_FORUM}" forum, and that forum takes ONLY [SHOWBIZ] stories: music, film, television, fashion and what public figures have said or done in public. It does not need an Abia link. If "${GOSSIP_FORUM}" is not in the list of forums, leave [SHOWBIZ] stories out.`,
    '- Leave out: stories already discussed (listed below), adverts and press releases, betting, graphic crime, unverified rumours, anything about a person\'s health, body or sex life, and stories about private individuals.',
    '- You may list up to 3 headline numbers for one pick when they are reports of the SAME story.',
    '- Set "sensitive" to true when the story involves deaths, violence, crime or arrests, court cases, accusations against a named person or organisation, elections, parties or candidates, ethnic or religious tension, or health scares.',
    '',
    'Reply with JSON only, in this shape:',
    '{"picks":[{"forum":"<forum slug>","ids":[<headline numbers>],"sensitive":true|false}]}',
  ].join('\n')
}

export function selectionUserMessage(args: {
  forums: Forum[]
  items: NewsItem[]
  recentTitles: string[]
  maxPicks: number
}): string {
  const forums = args.forums
    .map((f) => `- ${f.slug}: ${f.name}${f.description ? ` (${f.description.slice(0, 140)})` : ''}`)
    .join('\n')
  const items = args.items
    .map((i) => {
      const day = i.published.slice(0, 10)
      const mark = i.showbiz ? '[SHOWBIZ]' : i.scope === 'abia' ? '[ABIA]' : '[NIGERIA]'
      return `${i.id}. ${mark} ${i.title} (${i.publisher}, ${day})${i.snippet ? `\n   ${i.snippet.slice(0, 220)}` : ''}`
    })
    .join('\n')
  const recent = args.recentTitles.length
    ? args.recentTitles.slice(0, 80).map((t) => `- ${t}`).join('\n')
    : '(none)'
  return [
    `Choose at most ${args.maxPicks} picks.`,
    '',
    'Forums you may post in:',
    forums,
    '',
    'Already discussed in the last two weeks (do not repeat these stories):',
    recent,
    '',
    'Today\'s headlines:',
    items,
  ].join('\n')
}

export interface Pick {
  forum: string
  items: NewsItem[]
  scope: Scope
  sensitive: boolean
}

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

/** Checks the AI's choices against the real lists; anything that doesn't match is dropped. */
export function parseSelection(text: string, forums: Forum[], items: NewsItem[]): Pick[] {
  const data = parseJson(text) as { picks?: unknown } | null
  if (!data || !Array.isArray(data.picks)) return []
  const slugs = new Set(forums.map((f) => f.slug))
  const byId = new Map(items.map((i) => [i.id, i]))
  const usedForums = new Set<string>()
  const usedItems = new Set<number>()
  const picks: Pick[] = []
  for (const raw of data.picks as Array<Record<string, unknown>>) {
    const forum = typeof raw?.forum === 'string' ? raw.forum : ''
    if (!slugs.has(forum) || usedForums.has(forum)) continue
    const ids = (Array.isArray(raw.ids) ? raw.ids : [])
      .map((n) => Number(n))
      .filter((n) => byId.has(n) && !usedItems.has(n))
      .slice(0, 3)
    if (!ids.length) continue
    // Entertainment news belongs in the Gossip forum, and nothing else does.
    const showbiz = ids.map((n) => byId.get(n)!.showbiz)
    if (forum === GOSSIP_FORUM ? showbiz.includes(false) : showbiz.includes(true)) continue
    usedForums.add(forum)
    ids.forEach((n) => usedItems.add(n))
    const chosen = ids.map((n) => byId.get(n)!)
    picks.push({
      forum,
      items: chosen,
      scope: chosen.some((i) => i.scope === 'abia') ? 'abia' : 'wider',
      sensitive: raw.sensitive === true,
    })
  }
  return picks
}

/**
 * Which picks to keep when there are more than today's room: Abia stories
 * first, then the forums the bot has not posted in for the longest.
 */
export function prioritise(picks: Pick[], room: number, lastPosted: Record<string, string>): Pick[] {
  return [...picks]
    .sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'abia' ? -1 : 1
      return (lastPosted[a.forum] ?? '').localeCompare(lastPosted[b.forum] ?? '')
    })
    .slice(0, Math.max(0, room))
}

/**
 * Forums the bot may still post in today. Each forum has its own daily number
 * of posts (busy forums get more); 0 means the bot stays out of that forum.
 */
export function openForums<T extends { slug: string }>(
  forums: T[],
  postedToday: Record<string, number>,
  limits: Record<string, unknown> | null | undefined,
  defaultLimit: number,
): T[] {
  return forums.filter((f) => (postedToday[f.slug] ?? 0) < forumLimit(f.slug, limits, defaultLimit))
}

export function forumLimit(slug: string, limits: Record<string, unknown> | null | undefined, defaultLimit: number): number {
  const own = Number(limits?.[slug])
  const n = Number.isFinite(own) && limits?.[slug] !== null && limits?.[slug] !== undefined ? own : defaultLimit
  return Math.min(10, Math.max(0, Math.floor(n)))
}

// ---------------------------------------------------------------------------
// Step 2: the AI writes the discussion from the reports.
// ---------------------------------------------------------------------------

/** Readable paragraphs of a news page, for the AI to work from (not shown to members). */
export function extractArticleText(html: string, limit = 2500): string {
  const body = html.replace(/<(script|style|noscript|header|footer|nav|aside|form)[\s\S]*?<\/\1>/gi, ' ')
  const paragraphs: string[] = []
  let total = 0
  for (const m of body.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)) {
    const text = plainText(m[1])
    if (text.length < 60) continue
    if (/^(copyright|all rights reserved|subscribe|follow us|read also|related)/i.test(text)) continue
    // Leftover page code and app adverts, not the story.
    if (/utm_|">|download .{0,30}\bapp\b/i.test(text)) continue
    paragraphs.push(text)
    total += text.length
    if (total >= limit) break
  }
  return paragraphs.join('\n').slice(0, limit)
}

export function writerSystemPrompt(): string {
  return [
    'You write discussion starters for AbiaConnect, a community forum for people of Abia State, Nigeria, at home and abroad.',
    'You are given one or more news reports about the same story and the forum it will be posted in.',
    '',
    'Rules:',
    '- Use ONLY facts stated in the material given. Never add names, numbers, dates, quotes or background from memory. If the material is only a headline, say what the publisher reports in one short paragraph and nothing more.',
    '- Attribute: write "according to <publisher>" or "<publisher> reports" at least once. Describe accusations as accusations, not as facts.',
    '- Neutral and respectful. Do not take a side in politics or religion, do not insult or blame any group, and do not speculate.',
    '- Plain, warm Nigerian English that any reader understands. No hashtags, no emoji, no markdown, no HTML.',
    '- "title": a headline that states the news and invites discussion, 40 to 140 characters, ending with a question where natural.',
    '- "banner": the same news as a short headline for the post\'s picture, at most 70 characters, no question.',
    '- "paragraphs": 1 to 3 short paragraphs (each under 600 characters) summarising the story in your own words. Do not copy sentences from the reports.',
    '- "questions": 3 or 4 open questions that invite members to share experience or opinion, relevant to Abians.',
    '- "tags": 2 or 3 lower-case topic words (letters, digits and hyphens only).',
    '- "sensitive": true when the story involves deaths, violence, crime or arrests, court cases, accusations against a named person or organisation, elections, parties or candidates, ethnic or religious tension, or health scares.',
    '',
    'Reply with JSON only:',
    '{"title":"...","banner":"...","paragraphs":["..."],"questions":["..."],"tags":["..."],"sensitive":true|false}',
  ].join('\n')
}

export function writerUserMessage(args: { forum: Forum; pick: Pick; articleText: Record<number, string> }): string {
  const reports = args.pick.items
    .map((i) => {
      const text = args.articleText[i.id]
      return [
        `Publisher: ${i.publisher}`,
        `Published: ${i.published.slice(0, 10)}`,
        `Headline: ${i.title}`,
        i.snippet ? `Summary: ${i.snippet}` : '',
        text ? `Article text:\n${text}` : '(Only the headline is available for this report.)',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n---\n\n')
  const note = args.pick.items.some((i) => i.showbiz)
    ? 'This is entertainment news: keep it light and fair, say only what the publisher reports the person said or did in public, and ask members what they think.'
    : args.pick.scope === 'wider'
      ? 'This is a national story: ask how it affects Abians.'
      : ''
  return [`Forum: ${args.forum.name}`, note, '', reports]
    .filter((line, i) => line !== '' || i === 2)
    .join('\n')
}

export interface Draft {
  title: string
  /** The short headline written on the post's banner. */
  banner: string
  paragraphs: string[]
  questions: string[]
  tags: string[]
  sensitive: boolean
}

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/<[^>]*>/g, ' ').replace(/[*_#`]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Checks what the AI wrote; returns null when it is not usable. */
export function parseDraft(text: string): Draft | null {
  const data = parseJson(text) as Record<string, unknown> | null
  if (!data) return null
  const title = clean(data.title, 160)
  const paragraphs = (Array.isArray(data.paragraphs) ? data.paragraphs : [])
    .map((p) => clean(p, 700))
    .filter((p) => p.length >= 40)
    .slice(0, 3)
  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .map((q) => clean(q, 240))
    .filter((q) => q.length >= 15)
    .slice(0, 4)
  const tags = [
    ...new Set(
      (Array.isArray(data.tags) ? data.tags : [])
        .map((t) =>
          clean(t, 40)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
        )
        .filter((t) => t.length >= 2 && t.length <= 30),
    ),
  ].slice(0, 3)
  if (title.length < 25 || !paragraphs.length || questions.length < 2) return null
  const banner = clean(data.banner, 90)
  return { title, banner: banner.length >= 15 ? banner : title, paragraphs, questions, tags, sensitive: data.sensitive === true }
}

// ---------------------------------------------------------------------------
// Should an admin look first?
// ---------------------------------------------------------------------------

const SENSITIVE_WORDS =
  /\b(kill(s|ed|ing)?|dead|dies|died|death|murder(s|ed)?|kidnap\w*|abduct\w*|rape[ds]?|gunm[ae]n|bandits?|shot|shooting|stab\w*|arrest\w*|arraign\w*|court|lawsuit|sue[sd]?|alleg\w*|accus\w*|fraud\w*|scam\w*|efcc|icpc|corrupt\w*|election\w*|inec|campaign\w*|candidate\w*|impeach\w*|defect\w*|protest\w*|riot\w*|clash\w*|cult(ist|ists|ism)?|ipob|esn|herdsm[ae]n|outbreak|epidemic|cholera|lassa|suicide)\b/i

export interface SourceLink {
  title: string
  url: string
  publisher: string
}

/**
 * Why a post must wait for an admin (null = it may be published straight away).
 * Sensitive forums always wait; so does any story the AI or the word list flags.
 */
export function holdReason(args: {
  forum: string
  reviewSlugs: string[]
  pickSensitive: boolean
  draft: Draft
  sources: SourceLink[]
  test?: boolean
}): string | null {
  if (args.test) return 'Test run: nothing is published'
  if (args.reviewSlugs.includes(args.forum)) return 'Posts in this forum always wait for your approval'
  if (args.pickSensitive || args.draft.sensitive) return 'The story looks sensitive'
  const text = [args.draft.title, ...args.draft.paragraphs, ...args.sources.map((s) => s.title)].join(' ')
  const hit = text.match(SENSITIVE_WORDS)
  return hit ? `The story mentions "${hit[0].toLowerCase()}"` : null
}

// ---------------------------------------------------------------------------
// The post itself.
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** One link per publisher, in the order the reports were chosen. */
export function sourcesOf(pick: Pick): SourceLink[] {
  const seen = new Set<string>()
  const out: SourceLink[] = []
  for (const i of pick.items) {
    if (seen.has(i.publisher)) continue
    seen.add(i.publisher)
    out.push({ title: i.title, url: i.url, publisher: i.publisher })
  }
  return out
}

/** The thread body, in the same shape as the hand-written Newsdesk posts. */
export function renderPostHtml(draft: Draft, sources: SourceLink[]): string {
  const links = sources
    .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.publisher)}</a>`)
    .join(', ')
  return [
    ...draft.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    '<h3>Over to you</h3>',
    `<ol>${draft.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>`,
    `<p><em>${sources.length === 1 ? 'Source' : 'Sources'}: ${links}. Put together by the AbiaConnect Newsdesk assistant from the linked ${sources.length === 1 ? 'report' : 'reports'}.</em></p>`,
  ].join('\n')
}

/** A headline short enough for the picture: cut at a word, with "…". */
export function bannerHeadline(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const atWord = cut.lastIndexOf(' ') > max * 0.6 ? cut.slice(0, cut.lastIndexOf(' ')) : cut
  return `${atWord.replace(/[\s,;:.!?–—-]+$/, '')}…`
}

/** The post's banner, shown at the top of the thread. */
export function bannerHtml(url: string, headline: string): string {
  return `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(headline)}"></figure>\n`
}

/** Today's date in Abia (Africa/Lagos), as YYYY-MM-DD. */
export function lagosDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** The share page that shows a forum's picture, or null when the forum has none. */
export function sharePathFor(forumSlug: string, threadId: string): string | null {
  return FORUM_CARDS.includes(forumSlug) ? `/share/forum-${forumSlug}.html?t=${threadId}` : null
}
