import { describe, it, expect } from 'vitest'
import {
  FEEDS,
  FORUM_CARDS,
  forumLimit,
  isTrustedSite,
  openForums,
  bannerHeadline,
  bannerHtml,
  buildCandidates,
  campusSelectionSystemPrompt,
  cleanUrl,
  extractArticleText,
  extractHeadlineLinks,
  newPageItems,
  holdReason,
  lagosDate,
  parseDraft,
  parseRss,
  parseSelection,
  prioritise,
  renderPostHtml,
  selectionUserMessage,
  sharePathFor,
  sourcesOf,
  writerUserMessage,
  type Draft,
  type Forum,
  type NewsItem,
  type Pick,
} from '../../supabase/functions/_shared/newsdesk-core'

const GOOGLE = FEEDS[0]
const BING = FEEDS.find((f) => f.name === 'Bing News')!
const VANGUARD = FEEDS.find((f) => f.name === 'Vanguard')!
const PREMIUM = FEEDS.find((f) => f.name === 'Premium Times')!

// Shapes copied from the real feeds.
const GOOGLE_XML = `<rss><channel>
<item><title>Police Bust Counterfeit Currency Hideout In Abia - The Whistler Newspaper</title><link>https://news.google.com/rss/articles/CBMiiwFB?oc=5</link><guid isPermaLink="false">CBMiiwFB</guid><pubDate>Fri, 09 Oct 2026 19:54:40 GMT</pubDate><description>&lt;a href="https://news.google.com/rss/articles/CBMiiwFB?oc=5" target="_blank"&gt;Police Bust Counterfeit Currency Hideout In Abia&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;The Whistler Newspaper&lt;/font&gt;</description><source url="https://thewhistler.ng">The Whistler Newspaper</source></item>
<item><title>No date here - Someone</title><link>https://news.google.com/rss/articles/X?oc=5</link><source url="https://x.ng">Someone</source></item>
</channel></rss>`

const BING_XML = `<rss><channel>
<item><title>2027: Abia tricycle operators endorse Otti for second term</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=6ac9&amp;url=https%3a%2f%2fpunchng.com%2f2027-abia-tricycle-operators-endorse-otti%2f&amp;c=180&amp;mkt=en-ww</link><description>Members of the Abia State Tricycle Operators Union, Umuahia Zone, have endorsed Governor Alex Otti ...</description><pubDate>Fri, 09 Oct 2026 11:50:00 GMT</pubDate><News:Source>The Punch</News:Source></item>
</channel></rss>`

const VANGUARD_XML = `<rss><channel>
<item>
  <title>Soludo approves full implementation of 2025 ASUU agreement</title>
  <link>https://www.vanguardngr.com/2026/10/soludo-approves/?utm_source=rss&amp;utm_medium=web</link>
  <pubDate>Fri, 09 Oct 2026 21:28:46 +0000</pubDate>
  <description><![CDATA[<p>By Vincent Ujumadu Governor Chukwuma Soludo of Anambra State has approved the agreement [&#8230;]</p>
<p>The post <a href="https://www.vanguardngr.com/x/">Soludo approves</a> appeared first on <a href="https://www.vanguardngr.com">Vanguard News</a>.</p>]]></description>
</item>
<item>
  <title>Farmers in Ohafia count losses after late rains</title>
  <link>https://www.vanguardngr.com/2026/10/ohafia-farmers/</link>
  <pubDate>Fri, 09 Oct 2026 20:00:00 +0000</pubDate>
  <description><![CDATA[<p>Cassava farmers say the harvest is down this year.</p>]]></description>
</item>
</channel></rss>`

const NOW = new Date('2026-10-10T06:30:00Z')

