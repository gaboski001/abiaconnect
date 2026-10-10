import { describe, expect, it } from 'vitest'
import { ABIA_SCHOOL_RE, buildCandidates, parseRss, type Feed } from '../../supabase/functions/_shared/newsdesk-core'
import {
  articlePhoto,
  googleLookupBody,
  googleLookupResult,
  googleNewsId,
  googleSignature,
  photoCredit,
} from '../../supabase/functions/_shared/newsdesk-photo'

const ID = 'CBMiogFBVV95cUxOVmJfZ0tQZ3ZyX2RkT0JfU0xvQ2h4'

describe('the real article behind a Google News link', () => {
  it('reads the article code from Google links only', () => {
    expect(googleNewsId(`https://news.google.com/rss/articles/${ID}?oc=5`)).toBe(ID)
    expect(googleNewsId(`https://news.google.com/articles/${ID}`)).toBe(ID)
    expect(googleNewsId('https://www.vanguardngr.com/2026/10/a-story/')).toBeNull()
    expect(googleNewsId('https://news.google.com/topics/abc')).toBeNull()
    expect(googleNewsId('not a link')).toBeNull()
  })

  it('finds the two values the lookup needs on the article page', () => {
    expect(googleSignature('<c-wiz><div data-n-a-sg="AbC_123" data-n-a-ts="1791644849"></div></c-wiz>')).toEqual({ signature: 'AbC_123', timestamp: 1791644849 })
    expect(googleSignature('<html>Before you continue to Google</html>')).toBeNull()
  })

  it('asks for the article by its code', () => {
    const body = decodeURIComponent(googleLookupBody(ID, 'AbC_123', 1791644849))
    expect(body.startsWith('f.req=[[["Fbv4je",')).toBe(true)
    expect(body).toContain(ID)
    expect(body).toContain('1791644849')
    expect(body).toContain('AbC_123')
  })

  it("reads the newspaper's address from the answer", () => {
    const answer = `)]}'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://thesun.ng/mdcn-inducts-16-rhema-varsity-doctors/\\",1]",null,null,null,"generic"]]`
    expect(googleLookupResult(answer)).toBe('https://thesun.ng/mdcn-inducts-16-rhema-varsity-doctors/')
    expect(googleLookupResult(`)]}'\n[["wrb.fr","Fbv4je",null,null,null,[3],"generic"]]`)).toBeNull()
    expect(googleLookupResult('')).toBeNull()
  })
})

describe("the report's own picture", () => {
  const PAGE = 'https://thewhistler.ng/absu-creates-new-training-directorate/'

  it('takes the picture the page offers for link previews', () => {
    const html = '<head><meta property="og:title" content="ABSU"><meta property="og:image" content="https://thewhistler.ng/wp-content/uploads/2026/10/Acho-Elendu.jpeg"></head>'
    expect(articlePhoto(html, PAGE)).toBe('https://thewhistler.ng/wp-content/uploads/2026/10/Acho-Elendu.jpeg')
  })

  it('reads either attribute order, relative addresses and the Twitter tag', () => {
    expect(articlePhoto('<meta content="/uploads/a&amp;b.jpg" property="og:image" />', PAGE)).toBe('https://thewhistler.ng/uploads/a&b.jpg')
    expect(articlePhoto("<meta name='twitter:image' content='https://cdn.thesun.ng/x.jpg'>", PAGE)).toBe('https://cdn.thesun.ng/x.jpg')
  })

  it('leaves out site logos, placeholders and pages with no picture', () => {
    expect(articlePhoto('<meta property="og:image" content="https://site.ng/assets/site-logo.png">', PAGE)).toBeNull()
    expect(articlePhoto('<meta property="og:image" content="https://site.ng/img/default-share.jpg">', PAGE)).toBeNull()
    expect(articlePhoto('<meta property="og:image" content="https://site.ng/img/icon.svg">', PAGE)).toBeNull()
    expect(articlePhoto('<meta property="og:image" content="javascript:alert(1)">', PAGE)).toBeNull()
    expect(articlePhoto('<p>No picture here</p>', PAGE)).toBeNull()
    // A logo in the first tag does not hide a real picture in another.
    expect(articlePhoto('<meta property="og:image" content="https://site.ng/logo.png"><meta name="twitter:image" content="https://site.ng/story.jpg">', PAGE)).toBe('https://site.ng/story.jpg')
  })

  it('credits the newspaper', () => {
    expect(photoCredit('The Sun Nigeria')).toBe('Photo: The Sun Nigeria')
    expect(photoCredit('  <b>Vanguard</b>  News ')).toBe('Photo: bVanguardb News')
    expect(photoCredit('')).toBe('Photo: the publisher')
  })
})

