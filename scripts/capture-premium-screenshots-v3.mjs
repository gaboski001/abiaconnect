import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:4173'
const outDir = '/mnt/user-data/outputs/abiaconnect-redesign-shots-v3'
await fs.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })

const mockUser = {
  id: 'preview-user-001',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Chinelo Okafor', username: 'chinelo_o', lga: 'Umuahia North' },
  aud: 'authenticated',
  email: 'chinelo@example.com',
  created_at: new Date().toISOString(),
}

const mockSession = {
  access_token: 'preview-access-token',
  refresh_token: 'preview-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: mockUser,
}

const mockProfile = {
  id: mockUser.id,
  display_name: 'Chinelo Okafor',
  username: 'chinelo_o',
  lga: 'Umuahia North',
  bio: 'Community advocate, builder, and Abia diaspora connector focused on culture, mentorship, and opportunity.',
  reputation: 128,
  avatar_url: null,
  created_at: '2025-02-18T10:20:00.000Z',
}

const otherProfile = {
  id: 'preview-user-002',
  display_name: 'Ifeanyi Nwosu',
  username: 'ifeanyi_n',
  avatar_url: null,
}

const extraProfiles = [
  { id: 'preview-user-003', display_name: 'Amaka Ude', avatar_url: null },
  { id: 'preview-user-004', display_name: 'Somto Kalu', avatar_url: null },
  { id: 'preview-user-005', display_name: 'Ngozi Aja', avatar_url: null },
]

const categories = [
  {
    id: 'culture-identity',
    name: 'Culture & Identity',
    description: 'Language, heritage, community stories, and traditions that keep Abia connected across the world.',
    icon: '🎭',
    color: '#F8C301',
    thread_count: 42,
    is_popular: true,
    is_active: true,
    display_order: 1,
  },
  {
    id: 'business-opportunity',
    name: 'Business & Opportunity',
    description: 'Entrepreneurship, trade, diaspora investment, and practical ideas for growth.',
    icon: '📈',
    color: '#1CA9D9',
    thread_count: 31,
    is_popular: true,
    is_active: true,
    display_order: 2,
  },
  {
    id: 'community-events',
    name: 'Community Events',
    description: 'Town halls, youth gatherings, campus updates, and cultural meetups.',
    icon: '🎉',
    color: '#E87015',
    thread_count: 24,
    is_popular: false,
    is_active: true,
    display_order: 3,
  },
  {
    id: 'diaspora-living',
    name: 'Diaspora Living',
    description: 'Advice, support, and shared experiences from Abians building abroad.',
    icon: '🌍',
    color: '#7C3AED',
    thread_count: 18,
    is_popular: false,
    is_active: true,
    display_order: 4,
  },
]

const heroSlides = [
  {
    id: 'slide-1',
    title: 'AbiaConnect Premium Community Experience',
    subtitle: 'Built for diaspora and home',
    body: 'Discover cleaner browsing, sharper category discovery, and a more professional Android-native experience across the app.',
    cta_label: 'Explore Categories',
    cta_url: '/category/culture-identity',
    cta_label_2: 'Open Dashboard',
    cta_url_2: '/dashboard',
    bg_color_from: '#07111F',
    bg_color_to: '#101A2E',
    badge_text: 'Premium mobile redesign',
    image_url: null,
    is_active: true,
    expires_at: null,
    order: 1,
  },
]