describe('reading news feeds', () => {
  it('reads Google News: publisher taken off the headline, repeated headline not used as a summary', () => {
    const items = parseRss(GOOGLE_XML, GOOGLE)
    expect(items).toHaveLength(1) // the item without a date is left out
    expect(items[0]).toMatchObject({
      title: 'Police Bust Counterfeit Currency Hideout In Abia',
      publisher: 'The Whistler Newspaper',
      url: 'https://news.google.com/rss/articles/CBMiiwFB?oc=5',
      snippet: '',
      scope: 'abia',
      published: '2026-10-09T19:54:40.000Z',
    })
  })

  it('reads Bing News: unwraps the real article address', () => {
    const [item] = parseRss(BING_XML, BING)
    expect(item.url).toBe('https://punchng.com/2027-abia-tricycle-operators-endorse-otti/')
    expect(item.publisher).toBe('The Punch')
    expect(item.snippet).toMatch(/^Members of the Abia State Tricycle Operators Union/)
  })

  it('reads a newspaper feed: tidy summary, tracking tags removed, Abia places recognised', () => {
    const [national, abia] = parseRss(VANGUARD_XML, VANGUARD)
    expect(national.url).toBe('https://www.vanguardngr.com/2026/10/soludo-approves/')
    expect(national.snippet).toBe('By Vincent Ujumadu Governor Chukwuma Soludo of Anambra State has approved the agreement…')
    expect(national.publisher).toBe('Vanguard')
    expect(national.scope).toBe('wider')
    expect(abia.scope).toBe('abia') // Ohafia is in Abia
  })

  it('leaves out promoted stories', () => {
    const xml = `<item><title>Family awards N100m scholarships to students</title><link>https://www.premiumtimesng.com/promoted/915765-x.html</link><pubDate>Fri, 09 Oct 2026 21:19:44 +0000</pubDate></item>`
    expect(parseRss(xml, PREMIUM)).toEqual([])
  })

  it('refuses links that are not web addresses', () => {
    expect(cleanUrl('javascript:alert(1)')).toBe('')
    expect(cleanUrl('not a link')).toBe('')
    expect(cleanUrl('https://punchng.com/a/?utm_source=x&id=2')).toBe('https://punchng.com/a/?id=2')
  })
})

describe('choosing fresh stories', () => {
  const raw = [...parseRss(GOOGLE_XML, GOOGLE), ...parseRss(BING_XML, BING), ...parseRss(VANGUARD_XML, VANGUARD)]

  it('numbers fresh stories newest first', () => {
    const items = buildCandidates(raw, { now: NOW })
    expect(items.map((i) => i.id)).toEqual([1, 2, 3, 4])
    expect(items[0].title).toMatch(/^Soludo/)
  })

  it('drops old stories: Abia after 48 hours, national after 30', () => {
    const later = new Date('2026-10-11T06:00:00Z') // 32-42 hours on
    expect(buildCandidates(raw, { now: later }).map((i) => i.scope)).toEqual(['abia', 'abia', 'abia'])
    expect(buildCandidates(raw, { now: new Date('2026-10-12T06:30:00Z') })).toEqual([])
  })

  it('never offers a story the bot already used, or the same headline twice', () => {
    const items = buildCandidates([...raw, ...raw], {
      now: NOW,
      usedUrls: ['https://punchng.com/2027-abia-tricycle-operators-endorse-otti/'],
      usedTitles: ['POLICE bust counterfeit currency hideout in Abia!'],
    })
    expect(items.map((i) => i.title)).toEqual([
      'Soludo approves full implementation of 2025 ASUU agreement',
      'Farmers in Ohafia count losses after late rains',
    ])
  })
})

const FORUMS: Forum[] = [
  { slug: 'agriculture-farming', name: 'Agriculture & Farming', description: 'Farming in Abia' },
  { slug: 'politics-governance', name: 'Politics & Governance', description: null },
  { slug: 'education-career', name: 'Education & Career', description: null },
]

const ITEMS: NewsItem[] = buildCandidates(
  [...parseRss(GOOGLE_XML, GOOGLE), ...parseRss(BING_XML, BING), ...parseRss(VANGUARD_XML, VANGUARD)],
  { now: NOW },
)
// 1 Soludo (wider), 2 Ohafia farmers (abia), 3 Police (abia), 4 Otti tricycle (abia)

