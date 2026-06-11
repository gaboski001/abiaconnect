import { supabase } from '@/lib/supabase'

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const CATEGORIES = [
  { name: 'General Discussion', description: 'Talk about anything and everything happening in Abia State and beyond', icon: '💬', color: '#013220', is_popular: true, display_order: 1 },
  { name: 'Business & Commerce', description: 'Abia markets, trade, entrepreneurship, and economic opportunities', icon: '💼', color: '#8B6914', is_popular: true, display_order: 2 },
  { name: 'Politics & Governance', description: 'Abia State government, elections, policy, and civic matters', icon: '🗳️', color: '#1a3a6b', is_popular: true, display_order: 3 },
  { name: 'Culture & Heritage', description: 'Igbo traditions, festivals, language, arts, and Abia history', icon: '🏛️', color: '#6b2d1a', is_popular: true, display_order: 4 },
  { name: 'Education & Career', description: 'Schools, scholarships, job opportunities, and professional development', icon: '📚', color: '#1a4a3a', is_popular: false, display_order: 5 },
  { name: 'Health & Wellness', description: 'Community health, hospitals, mental health, and wellness tips', icon: '❤️', color: '#8b1a1a', is_popular: false, display_order: 6 },
  { name: 'Agriculture & Farming', description: 'Crops, livestock, farm markets, agribusiness, and food production', icon: '🌿', color: '#2d5a1a', is_popular: false, display_order: 7 },
  { name: 'Technology & Innovation', description: 'Tech news, startups, digital skills, and innovation in Abia', icon: '💻', color: '#1a2d5a', is_popular: false, display_order: 8 },
  { name: 'Real Estate & Housing', description: 'Land, property, housing estates, construction, and rentals in Abia', icon: '🏠', color: '#4a2d1a', is_popular: false, display_order: 9 },
  { name: 'Entertainment & Lifestyle', description: 'Music, movies, sports, fashion, food, and Abia nightlife', icon: '🎭', color: '#4a1a5a', is_popular: false, display_order: 10 },
  { name: 'Diaspora Connect', description: 'For Abians living abroad — opportunities, support, and keeping home close', icon: '✈️', color: '#1a4a5a', is_popular: true, display_order: 11 },
  { name: 'Success Stories', description: 'Inspiring achievements, testimonials, and community wins from Abians', icon: '🏆', color: '#5a4a00', is_popular: true, display_order: 12 },
]

interface ThreadSeed {
  category: string
  title: string
  content: string
  tags: string[]
}