describe('school searches keep only reports that name an Abia school', () => {
  it('knows the schools as newspapers name them', () => {
    for (const title of [
      'ABSU Creates New Training Directorate',
      'MDCN inducts 16 Rhema Varsity doctors',
      'MOUAU 76th Inaugural Lecture holds 14 October',
      'Abia University professor to face panel',
      'Abia Poly rector speaks on accreditation',
      'Gregory University, Uturu matriculates 800',
      'NINLAN set to receive take-off grant',
    ]) {
      expect(ABIA_SCHOOL_RE.test(title), title).toBe(true)
    }
    for (const title of ['Abia Govt Defends Airport Project', 'BUK, MAAUN make Kano proud in universities ranking', 'Abia Demands Proper Monitoring Of Farmers’ Inputs']) {
      expect(ABIA_SCHOOL_RE.test(title), title).toBe(false)
    }
  })

  it('drops other reports from a school search', () => {
    const item = (title: string) =>
      `<item><title>${title} - The Whistler Newspaper</title><link>https://news.google.com/rss/articles/${ID}${title.length}</link><pubDate>Thu, 08 Oct 2026 06:23:00 GMT</pubDate><source url="https://thewhistler.ng">The Whistler Newspaper</source></item>`
    const xml = `<rss><channel>${item('ABSU Creates New Training Directorate')}${item('Abia Govt Defends Airport Project, Challenges Critics')}</channel></rss>`
    const campus: Feed = { name: 'Google News', url: 'https://news.google.com/rss/search?q=ABSU', scope: 'abia', campus: true }
    expect(parseRss(xml, campus).map((i) => i.title)).toEqual(['ABSU Creates New Training Directorate'])
    // The same report from an ordinary Abia search is still general news.
    expect(parseRss(xml, { ...campus, campus: false })).toHaveLength(2)
  })

  it("keeps every item of a school's own feed, and offers it for 30 days", () => {
    const xml = `<rss><channel><item><title>Commencement of 2026/2027 Academic Session</title><link>https://clifforduni.edu.ng/commencement-of-2026-2027-academic-session/</link><pubDate>Fri, 18 Sep 2026 12:09:00 +0000</pubDate></item><item><title>Disclaimer on fake admission agents</title><link>https://clifforduni.edu.ng/disclaimer/</link><pubDate>Wed, 08 May 2024 18:40:45 +0000</pubDate></item></channel></rss>`
    const feed: Feed = { name: 'Clifford University, Owerrinta', url: 'https://clifforduni.edu.ng/feed/', scope: 'abia', campus: true, official: true }
    const raw = parseRss(xml, feed)
    expect(raw.map((i) => [i.publisher, i.campus, i.official])).toEqual([
      ['Clifford University, Owerrinta', true, true],
      ['Clifford University, Owerrinta', true, true],
    ])
    // 22 days old is still on offer; the 2024 notice is not. A newspaper report of that age would be dropped.
    const now = new Date('2026-10-10T16:00:00Z')
    expect(buildCandidates(raw, { now }).map((i) => i.title)).toEqual(['Commencement of 2026/2027 Academic Session'])
    expect(buildCandidates(raw.map((i) => ({ ...i, official: false })), { now })).toEqual([])
  })
})
