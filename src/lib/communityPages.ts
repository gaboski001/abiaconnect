import { supabase } from '@/lib/supabase'

/**
 * Success stories, Member of the Month and events: members send them in, the
 * team reviews them, and only published ones show. Database side:
 * supabase/migrations/20261109090000_volunteer_team_and_community_pages.sql.
 */

// These functions arrived after the generated database types.
const sb = supabase as any

export const STORY_TAGS = ['Business', 'Education', 'Community', 'Health', 'Sports', 'Arts', 'Diaspora', 'Other'] as const
export type StoryTag = (typeof STORY_TAGS)[number]

export const ABIA_LGAS = [
  'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato',
  'Obi Ngwa', 'Ohafia', 'Osisioma Ngwa', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South',
  'Umu Nneochi',
]

export interface Story {
  id: string
  title: string
  story: string
  tag: StoryTag
  person_name: string | null
  published_at: string
}

export interface Spotlight {
  id: string
  member_id: string
  display_name: string
  username: string | null
  avatar_url: string | null
  lga: string | null
  member_since: string | null
  month: string
  headline: string
  about: string
  quote: string | null
}

export interface CommunityEvent {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string | null
  place: string | null
  online_link: string | null
  lga: string | null
  organiser_name: string | null
}

export interface MySubmission {
  kind: 'story' | 'event' | 'nomination'
  id: string
  title: string
  status: string
  review_note: string | null
  created_at: string
}

/** Lists fall back to empty before the database update runs, so the pages never break. */
async function list<T>(fn: string, args?: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await sb.rpc(fn, args)
  if (error) {
    if (/does not exist|Could not find the function/i.test(error.message ?? '')) return []
    throw new Error('Could not load this page. Please try again.')
  }
  return (data ?? []) as T[]
}

export const fetchStories = () => list<Story>('list_success_stories', { _limit: 50 })
export const fetchSpotlights = () => list<Spotlight>('list_member_spotlights')
export const fetchEvents = () => list<CommunityEvent>('list_upcoming_events')
export const fetchMySubmissions = () => list<MySubmission>('my_community_submissions')

async function call(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(communityError(error))
  return data
}

export const submitStory = (v: { title: string; story: string; tag: StoryTag; person?: string }) =>
  call('submit_success_story', { _title: v.title, _story: v.story, _tag: v.tag, _person: v.person || null })

export const submitNomination = (v: { username: string; reason: string }) =>
  call('submit_spotlight_nomination', { _username: v.username, _reason: v.reason })

export const submitEvent = (v: {
  title: string
  description: string
  starts: Date
  ends?: Date | null
  place?: string
  link?: string
  lga?: string
}) =>
  call('submit_community_event', {
    _title: v.title,
    _description: v.description,
    _starts: v.starts.toISOString(),
    _ends: v.ends ? v.ends.toISOString() : null,
    _place: v.place || null,
    _link: v.link || null,
    _lga: v.lga || null,
  })

// ---- Team review ----

export interface ReviewQueue {
  stories: Array<{
    id: string
    title: string
    story: string
    tag: string
    person_name: string | null
    status: 'pending' | 'published'
    created_at: string
    submitter: string | null
  }>
  events: Array<{
    id: string
    title: string
    description: string
    starts_at: string
    ends_at: string | null
    place: string | null
    online_link: string | null
    lga: string | null
    status: 'pending' | 'published'
    created_at: string
    submitter: string | null
  }>
  nominations: Array<{
    id: string
    reason: string
    created_at: string
    nominee_id: string
    nominee: string | null
    nominee_username: string | null
    nominator: string | null
  }>
  spotlights: Array<{ id: string; month: string; headline: string; member: string | null }>
}

export async function fetchReviewQueue(): Promise<ReviewQueue> {
  return (await call('community_review_queue', {})) as ReviewQueue
}

export const reviewItem = (kind: 'story' | 'event' | 'nomination', id: string, decision: 'publish' | 'decline' | 'remove' | 'dismiss', note?: string) =>
  call('review_community_item', { _kind: kind, _id: id, _decision: decision, _note: note || null })

export const publishSpotlight = (v: { member: string; headline: string; about: string; quote?: string; nomination?: string | null }) =>
  call('publish_member_spotlight', {
    _member: v.member,
    _headline: v.headline,
    _about: v.about,
    _quote: v.quote || null,
    _nomination: v.nomination ?? null,
  })

export const removeSpotlight = (id: string) => call('remove_member_spotlight', { _id: id })

/** How many things are waiting for the team (for badges). */
export function waitingCount(q: ReviewQueue | undefined): number {
  if (!q) return 0
  return q.stories.filter((s) => s.status === 'pending').length + q.events.filter((e) => e.status === 'pending').length + q.nominations.length
}

const MESSAGES: Record<string, string> = {
  sign_in: 'Please sign in first.',
  not_allowed: 'You cannot do this.',
  too_many_waiting: 'You already have several waiting for review. Please wait until the team has looked at them.',
  title_invalid: 'Please give it a title of at least 8 characters.',
  story_invalid: 'Please tell the story in at least 80 characters.',
  tag_invalid: 'Please choose a topic.',
  member_not_found: 'We could not find a member with that username. Check the spelling on their profile.',
  not_yourself: 'You cannot nominate yourself, but a friend can!',
  reason_invalid: 'Please say why in at least 30 characters.',
  already_nominated: 'You have already nominated this member. The team will look at it soon.',
  description_invalid: 'Please describe the event in at least 20 characters.',
  date_invalid: 'Please choose a date in the next 12 months.',
  end_invalid: 'The end time must be after the start time.',
  link_invalid: 'The online link must start with https://',
  place_missing: 'Please say where it happens, or add an online link.',
  headline_invalid: 'Please write a headline of at least 10 characters.',
  about_invalid: 'Please write at least 40 characters about them.',
  decision_invalid: 'This has already been dealt with.',
  not_found: 'This no longer exists.',
}

export function communityError(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? ''
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k))
  return key ? MESSAGES[key] : 'Something went wrong. Please try again.'
}