const THREADS: ThreadSeed[] = [
  // General Discussion
  { category: 'General Discussion', title: 'Welcome to AbiaConnect — Introduce Yourself Here! 👋', content: "<p>Welcome to AbiaConnect, the premier online community for Abia State indigenes and friends! This is a special thread where every new member should stop by and say hello.</p><p>Tell us: <strong>Which LGA are you from? Where do you live now? What brings you to AbiaConnect?</strong></p><p>Whether you're from Aba, Umuahia, Ohafia, Arochukwu, or anywhere across our great state — this is your home. Let's build something special together. 🦅</p>", tags: ['welcome', 'introduction', 'community'] },
  { category: 'General Discussion', title: 'Aba is rising — what businesses are booming right now in 2025?', content: "<p>I visited Aba last month after 3 years away and I couldn't believe the transformation. The Ariaria market has expanded, I saw new plazas on Ikot Ekpene road, and there were so many young entrepreneurs with shops.</p><p>What businesses are you seeing succeed in Aba right now? I'm considering moving back and want to understand the market.</p>", tags: ['aba', 'business', 'market', '2025'] },
  { category: 'General Discussion', title: 'Power supply in Umuahia — is it getting better or worse?', content: "<p>Let's have an honest conversation about electricity supply in Umuahia. The Enugu DisCo situation has been a source of frustration for years. I hear some areas now have 8-12 hours daily but others still get barely 2 hours.</p><p>Which areas in Umuahia are getting decent supply? And what are people doing — solar, generators, inverters?</p>", tags: ['umuahia', 'electricity', 'infrastructure', 'EEDC'] },
  // Business & Commerce
  { category: 'Business & Commerce', title: "Ariaria International Market — complete buyer's guide for new traders", content: '<p>After 15 years of trading at Ariaria, I want to share everything new traders need to know before their first visit.</p><p><strong>Key sections you should know:</strong></p><ul><li>Shoes & Leather Goods — Section D and E, best prices in West Africa</li><li>Clothing & Fabrics — Section A, negotiate hard</li><li>Electronics — Section G, verify everything before paying</li></ul><p>Most importantly: always come with a guide on your first visit. The market is massive and you will get lost. I offer free orientation for new traders — reply below.</p>', tags: ['ariaria', 'market', 'trading', 'guide', 'aba'] },
  { category: 'Business & Commerce', title: "Palm oil export opportunities from Abia — who's doing it successfully?", content: "<p>Abia State sits on some of the most fertile palm oil producing land in Nigeria. Yet most of our palm oil goes to middlemen at local prices instead of reaching international buyers directly.</p><p>I'm trying to build a cooperative of Abia farmers for direct export. Anyone with experience in agricultural export, NAFDAC certification, or international commodity trading please connect with me here.</p>", tags: ['palm oil', 'export', 'agriculture', 'cooperative', 'farmers'] },
  { category: 'Business & Commerce', title: 'How to register a business in Abia State — step by step (CAC + State)', content: "<p>Many people ask me about business registration so I'm making this the definitive guide for Abia State.</p><p><strong>Step 1: CAC Registration (Federal)</strong><br>Go to cac.gov.ng, choose Business Name or Limited Liability Company...</p><p><strong>Step 2: Abia State Business Permit</strong><br>Visit the Abia State Ministry of Commerce at Government House Road, Umuahia...</p><p>I'll update this thread as processes change. Ask your questions below.</p>", tags: ['business registration', 'CAC', 'entrepreneurship', 'guide'] },
  // Politics & Governance
  { category: 'Politics & Governance', title: "Governor Alex Otti's first year — honest community assessment", content: "<p>Now that we've had over a year to observe the current administration, let's have a mature, fact-based discussion about what has changed in Abia State.</p><p>I'll start: The road construction on Aba-Owerri expressway has visibly progressed. Teachers are now receiving salaries more consistently. But the pension crisis for retirees remains unresolved.</p><p>What have you seen in your LGA? Keep this respectful — facts and experiences only, no party insults.</p>", tags: ['governor', 'Abia government', 'politics', 'development', 'assessment'] },
  { category: 'Politics & Governance', title: 'Abia 2027 elections — which positions are you watching closely?', content: "<p>It's never too early to start paying attention. The 2027 governorship, National Assembly, and State House of Assembly elections will significantly shape Abia's future.</p><p>Which constituency races are already generating heat? Who are the early frontrunners you're hearing about? Which seat do you think will be the most contested?</p>", tags: ['election', '2027', 'politics', 'voting', 'INEC'] },
  // Culture & Heritage
  { category: 'Culture & Heritage', title: 'Ikeji Arochukwu Festival 2025 — date, events, and travel guide', content: "<p>The Ikeji festival in Arochukwu is one of the most spectacular cultural events in Igboland. If you've never attended, 2025 is the year to change that.</p><p>The festival typically holds in April and spans several days of masquerade displays, cultural dances, the famous Oracle procession, and community feasting.</p><p>I'll be coordinating a group trip from Lagos. Who wants to join? We'll share accommodation costs and travel in a convoy for safety and fun.</p>", tags: ['Ikeji', 'Arochukwu', 'festival', 'culture', 'tourism', '2025'] },
  { category: 'Culture & Heritage', title: "Teaching our children Igbo language — what's working for diaspora families?", content: "<p>My children were born in the UK. They understand some Igbo but can't speak it fluently and feel embarrassed trying. I know many Abia parents abroad face the same challenge.</p><p>What has actually worked for your family? Online tutors? Apps? Sending kids to Nigeria for summer? Speaking only Igbo at home?</p><p>Please share what's working and what isn't — this thread could genuinely help a lot of families.</p>", tags: ['Igbo language', 'diaspora', 'children', 'culture', 'parenting'] },
  // Education & Career
  { category: 'Education & Career', title: 'ABSU (Abia State University) 2025/2026 admissions — everything you need to know', content: '<p>For those preparing to apply to Abia State University Uturu, here is a consolidated guide based on the latest information.</p><p><strong>UTME cutoff:</strong> 160 (university choice), departmental cutoffs vary — Medicine is 240+, Law is 220+, Engineering is 200+</p><p><strong>Post-UTME:</strong> Usually held 6-8 weeks after UTME results. Check absu.edu.ng regularly.</p><p>Drop your questions below and current ABSU students please help answer!</p>', tags: ['ABSU', 'university', 'admission', 'UTME', 'education', '2025'] },
  { category: 'Education & Career', title: 'Scholarships available to Abia State indigenes in 2025 — master list', content: "<p>I've been compiling scholarship opportunities specifically for Abia State indigenes. Bookmarking this post will be one of the best things you do today.</p><p><strong>State Scholarships:</strong><br>- Abia State Scholarship Board — for indigenes in federal universities<br>- Oil Producing Areas: if your LGA qualifies, NDDC scholarships apply</p><p><strong>Federal:</strong><br>- PTDF scholarship for engineering and petroleum studies<br>- Federal Government Scholarship for postgraduate studies abroad</p><p><strong>International:</strong><br>- Commonwealth Scholarships (UK)<br>- Chevening Awards<br>Reply with any additions — let's make this the most complete list available.</p>", tags: ['scholarship', 'education', 'funding', 'students', '2025'] },
  // Diaspora Connect
  { category: 'Diaspora Connect', title: 'Abians in the UK — support network, meetups, and help for new arrivals', content: '<p>Whether you just arrived in the UK or have been here for years, this thread is your connection point with other Abians.</p><p>We have an informal WhatsApp community of over 400 Abians across London, Manchester, Birmingham, Leeds, and Edinburgh. We help with: accommodation hunting, NHS registration, driving licence conversion, job referrals, and general settling-in advice.</p><p>Reply with your city and I\'ll connect you with the local group coordinator.</p>', tags: ['UK', 'diaspora', 'London', 'community', 'immigration', 'support'] },
  { category: 'Diaspora Connect', title: 'Sending money home to Abia — best rates and safest methods in 2025', content: "<p>As someone who sends money home monthly, I've tested almost every remittance service. Here's my honest 2025 comparison for Nigeria transfers:</p><p><strong>Best rates right now:</strong> Lemfi and Grey consistently beat Wise and WorldRemit for NGN rates</p><p><strong>Speed:</strong> Chipper Cash is fastest (under 5 minutes usually)</p><p><strong>Large amounts:</strong> For transfers above $5,000, contact me privately — there are better OTC options</p><p>Share your experiences below — rates change weekly so crowd-sourcing helps us all.</p>", tags: ['remittance', 'money transfer', 'diaspora', 'UK', 'USA', 'Canada'] },
  // Success Stories
  { category: 'Success Stories', title: 'From Aba market trader to factory owner — my 12-year journey', content: '<p>I want to share my story because when I started in 2012, I had ₦50,000, a small table in Ariaria market, and a dream to manufacture the shoes I was selling.</p><p>Today I run a shoe factory in Aba with 23 staff. We supply 6 states in Nigeria and recently got our first export order to Ghana.</p><p>The journey was not smooth — I failed twice, borrowed money I couldn\'t repay, and almost quit in 2016. But the Aba spirit never let me give up.</p><p>If you are a young entrepreneur struggling, ask me anything. I am here.</p>', tags: ['success story', 'entrepreneurship', 'Aba', 'manufacturing', 'inspiration'] },
]