const allThreads = [
  {
    id: 'thread-preview-001',
    category_id: 'culture-identity',
    subgroup_id: null,
    user_id: mockUser.id,
    author_id: mockUser.id,
    title: 'Premium mobile redesign rollout checklist',
    content: '<p>We now have a cleaner app shell, upgraded category discovery, improved thread readability, better light-theme contrast, and a more professional footer, sidebar, and hero experience.</p><p>This final QA thread tracks the screenshots, packaging, and native visual verification for release.</p>',
    tags: ['design', 'mobile'],
    is_pinned: true,
    is_anonymous: false,
    upvotes: 18,
    downvotes: 2,
    view_count: 126,
    created_at: '2026-06-27T07:20:00.000Z',
    updated_at: '2026-06-27T09:20:00.000Z',
    allow_replies: true,
    is_deleted: false,
    categories: { id: 'culture-identity', name: 'Culture & Identity' },
    replies: [{ count: 14 }],
  },
  {
    id: 'thread-preview-002',
    category_id: 'business-opportunity',
    subgroup_id: null,
    user_id: otherProfile.id,
    author_id: otherProfile.id,
    title: 'Testing FCM call alerts on Android 14 devices',
    content: '<p>We tested incoming-call alerts across active, background, and reopened states. Session refresh and in-app route handling are stable after the latest fixes.</p>',
    tags: ['android', 'alerts'],
    is_pinned: false,
    is_anonymous: false,
    upvotes: 11,
    downvotes: 0,
    view_count: 83,
    created_at: '2026-06-25T13:10:00.000Z',
    updated_at: '2026-06-25T13:10:00.000Z',
    allow_replies: true,
    is_deleted: false,
    categories: { id: 'business-opportunity', name: 'Business & Opportunity' },
    replies: [{ count: 8 }],
  },
  {
    id: 'thread-preview-003',
    category_id: 'culture-identity',
    subgroup_id: null,
    user_id: 'preview-user-003',
    author_id: 'preview-user-003',
    title: 'How AbiaConnect can improve diaspora onboarding',
    content: '<p>Clearer onboarding, a more focused hero page, and better menu structure make the native experience easier for first-time members.</p>',
    tags: ['onboarding'],
    is_pinned: false,
    is_anonymous: false,
    upvotes: 9,
    downvotes: 1,
    view_count: 57,
    created_at: '2026-06-24T09:00:00.000Z',
    updated_at: '2026-06-24T09:00:00.000Z',
    allow_replies: true,
    is_deleted: false,
    categories: { id: 'culture-identity', name: 'Culture & Identity' },
    replies: [{ count: 5 }],
  },
  {
    id: 'thread-preview-004',
    category_id: 'culture-identity',
    subgroup_id: null,
    user_id: 'preview-user-004',
    author_id: 'preview-user-004',
    title: 'Preserving Igbo language and local history for the next generation',
    content: '<p>Better typography and spacing now make long-form cultural discussions more comfortable to read on mobile.</p>',
    tags: ['heritage'],
    is_pinned: false,
    is_anonymous: false,
    upvotes: 16,
    downvotes: 0,
    view_count: 144,
    created_at: '2026-06-23T16:00:00.000Z',
    updated_at: '2026-06-23T16:00:00.000Z',
    allow_replies: true,
    is_deleted: false,
    categories: { id: 'culture-identity', name: 'Culture & Identity' },
    replies: [{ count: 19 }],
  },
]

const replies = [
  {
    id: 'reply-1',
    thread_id: 'thread-preview-001',
    user_id: otherProfile.id,
    parent_reply_id: null,
    content: '<p>The thread page feels much cleaner now. The reply cards are easier to scan, and the light theme is finally comfortable to read.</p>',
    created_at: '2026-06-27T08:05:00.000Z',
    upvotes: 7,
    downvotes: 0,
  },
  {
    id: 'reply-2',
    thread_id: 'thread-preview-001',
    user_id: 'preview-user-003',
    parent_reply_id: null,
    content: '<p>I also like the new footer and subgroup cards. They feel more consistent with the dashboard and login screens.</p>',
    created_at: '2026-06-27T08:12:00.000Z',
    upvotes: 5,
    downvotes: 0,
  },
  {
    id: 'reply-3',
    thread_id: 'thread-preview-001',
    user_id: mockUser.id,
    parent_reply_id: 'reply-2',
    content: '<p>Great — next step is packaging the updated ZIP and final screenshot set.</p>',
    created_at: '2026-06-27T08:18:00.000Z',
    upvotes: 3,
    downvotes: 0,
  },
]

const subgroups = [
  {
    id: 'sg-1',
    name: 'Diaspora Builders Circle',
    description: 'Professional members sharing growth ideas, mentorship, and collaboration opportunities across regions.',
    category: 'Business',
    cover_image_url: null,
    is_private: false,
    is_active: true,
    member_count: 184,
    thread_count: 36,
  },
  {
    id: 'sg-2',
    name: 'Abia Youth Network',
    description: 'Career support, youth events, campus opportunities, and community-led projects.',
    category: 'Education',
    cover_image_url: null,
    is_private: true,
    is_active: true,
    member_count: 132,
    thread_count: 28,
  },
  {
    id: 'sg-3',
    name: 'Culture & Heritage Keepers',
    description: 'A home for preserving language, oral history, arts, and identity across generations.',
    category: 'Culture',
    cover_image_url: null,
    is_private: false,
    is_active: true,
    member_count: 96,
    thread_count: 17,
  },
]

const subgroupMemberships = [
  { subgroup_id: 'sg-1', user_id: mockUser.id },
  { subgroup_id: 'sg-2', user_id: mockUser.id },
]