describe('the AI’s choice of stories', () => {
  it('lists forums, headlines and what was already discussed', () => {
    const msg = selectionUserMessage({ forums: FORUMS, items: ITEMS, recentTitles: ['Old topic'], maxPicks: 5 })
    expect(msg).toContain('Choose at most 5 picks.')
    expect(msg).toContain('- agriculture-farming: Agriculture & Farming (Farming in Abia)')
    expect(msg).toContain('2. [ABIA] Farmers in Ohafia count losses after late rains (Vanguard, 2026-10-09)')
    expect(msg).toContain('1. [NIGERIA] Soludo approves')
    expect(msg).toContain('- Old topic')
  })

  it('keeps only real forums and real headlines, one story per forum, no story twice', () => {
    const picks = parseSelection(
      '```json\n' +
        JSON.stringify({
          picks: [
            { forum: 'agriculture-farming', ids: [2], sensitive: false },
            { forum: 'made-up-forum', ids: [3] },
            { forum: 'politics-governance', ids: [4, 99], sensitive: true },
            { forum: 'politics-governance', ids: [3] }, // second pick for the same forum
            { forum: 'education-career', ids: [2] }, // story already used above
          ],
        }) +
        '\n```',
      FORUMS,
      ITEMS,
    )
    expect(picks.map((p) => [p.forum, p.items.map((i) => i.id), p.scope, p.sensitive])).toEqual([
      ['agriculture-farming', [2], 'abia', false],
      ['politics-governance', [4], 'abia', true],
    ])
  })

  it('returns nothing for an unusable answer', () => {
    expect(parseSelection('I could not decide', FORUMS, ITEMS)).toEqual([])
    expect(parseSelection('{"picks":"none"}', FORUMS, ITEMS)).toEqual([])
  })

  it('when there are too many: Abia stories first, then forums left longest without a post', () => {
    const pick = (forum: string, scope: 'abia' | 'wider'): Pick => ({ forum, items: [ITEMS[0]], scope, sensitive: false })
    const picks = [pick('a', 'wider'), pick('b', 'abia'), pick('c', 'abia'), pick('d', 'wider')]
    const kept = prioritise(picks, 3, { b: '2026-10-09', c: '2026-10-01', a: '2026-10-08' })
    expect(kept.map((p) => p.forum)).toEqual(['c', 'b', 'd']) // d was never posted in, so it beats a
  })
})

const PICK: Pick = { forum: 'agriculture-farming', items: [ITEMS[1]], scope: 'abia', sensitive: false }
const GOOD = {
  title: 'Ohafia farmers count losses after late rains: how was your harvest?',
  paragraphs: ['Vanguard reports that cassava farmers in Ohafia say this year’s harvest is down after the late rains.'],
  questions: ['How did the late rains affect your farm?', 'What would help farmers recover before the next season?', 'Are food prices changing in your market?'],
  tags: ['Farming', 'ohafia', 'Cassava Harvest!'],
  sensitive: false,
}

