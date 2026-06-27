import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:4173'
const outDir = '/mnt/user-data/outputs/abiaconnect-redesign-shots'
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
    badge_text: '✦ Premium mobile redesign',
    image_url: null,
    is_active: true,
  },
]

const allThreads = [
  {
    id: 'thread-preview-001',
    category_id: 'culture-identity',
    user_id: mockUser.id,
    author_id: mockUser.id,
    title: 'Premium mobile redesign rollout checklist',
    tags: ['design', 'mobile'],
    is_pinned: true,
    is_anonymous: false,
    upvotes: 18,
    view_count: 126,
    created_at: '2026-06-27T07:20:00.000Z',
    replies: [{ count: 14 }],
    is_deleted: false,
  },
  {
    id: 'thread-preview-002',
    category_id: 'business-opportunity',
    user_id: otherProfile.id,
    author_id: otherProfile.id,
    title: 'Testing FCM call alerts on Android 14 devices',
    tags: ['android', 'alerts'],
    is_pinned: false,
    is_anonymous: false,
    upvotes: 11,
    view_count: 83,
    created_at: '2026-06-25T13:10:00.000Z',
    replies: [{ count: 8 }],
    is_deleted: false,
  },
  {
    id: 'thread-preview-003',
    category_id: 'culture-identity',
    user_id: 'preview-user-003',
    author_id: 'preview-user-003',
    title: 'How AbiaConnect can improve diaspora onboarding',
    tags: ['onboarding'],
    is_pinned: false,
    is_anonymous: false,
    upvotes: 9,
    view_count: 57,
    created_at: '2026-06-24T09:00:00.000Z',
    replies: [{ count: 5 }],
    is_deleted: false,
  },
  {
    id: 'thread-preview-004',
    category_id: 'culture-identity',
    user_id: 'preview-user-004',
    author_id: 'preview-user-004',
    title: 'Preserving Igbo language and local history for the next generation',
    tags: ['heritage'],
    is_pinned: false,
    is_anonymous: false,
    upvotes: 16,
    view_count: 144,
    created_at: '2026-06-23T16:00:00.000Z',
    replies: [{ count: 19 }],
    is_deleted: false,
  },
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

async function installAuthMocks(page) {
  await page.addInitScript(({ mockUser, mockSession, mockProfile }) => {
    localStorage.setItem('abiaconnect-theme', 'dark')
    localStorage.setItem('abia_cached_role', 'Member')
    localStorage.setItem('abia_cached_user', JSON.stringify(mockUser))
    localStorage.setItem(`abia_profile_${mockUser.id}`, JSON.stringify(mockProfile))
    localStorage.setItem('sb-tnwgnowjmrbjugheorkv-auth-token', JSON.stringify(mockSession))
    localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession))
  }, { mockUser, mockSession, mockProfile })

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
    else if (url.includes('/rpc/get_public_profiles')) body = [otherProfile, ...extraProfiles, mockProfile]
    else if (url.includes('/hero_slides')) body = heroSlides
    else if (url.includes('/categories')) body = categories
    else if (url.includes('/conversations')) body = conversations
    else if (url.includes('/messages')) body = messages
    else if (url.includes('/notifications')) body = notifications
    else if (url.includes('/threads')) body = allThreads
    else if (url.includes('/achievements')) body = achievements
    else if (url.includes('/profiles')) body = [mockProfile]

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function shot(name, url, setup, options = {}) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
  if (setup) await setup(page)
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate((opts) => {
    const footer = document.querySelector('footer')
    if (footer) footer.style.display = 'none'
    for (const selector of opts.hideSelectors || []) {
      document.querySelectorAll(selector).forEach((node) => {
        node.style.display = 'none'
      })
    }
  }, options)
  await page.waitForTimeout(900)
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

await shot('home-mobile.png', `${baseUrl}/`, async (page) => {
  await page.addInitScript(() => localStorage.setItem('abiaconnect-theme', 'dark'))
  await installAuthMocks(page)
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('category-mobile.png', `${baseUrl}/category/culture-identity`, async (page) => {
  await page.addInitScript(() => localStorage.setItem('abiaconnect-theme', 'dark'))
  await installAuthMocks(page)
}, { clip: { x: 0, y: 0, width: 412, height: 860 } })

await shot('login-mobile.png', `${baseUrl}/login`, async (page) => {
  await page.addInitScript(() => localStorage.setItem('abiaconnect-theme', 'dark'))
})

await shot('register-mobile.png', `${baseUrl}/register`, async (page) => {
  await page.addInitScript(() => localStorage.setItem('abiaconnect-theme', 'dark'))
})

await shot('dashboard-mobile.png', `${baseUrl}/dashboard`, async (page) => {
  await installAuthMocks(page)
})

await shot('messages-mobile.png', `${baseUrl}/messages/convo-preview-001`, async (page) => {
  await installAuthMocks(page)
})

await shot('notifications-mobile.png', `${baseUrl}/notifications`, async (page) => {
  await installAuthMocks(page)
})

await shot('profile-mobile.png', `${baseUrl}/profile`, async (page) => {
  await installAuthMocks(page)
})

await browser.close()
console.log(outDir)