const polls = [
  {
    id: 'poll-1',
    question: 'Which part of the refreshed app feels most improved?',
    created_at: '2026-06-26T12:00:00.000Z',
    expires_at: '2026-07-05T12:00:00.000Z',
    is_active: true,
    created_by: otherProfile.id,
    profiles: { display_name: 'Ifeanyi Nwosu' },
  },
  {
    id: 'poll-2',
    question: 'Should the community spotlight be featured on the homepage hero?',
    created_at: '2026-06-25T10:00:00.000Z',
    expires_at: null,
    is_active: true,
    created_by: mockUser.id,
    profiles: { display_name: 'Chinelo Okafor' },
  },
]

const pollOptions = [
  { id: 'opt-1', poll_id: 'poll-1', text: 'Thread pages' },
  { id: 'opt-2', poll_id: 'poll-1', text: 'Subgroups' },
  { id: 'opt-3', poll_id: 'poll-1', text: 'Hero and navigation' },
  { id: 'opt-4', poll_id: 'poll-2', text: 'Yes, prominently' },
  { id: 'opt-5', poll_id: 'poll-2', text: 'Only on campaign weeks' },
  { id: 'opt-6', poll_id: 'poll-2', text: 'Keep it in the sidebar' },
]

const pollCounts = [
  { poll_id: 'poll-1', poll_option_id: 'opt-1', vote_count: 14 },
  { poll_id: 'poll-1', poll_option_id: 'opt-2', vote_count: 9 },
  { poll_id: 'poll-1', poll_option_id: 'opt-3', vote_count: 22 },
  { poll_id: 'poll-2', poll_option_id: 'opt-4', vote_count: 18 },
  { poll_id: 'poll-2', poll_option_id: 'opt-5', vote_count: 4 },
  { poll_id: 'poll-2', poll_option_id: 'opt-6', vote_count: 2 },
]

const pollVotes = [
  { poll_id: 'poll-1', poll_option_id: 'opt-3', user_id: mockUser.id },
]

const conversations = [
  {
    id: 'convo-preview-001',
    user1_id: mockUser.id,
    user2_id: otherProfile.id,
    updated_at: '2026-06-27T10:00:00.000Z',
  },
  {
    id: 'convo-preview-002',
    user1_id: mockUser.id,
    user2_id: 'preview-user-003',
    updated_at: '2026-06-27T08:45:00.000Z',
  },
]

const messages = [
  {
    id: 'msg-1',
    conversation_id: 'convo-preview-001',
    sender_id: otherProfile.id,
    content: 'Good morning! The youth summit flyer looks polished. Are we sharing it tonight?',
    created_at: '2026-06-27T09:42:00.000Z',
    is_read: true,
    read_at: '2026-06-27T09:43:00.000Z',
  },
  {
    id: 'msg-2',
    conversation_id: 'convo-preview-001',
    sender_id: mockUser.id,
    content: 'Yes — I tightened the CTA, improved the card spacing, and prepared the push alert copy.',
    created_at: '2026-06-27T09:43:00.000Z',
    is_read: true,
    read_at: '2026-06-27T09:44:00.000Z',
  },
  {
    id: 'msg-3',
    conversation_id: 'convo-preview-001',
    sender_id: otherProfile.id,
    content: 'Perfect. Let us also test the incoming call flow before we publish.',
    created_at: '2026-06-27T09:44:00.000Z',
    is_read: false,
    read_at: null,
  },
]

const notifications = [
  {
    id: 'notif-1',
    user_id: mockUser.id,
    type: 'mention',
    message: 'Ifeanyi mentioned you in Community Events planning.',
    is_read: false,
    created_at: '2026-06-27T09:50:00.000Z',
    link: '/messages/convo-preview-001',
  },
  {
    id: 'notif-2',
    user_id: mockUser.id,
    type: 'reply',
    message: 'Your update on premium Android redesign received a new reply.',
    is_read: false,
    created_at: '2026-06-27T08:10:00.000Z',
    link: '/thread/thread-preview-001',
  },
  {
    id: 'notif-3',
    user_id: mockUser.id,
    type: 'system',
    message: 'Incoming call alerts are now configured for mobile devices.',
    is_read: true,
    created_at: '2026-06-26T18:15:00.000Z',
    link: '/notifications',
  },
]

const achievements = [
  { id: 'ach-1', name: 'Top Contributor', description: 'Recognized for steady, helpful community activity', icon: '🏆' },
  { id: 'ach-2', name: 'Community Builder', description: 'Created trusted engagement across conversations', icon: '✨' },
]