describe('what the AI wrote', () => {
  it('gives the writer the reports, and says when only a headline is available', () => {
    const withText = writerUserMessage({ forum: FORUMS[0], pick: PICK, articleText: { [ITEMS[1].id]: 'Full article text.' } })
    expect(withText).toContain('Forum: Agriculture & Farming')
    expect(withText).toContain('Publisher: Vanguard')
    expect(withText).toContain('Article text:\nFull article text.')
    const headlineOnly = writerUserMessage({ forum: FORUMS[0], pick: PICK, articleText: {} })
    expect(headlineOnly).toContain('(Only the headline is available for this report.)')
    const national = writerUserMessage({ forum: FORUMS[2], pick: { ...PICK, scope: 'wider' }, articleText: {} })
    expect(national).toContain('ask how it affects Abians')
  })

  it('accepts a good draft and tidies the tags', () => {
    const draft = parseDraft(JSON.stringify(GOOD))!
    expect(draft.title).toBe(GOOD.title)
    expect(draft.tags).toEqual(['farming', 'ohafia', 'cassava-harvest'])
    expect(draft.questions).toHaveLength(3)
  })

  it('takes the short banner headline, or the title when the AI gives none', () => {
    expect(parseDraft(JSON.stringify(GOOD))!.banner).toBe(GOOD.title)
    expect(parseDraft(JSON.stringify({ ...GOOD, banner: 'Ohafia farmers count losses after late rains' }))!.banner).toBe(
      'Ohafia farmers count losses after late rains',
    )
    expect(parseDraft(JSON.stringify({ ...GOOD, banner: 'Rains' }))!.banner).toBe(GOOD.title)
  })

  it('strips any HTML or markdown the AI adds', () => {
    const draft = parseDraft(
      JSON.stringify({ ...GOOD, title: '**Ohafia farmers** count losses <script>alert(1)</script> after late rains?' }),
    )!
    expect(draft.title).toBe('Ohafia farmers count losses alert(1) after late rains?')
  })

  it('refuses drafts that are incomplete', () => {
    expect(parseDraft('not json')).toBeNull()
    expect(parseDraft(JSON.stringify({ ...GOOD, title: 'Too short' }))).toBeNull()
    expect(parseDraft(JSON.stringify({ ...GOOD, paragraphs: [] }))).toBeNull()
    expect(parseDraft(JSON.stringify({ ...GOOD, questions: ['Only one question here?'] }))).toBeNull()
  })
})

describe('which posts wait for an admin', () => {
  const draft = parseDraft(JSON.stringify(GOOD)) as Draft
  const sources = sourcesOf(PICK)
  const base = { forum: 'agriculture-farming', reviewSlugs: ['politics-governance'], pickSensitive: false, draft, sources }

  it('publishes an everyday story by itself', () => {
    expect(holdReason(base)).toBeNull()
  })

  it('holds every post in a sensitive forum', () => {
    expect(holdReason({ ...base, forum: 'politics-governance' })).toMatch(/always wait/)
  })

  it('holds a story the AI marked sensitive, at either step', () => {
    expect(holdReason({ ...base, pickSensitive: true })).toMatch(/sensitive/)
    expect(holdReason({ ...base, draft: { ...draft, sensitive: true } })).toMatch(/sensitive/)
  })

  it('holds a story with sensitive words even if the AI missed it', () => {
    expect(holdReason({ ...base, draft: { ...draft, title: 'Two farmers killed in land dispute: what can be done?' } })).toBe(
      'The story mentions "killed"',
    )
    const police = { ...sources[0], title: 'Police arrest three over market fire' }
    expect(holdReason({ ...base, sources: [police] })).toBe('The story mentions "arrest"')
    expect(holdReason({ ...base, draft: { ...draft, paragraphs: ['INEC has announced the timetable for the election.'] } })).toMatch(/mentions/)
  })

  it('holds everything in a test run', () => {
    expect(holdReason({ ...base, test: true })).toMatch(/Test run/)
  })
})