const SUBGROUPS = [
  { name: 'Aba Business Network', description: 'A private network for serious entrepreneurs, traders, and business owners in and around Aba. Share leads, partnerships, supplier contacts, and market intelligence.', category: 'Business', is_private: false },
  { name: 'Umuahia Young Professionals', description: 'For young professionals (25–40) based in or from Umuahia. Career growth, networking events, mentorship, and community projects.', category: 'Career', is_private: false },
  { name: 'Abia Tech Hub', description: 'Developers, designers, startup founders, and tech enthusiasts from Abia. Share projects, seek collaborators, discuss freelancing, and grow the Abia tech ecosystem.', category: 'Technology', is_private: false },
  { name: 'Abians in the UK 🇬🇧', description: 'Support network for Abia State indigenes living and working in the United Kingdom. From visa advice to job referrals, we look out for each other.', category: 'Diaspora', is_private: false },
  { name: 'Abians in North America 🇺🇸🇨🇦', description: 'Community for Abians in the USA and Canada. Meetups, immigration support, cultural events, and connecting with home.', category: 'Diaspora', is_private: false },
  { name: 'Abia Farmers Cooperative', description: 'Palm oil producers, cassava farmers, poultry farmers, and agripreneurs across Abia. Bulk buying, shared machinery, market prices, and export opportunities.', category: 'Agriculture', is_private: false },
  { name: 'Aba Shoe & Leather Makers Guild', description: 'The legendary shoe makers of Aba — share techniques, connect with suppliers, find buyers, and promote Aba-made leather goods to the world.', category: 'Business', is_private: false },
  { name: 'ABSU Alumni Network', description: 'Alumni of Abia State University Uturu. Reconnect with classmates, mentor current students, share job opportunities, and plan reunions.', category: 'Education', is_private: false },
  { name: 'Abia Women in Business', description: 'Empowering women entrepreneurs and professionals from Abia State. Mentorship, funding opportunities, collaboration, and celebrating female excellence.', category: 'Business', is_private: false },
  { name: 'Arochukwu Kingdom Discussion', description: 'For sons and daughters of the Aro kingdom. History, governance, culture, the Ibini Ukpabi Oracle heritage, diaspora connections, and community development.', category: 'Culture', is_private: false },
  { name: 'Abia Real Estate Investors', description: 'Property buyers, landlords, developers, and real estate agents operating in Abia State. Land deals, estate reviews, and investment opportunities.', category: 'Real Estate', is_private: true },
  { name: 'Aba FC & Abia Warriors Supporters Club', description: 'The official home for fans of Abia Warriors and all Abia football. Match day discussions, player news, and supporting the beautiful game in Abia.', category: 'Sports & Entertainment', is_private: false },
  { name: 'Abia Medical Professionals Network', description: 'For doctors, nurses, pharmacists, and healthcare workers from Abia. Continuing education, job postings, healthcare reform discussions, and professional support.', category: 'Health', is_private: false },
  { name: 'Ohafia Cultural Society', description: 'Celebrating the unique heritage, warrior tradition, and cultural identity of Ohafia people. For Ohafia indigenes at home and in the diaspora.', category: 'Culture', is_private: false },
  { name: 'Abia Mothers Network', description: 'A warm community for mothers in Abia State. Parenting tips, school reviews, child health, family life, and mutual support.', category: 'Family', is_private: false },
  { name: 'Abia State Investment Forum', description: 'For serious investors and those exploring opportunities in Abia. Real estate, agribusiness, manufacturing, and government tenders. Verified members only.', category: 'Business', is_private: true },
]