async function installAuthMocks(page, theme = 'dark') {
  await page.addInitScript(({ mockUser, mockSession, mockProfile, theme }) => {
    localStorage.setItem('abiaconnect-theme', theme)
    localStorage.setItem('abia_cached_role', 'Member')
    localStorage.setItem('abia_cached_user', JSON.stringify(mockUser))
    localStorage.setItem(`abia_profile_${mockUser.id}`, JSON.stringify(mockProfile))
    localStorage.setItem('sb-tnwgnowjmrbjugheorkv-auth-token', JSON.stringify(mockSession))
    localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession))
  }, { mockUser, mockSession, mockProfile, theme })

  await page.route('https://tnwgnowjmrbjugheorkv.supabase.co/auth/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/user')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: mockUser, session: mockSession }) })
  })

  await page.route('https://tnwgnowjmrbjugheorkv.supabase.co/rest/v1/**', async (route) => {
    const url = route.request().url()
    let body = []

    if (url.includes('/rpc/get_my_profile')) body = [mockProfile]
    else if (url.includes('/rpc/get_public_profiles')) body = [mockProfile, otherProfile, ...extraProfiles]
    else if (url.includes('/rpc/get_poll_counts')) body = pollCounts
    else if (url.includes('/rpc/get_reply_vote_counts')) {
      body = replies.map((r) => ({ reply_id: r.id, upvotes: r.upvotes, downvotes: r.downvotes }))
    } else if (url.includes('/rpc/get_thread_vote_counts')) {
      body = [{ thread_id: 'thread-preview-001', upvotes: 18, downvotes: 2 }]
    } else if (url.includes('/rpc/get_thread_subgroup_id')) body = null
    else if (url.includes('/hero_slides')) body = heroSlides
    else if (url.includes('/categories')) body = categories
    else if (url.includes('/conversations')) body = conversations
    else if (url.includes('/messages')) body = messages
    else if (url.includes('/notifications')) body = notifications
    else if (url.includes('/poll_votes')) body = pollVotes
    else if (url.includes('/poll_options')) body = pollOptions
    else if (url.includes('/polls')) body = polls
    else if (url.includes('/replies')) body = replies
    else if (url.includes('/subgroup_members')) body = subgroupMemberships
    else if (url.includes('/subgroups')) body = subgroups
    else if (url.includes('/threads')) body = allThreads
    else if (url.includes('/achievements')) body = achievements
    else if (url.includes('/profiles')) body = [mockProfile]
    else if (url.includes('/bookmarks')) body = []

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function shot(name, url, setup, options = {}) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
  if (setup) await setup(page)
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate((opts) => {
    for (const selector of opts.hideSelectors || []) {
      document.querySelectorAll(selector).forEach((node) => {
        node.style.display = 'none'
      })
    }
  }, options)
  await page.waitForTimeout(1000)
  const screenshotOptions = { path: path.join(outDir, name), fullPage: false }
  if (options.clip) screenshotOptions.clip = options.clip
  await page.screenshot(screenshotOptions)
  await page.close()
}

await shot('onboarding-mobile.png', `${baseUrl}/`, async (page) => {
  await page.addInitScript(() => {
    window.CapacitorCustomPlatform = { name: 'android' }
    localStorage.removeItem('hasSeenOnboarding')
    localStorage.setItem('abiaconnect-theme', 'dark')
  })
})

await shot('home-mobile-dark.png', `${baseUrl}/`, async (page) => {
  await installAuthMocks(page, 'dark')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('home-mobile-light.png', `${baseUrl}/`, async (page) => {
  await installAuthMocks(page, 'light')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('category-mobile.png', `${baseUrl}/category/culture-identity`, async (page) => {
  await installAuthMocks(page, 'dark')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('thread-mobile.png', `${baseUrl}/thread/thread-preview-001`, async (page) => {
  await installAuthMocks(page, 'dark')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('thread-mobile-light.png', `${baseUrl}/thread/thread-preview-001`, async (page) => {
  await installAuthMocks(page, 'light')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('subgroups-mobile.png', `${baseUrl}/subgroups`, async (page) => {
  await installAuthMocks(page, 'dark')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('polls-mobile.png', `${baseUrl}/polls`, async (page) => {
  await installAuthMocks(page, 'dark')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('about-mobile.png', `${baseUrl}/about`, async (page) => {
  await installAuthMocks(page, 'light')
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('login-mobile.png', `${baseUrl}/login`, async (page) => {
  await page.addInitScript(() => localStorage.setItem('abiaconnect-theme', 'dark'))
})

await shot('dashboard-mobile.png', `${baseUrl}/dashboard`, async (page) => {
  await installAuthMocks(page, 'dark')
})

await shot('messages-mobile.png', `${baseUrl}/messages/convo-preview-001`, async (page) => {
  await installAuthMocks(page, 'dark')
})

await shot('notifications-mobile.png', `${baseUrl}/notifications`, async (page) => {
  await installAuthMocks(page, 'dark')
})

await shot('profile-mobile.png', `${baseUrl}/profile`, async (page) => {
  await installAuthMocks(page, 'dark')
})

await browser.close()
console.log(outDir)