describe('the post', () => {
  it('builds safe HTML with the feed’s own source links', () => {
    const draft: Draft = { ...GOOD, banner: GOOD.title, paragraphs: ['Prices rose <b>fast</b> & "wide".'], tags: [] }
    const html = renderPostHtml(draft, [{ title: 'T', url: 'https://example.com/a?x=1&y="2"', publisher: 'Vanguard & Co' }])
    expect(html).toContain('<p>Prices rose &lt;b&gt;fast&lt;/b&gt; &amp; &quot;wide&quot;.</p>')
    expect(html).toContain('<h3>Over to you</h3>')
    expect(html).toContain('<ol><li>How did the late rains affect your farm?</li>')
    expect(html).toContain('<a href="https://example.com/a?x=1&amp;y=%222%22" target="_blank" rel="noopener noreferrer">Vanguard &amp; Co</a>'.replace('%22', '&quot;').replace('%22', '&quot;'))
    expect(html).toContain('Source: ')
    expect(html).toContain('Put together by the AbiaConnect Newsdesk assistant from the linked report.')
  })

  it('puts the post’s banner at the top of the thread, safely', () => {
    expect(bannerHtml('https://x.supabase.co/storage/v1/object/public/newsdesk/banners/a.jpg', 'Aba "markets" & more')).toBe(
      '<figure><img src="https://x.supabase.co/storage/v1/object/public/newsdesk/banners/a.jpg" alt="Aba &quot;markets&quot; &amp; more"></figure>\n',
    )
  })

  it('shortens a long headline for the banner at a word, and leaves a short one alone', () => {
    expect(bannerHeadline('  FG awards ₦100m to   Abia innovator ')).toBe('FG awards ₦100m to Abia innovator')
    const long = 'Abia voters lament as INEC officials abandon PVC collection centres: has it happened where you live, and what should be done?'
    const short = bannerHeadline(long)
    expect(short.length).toBeLessThanOrEqual(90)
    expect(short).toBe('Abia voters lament as INEC officials abandon PVC collection centres: has it happened…')
  })

  it('names each publisher once', () => {
    const two: Pick = { ...PICK, items: [ITEMS[0], ITEMS[1], ITEMS[3]] } // Vanguard, Vanguard, The Punch
    expect(sourcesOf(two).map((s) => s.publisher)).toEqual(['Vanguard', 'The Punch'])
  })

  it('pulls readable paragraphs out of a news page', () => {
    const page = `<html><head><style>p{}</style><script>var a="<p>not this, it is inside a script tag and long enough to count</p>"</script></head>
      <body><nav><p>Menu items that are long enough to look like a paragraph of text here</p></nav>
      <p>Short.</p>
      <p>ID) . '?utm_source=news-flash&utm_medium=web"> Download Punch Lite App for the latest news on your phone</p>
      <p>Cassava farmers in Ohafia say the harvest is down this year after the rains came late, <a href="#">our reporter</a> writes.</p>
      <p>Copyright 2026 Vanguard. All rights reserved. This material may not be published or broadcast.</p></body></html>`
    expect(extractArticleText(page)).toBe(
      'Cassava farmers in Ohafia say the harvest is down this year after the rains came late, our reporter writes.',
    )
  })
})

describe('dates and share pages', () => {
  it('uses the date in Abia, not UTC', () => {
    expect(lagosDate(new Date('2026-10-09T23:30:00Z'))).toBe('2026-10-10')
    expect(lagosDate(new Date('2026-10-10T06:30:00Z'))).toBe('2026-10-10')
  })

  it('gives a forum share page only for forums that have a picture', () => {
    const id = '11111111-2222-3333-4444-555555555555'
    expect(sharePathFor('business-commerce', id)).toBe(`/share/forum-business-commerce.html?t=${id}`)
    expect(sharePathFor('brand-new-forum', id)).toBeNull()
    expect(FORUM_CARDS).toHaveLength(17)
    expect(sharePathFor('gossip', id)).toBe(`/share/forum-gossip.html?t=${id}`)
  })
})

describe('trusted publishers only', () => {
  it('knows established outlets and their sections, and refuses blogs', () => {
    for (const site of ['www.vanguardngr.com', 'punchng.com', 'thewhistler.ng', 'sport.bbc.co.uk', 'www.channelstv.com', 'abiastate.gov.ng']) {
      expect(isTrustedSite(site), site).toBe(true)
    }
    for (const site of ['gistlover.com', 'gistmania.com', 'tori.ng', 'footballinnigeria.com.ng', 'notpunchng.com', 'hausa.legit.ng', 'punchng.com.evil.example']) {
      expect(isTrustedSite(site), site).toBe(false)
    }
  })

  it('drops Google and Bing stories from publishers that are not on the list', () => {
    const google = `<item><title>Singer in fresh scandal - Gistlover</title><link>https://news.google.com/rss/articles/A?oc=5</link><pubDate>Fri, 09 Oct 2026 19:54:40 GMT</pubDate><source url="https://www.gistlover.com">Gistlover</source></item>
<item><title>Abia innovator wins N100m award - The Sun Nigeria</title><link>https://news.google.com/rss/articles/B?oc=5</link><pubDate>Fri, 09 Oct 2026 19:54:40 GMT</pubDate><source url="https://thesun.ng">The Sun Nigeria</source></item>`
    expect(parseRss(google, GOOGLE).map((i) => i.publisher)).toEqual(['The Sun Nigeria'])
    const bing = `<item><title>Rumour blog story about Abia</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2ftori.ng%2fnews%2f1%2f</link><pubDate>Fri, 09 Oct 2026 11:50:00 GMT</pubDate><News:Source>Tori</News:Source></item>`
    expect(parseRss(bing, BING)).toEqual([])
  })
})