export interface SeedResult {
  success: true
  counts: { categories: number; threads: number; subgroups: number }
}

export async function seedDatabase(adminUserId: string): Promise<SeedResult> {
  if (!adminUserId) throw new Error('Admin user id is required')

  // 1. Upsert categories (onConflict: name)
  const catRows = CATEGORIES.map((c) => ({ ...c, slug: slugify(c.name) }))
  const { error: catErr } = await supabase
    .from('categories')
    .upsert(catRows, { onConflict: 'name' })
  if (catErr) throw new Error(`categories: ${catErr.message}`)

  // 2. Fetch category id map
  const { data: catData, error: catFetchErr } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', CATEGORIES.map((c) => c.name))
  if (catFetchErr) throw new Error(`category lookup: ${catFetchErr.message}`)
  const catIdByName = new Map<string, string>((catData ?? []).map((r: any) => [r.name, r.id]))

  // 3. Threads — staggered created_at over last 30 days
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  // Skip already-seeded titles to keep this safely re-runnable
  const { data: existing } = await supabase
    .from('threads')
    .select('title')
    .in('title', THREADS.map((t) => t.title))
  const existingTitles = new Set((existing ?? []).map((r: any) => r.title))

  const threadRows = THREADS.filter((t) => !existingTitles.has(t.title)).map((t) => {
    const created = new Date(now - Math.random() * 30 * day).toISOString()
    return {
      category_id: catIdByName.get(t.category) ?? null,
      user_id: adminUserId,
      title: t.title,
      content: t.content,
      tags: t.tags,
      allow_replies: true,
      is_anonymous: false,
      created_at: created,
      updated_at: created,
    }
  })

  let threadCount = 0
  if (threadRows.length) {
    const { error: thErr, count } = await supabase
      .from('threads')
      .insert(threadRows, { count: 'exact' })
    if (thErr) throw new Error(`threads: ${thErr.message}`)
    threadCount = count ?? threadRows.length
  }

  // 4. Subgroups (onConflict: name) — staggered over last 60 days
  const subRows = SUBGROUPS.map((s) => {
    const created = new Date(now - Math.random() * 60 * day).toISOString()
    return {
      ...s,
      cover_image_url: null,
      is_active: true,
      created_by: adminUserId,
      created_at: created,
      updated_at: created,
    }
  })
  const { error: sgErr } = await supabase
    .from('subgroups')
    .upsert(subRows, { onConflict: 'name' })
  if (sgErr) throw new Error(`subgroups: ${sgErr.message}`)

  return {
    success: true,
    counts: {
      categories: CATEGORIES.length,
      threads: threadCount,
      subgroups: SUBGROUPS.length,
    },
  }
}
