// @vitest-environment node
import { describe, it, expect } from 'vitest'
// @ts-expect-error plain JavaScript run by the GitHub job
import { planPages, sharePage, summary } from '../../scripts/newsdesk/sync_share_pages.mjs'

const STORAGE = 'https://proj.supabase.co/storage/v1/object/public/newsdesk/banners/'
const A = '11111111-2222-3333-4444-555555555555'
const B = '66666666-7777-8888-9999-aaaaaaaaaaaa'
const HAND_MADE = '058d6661-0720-46ae-aa0f-a90fc2065e72'

const post = (id: string, extra: Record<string, unknown> = {}) => ({
  thread_id: id,
  title: 'FG awards ₦100m to Abia innovator: what should "smart" farming look like?',
  banner_title: 'FG awards ₦100m to Abia innovator',
  banner_url: `${STORAGE}${id}.jpg`,
  content: '<p>MSME Africa reports that an Abia innovator has won a grant.</p><h3>Over to you</h3><ol><li>Question?</li></ol>',
  ...extra,
})

describe('Newsdesk share pages', () => {
  it('writes a preview page with the post’s title, banner and thread link', () => {
    const html = sharePage(post(A))
    expect(html).toContain('<meta property="og:title" content="FG awards ₦100m to Abia innovator: what should &quot;smart&quot; farming look like?">')
    expect(html).toContain(`<meta property="og:image" content="${STORAGE}${A}.jpg">`)
    expect(html).toContain('<meta property="og:image:alt" content="FG awards ₦100m to Abia innovator">')
    expect(html).toContain('<meta property="og:description" content="MSME Africa reports that an Abia innovator has won a grant. Over to you Question?">')
    expect(html).toContain(`<meta property="og:url" content="https://abiaconnect.com/share/post-${A}.html">`)
    expect(html).toContain(`<script>location.replace("https://abiaconnect.com/thread/${A}");</script>`)
  })

  it('keeps the description short, cut at a word', () => {
    const long = summary(`<p>${'word '.repeat(80)}</p>`)
    expect(long.length).toBeLessThanOrEqual(200)
    expect(long.endsWith('word…')).toBe(true)
  })

  it('adds new posts to the list and leaves existing share pages alone', () => {
    const index = { [HAND_MADE]: '/share/enyimba-first-win-2026-27.html', [B]: `/share/post-${B}.html` }
    const plan = planPages([post(A), post(B), post(HAND_MADE)], index, STORAGE)
    expect(Object.keys(plan.pages)).toEqual([`post-${A}.html`])
    expect(plan.index).toEqual({ ...index, [A]: `/share/post-${A}.html` })
    expect(index).not.toHaveProperty(A) // the list given is not changed
  })

  it('skips posts without a usable banner or thread', () => {
    const plan = planPages(
      [
        post(A, { banner_url: null }),
        post(A, { banner_url: 'https://evil.example/x.jpg' }),
        post(A, { banner_url: `${STORAGE}x.jpg" onerror="alert(1)` }),
        post('not-a-thread-id'),
        post(B, { title: '' }),
        null,
      ],
      {},
      STORAGE,
    )
    expect(plan.pages).toEqual({})
    expect(plan.index).toEqual({})
    expect(planPages('oops', {}, STORAGE).pages).toEqual({})
  })

  it('matches the share-page addresses the website and Facebook accept', () => {
    const plan = planPages([post(A.toUpperCase())], {}, STORAGE)
    expect(plan.index[A]).toMatch(/^\/share\/[a-z0-9-]+\.html$/)
  })
})