describe('entertainment news and the Gossip forum', () => {
  const SHOWBIZ = FEEDS.find((f) => f.showbiz)!
  const xml = `<item><title>Singer announces new album and world tour dates</title><link>https://www.vanguardngr.com/2026/10/album/</link><pubDate>Fri, 09 Oct 2026 21:00:00 +0000</pubDate><description><![CDATA[<p>The singer made the announcement on stage.</p>]]></description></item>`
  const items = buildCandidates([...parseRss(xml, SHOWBIZ), ...parseRss(VANGUARD_XML, VANGUARD)], { now: NOW })
  const star = items.find((i) => i.showbiz)!
  const farm = items.find((i) => /Ohafia/.test(i.title))!
  const forums: Forum[] = [...FORUMS, { slug: 'gossip', name: 'Gossip', description: null }]

  it('marks entertainment stories and gives them their own share of the list', () => {
    expect(star.showbiz).toBe(true)
    expect(farm.showbiz).toBe(false)
    expect(selectionUserMessage({ forums, items, recentTitles: [], maxPicks: 4 })).toContain(`${star.id}. [SHOWBIZ] Singer announces`)
    const many = Array.from({ length: 40 }, (_, n) => ({ ...star, title: `Showbiz story number ${n} with a long headline`, url: `https://x/${n}` }))
    expect(buildCandidates(many, { now: NOW })).toHaveLength(25)
  })

  it('moves entertainment stories to Gossip wherever the AI filed them, and lets nothing else in', () => {
    const picks = parseSelection(
      JSON.stringify({
        picks: [
          { forum: 'education-career', ids: [star.id] }, // showbiz outside Gossip
          { forum: 'gossip', ids: [farm.id] }, // ordinary news in Gossip
          { forum: 'agriculture-farming', ids: [farm.id] },
          { forum: 'gossip', ids: [star.id] },
        ],
      }),
      forums,
      items,
    )
    // The entertainment story the AI filed under Education is moved to Gossip.
    expect(picks.map((p) => [p.forum, p.items[0].id])).toEqual([
      ['gossip', star.id],
      ['agriculture-farming', farm.id],
    ])
  })

  it('keeps the school mark when the same report also arrives in the general Abia news', () => {
    const general = { ...farm, id: undefined, title: 'ABSU creates new training directorate, names pioneer director', url: 'https://news.google.com/rss/articles/GEN', campus: false }
    const fromSchoolSearch = { ...general, url: 'https://news.google.com/rss/articles/CAMPUS', campus: true }
    const list = buildCandidates([general, fromSchoolSearch], { now: NOW })
    expect(list).toHaveLength(1)
    expect(list[0].campus).toBe(true)
  })
  it('tells the writer to keep entertainment news light and fair', () => {
    const pick: Pick = { forum: 'gossip', items: [star], scope: 'wider', sensitive: false }
    const msg = writerUserMessage({ forum: forums[3], pick, articleText: {} })
    expect(msg).toContain('This is entertainment news')
    expect(msg).not.toContain('ask how it affects Abians')
  })
})

describe('posts a day in each forum', () => {
  const forums = [{ slug: 'general-discussion' }, { slug: 'relationship' }, { slug: 'gossip' }, { slug: 'faith-spirituality' }]
  const limits = { 'general-discussion': 3, relationship: 0, gossip: '4' }

  it('uses a forum’s own number, or the default', () => {
    expect(forumLimit('general-discussion', limits, 2)).toBe(3)
    expect(forumLimit('gossip', limits, 2)).toBe(4)
    expect(forumLimit('faith-spirituality', limits, 2)).toBe(2)
    expect(forumLimit('relationship', limits, 2)).toBe(0)
    expect(forumLimit('x', { x: 999 }, 2)).toBe(10)
    expect(forumLimit('x', { x: 'many' }, 2)).toBe(2)
    expect(forumLimit('x', null, 2)).toBe(2)
  })

  it('keeps a forum open until it has had all its posts for the day', () => {
    const open = (posted: Record<string, number>) => openForums(forums, posted, limits, 2).map((f) => f.slug)
    expect(open({})).toEqual(['general-discussion', 'gossip', 'faith-spirituality']) // relationship is set to 0
    expect(open({ 'general-discussion': 2, gossip: 4, 'faith-spirituality': 1 })).toEqual(['general-discussion', 'faith-spirituality'])
    expect(open({ 'general-discussion': 3, gossip: 5, 'faith-spirituality': 2 })).toEqual([])
  })
})

describe('news from institutions’ own websites', () => {
  const PAGE = `<html><body>
    <nav><a href="/">Home</a><a href="/about">About Us</a><a href="/admissions">Admissions</a></nav>
    <script>var x = '<a href="/news/in-a-script-tag">This headline is inside a script and must be ignored</a>'</script>
    <a href="/website/news/guu-secures-nuc-accreditation/">GUU Secures NUC Accreditation For Doctor Of Pharmacy</a>
    <a href="https://www.gregoryuniversityuturu.edu.ng/website/news/resumption-date-2026/#top"><h3>Resumption date for the 2026/2027 session announced</h3></a>
    <a href="/website/news/guu-secures-nuc-accreditation/">GUU Secures NUC Accreditation For Doctor Of Pharmacy</a>
    <a href="/files/2026-admission-list-first-batch.pdf">Download the 2026 admission list (first batch) here</a>
    <a href="https://facebook.com/gregoryuni/posts/123456789">Follow Gregory University on Facebook for more updates</a>
    <a href="/news/1">Short link text</a>
    <a href="javascript:void(0)">Click this button to open the main navigation menu</a>
  </body></html>`
  const links = extractHeadlineLinks(PAGE, 'https://gregoryuniversityuturu.edu.ng/')

  it('finds headline links on the school’s own site, and leaves out menus, files and other sites', () => {
    expect(links).toEqual([
      { title: 'GUU Secures NUC Accreditation For Doctor Of Pharmacy', url: 'https://gregoryuniversityuturu.edu.ng/website/news/guu-secures-nuc-accreditation/' },
      { title: 'Resumption date for the 2026/2027 session announced', url: 'https://www.gregoryuniversityuturu.edu.ng/website/news/resumption-date-2026/' },
    ])
    expect(extractHeadlineLinks(PAGE, 'not a web address')).toEqual([])
  })

  it('treats the first reading of a page as the starting point: nothing is offered as news', () => {
    const first = newPageItems('Gregory University, Uturu', links, [], true, NOW)
    expect(first.items).toEqual([])
    expect(first.remember).toEqual(links.map((l) => ({ url: l.url, baseline: true })))
  })

  it('offers a link that appears later as that school’s news, for three days', () => {
    const seen = [{ url: links[0].url, first_seen: '2026-10-01T06:30:00.000Z', baseline: true }]
    const later = newPageItems('Gregory University, Uturu', links, seen, false, NOW)
    expect(later.remember).toEqual([{ url: links[1].url, baseline: false }])
    expect(later.items).toEqual([
      {
        title: 'Resumption date for the 2026/2027 session announced',
        url: links[1].url,
        publisher: 'Gregory University, Uturu',
        published: NOW.toISOString(),
        snippet: '',
        scope: 'abia',
        showbiz: false,
        campus: true,
      },
    ])

    const yesterday = [...seen, { url: links[1].url, first_seen: '2026-10-09T06:30:00.000Z', baseline: false }]
    const again = newPageItems('Gregory University, Uturu', links, yesterday, false, NOW)
    expect(again.remember).toEqual([]) // already remembered
    expect(again.items.map((i) => i.published)).toEqual(['2026-10-09T06:30:00.000Z']) // still on offer
    const stale = [...seen, { url: links[1].url, first_seen: '2026-10-05T06:30:00.000Z', baseline: false }]
    expect(newPageItems('Gregory University, Uturu', links, stale, false, NOW).items).toEqual([])
  })

  it('tidies "Read More" link text into the headline', () => {
    const { items } = newPageItems('Spiritan University, Nneochi', [{ title: 'Read More Spiritan University announces 8th matriculation ceremony', url: 'https://x/a' }], [], false, NOW)
    expect(items[0].title).toBe('Spiritan University announces 8th matriculation ceremony')
  })

  it('marks school news, gives it its own share of the list, and puts it only in the Institutions forum', () => {
    const { items: raw } = newPageItems('Gregory University, Uturu', links, [{ url: links[0].url, first_seen: '2026-10-08T08:00:00.000Z', baseline: false }], false, NOW)
    const items = buildCandidates([...raw, ...parseRss(VANGUARD_XML, VANGUARD)], { now: NOW })
    const campus = items.filter((i) => i.campus)
    expect(campus.map((i) => i.title)).toEqual(['Resumption date for the 2026/2027 session announced', 'GUU Secures NUC Accreditation For Doctor Of Pharmacy'])
    const forums: Forum[] = [...FORUMS, { slug: 'institutions', name: 'Institutions', description: null }]
    const farm = items.find((i) => /Ohafia/.test(i.title))!
    expect(selectionUserMessage({ forums, items, recentTitles: [], maxPicks: 4 })).toContain(`${campus[0].id}. [CAMPUS] `)
    const picks = parseSelection(
      JSON.stringify({
        picks: [
          { forum: 'education-career', ids: [campus[0].id] }, // school news outside Institutions
          { forum: 'institutions', ids: [farm.id] }, // ordinary news in Institutions
          { forum: 'institutions', ids: [campus[0].id] },
        ],
      }),
      forums,
      items,
    )
    expect(picks.map((p) => p.forum)).toEqual(['institutions'])
    const msg = writerUserMessage({ forum: forums[3], pick: picks[0], articleText: {} })
    expect(msg).toContain('This is news from a school in Abia State')
  })

  it('asks about school news alone when the Institutions forum was left empty', () => {
    const { items: raw } = newPageItems('Gregory University, Uturu', links, [{ url: links[0].url, first_seen: '2026-10-08T08:00:00.000Z', baseline: false }], false, NOW)
    const items = buildCandidates([...raw, ...parseRss(VANGUARD_XML, VANGUARD)], { now: NOW })
    const campus = items.filter((i) => i.campus)
    const institutions: Forum = { slug: 'institutions', name: 'Institutions', description: null }
    expect(campusSelectionSystemPrompt()).toContain('"forum":"institutions"')
    const msg = selectionUserMessage({ forums: [institutions], items: campus, recentTitles: [], maxPicks: 1 })
    expect(msg).toContain(`${campus[0].id}. [CAMPUS] `)
    expect(msg).not.toContain('Ohafia')
    // The second answer is checked against the school stories only, with their own numbers.
    const farm = items.find((i) => /Ohafia/.test(i.title))!
    const picks = parseSelection(JSON.stringify({ picks: [{ forum: 'institutions', ids: [farm.id, campus[1].id] }] }), [institutions], campus)
    expect(picks.map((p) => [p.forum, p.items.map((i) => i.title)])).toEqual([['institutions', [campus[1].title]]])
  })
})