import { HELP_SECTIONS, type QA } from '@/lib/helpCentre'

/**
 * Finds the Help Centre answers that best fit a member's question, in their
 * own words. No AI: it compares words (allowing for everyday alternatives
 * like "pic" for "picture"), so it only ever repeats what the Help Centre says.
 */

const STOP = new Set(
  'a an the i me my we our you your it its is are am was be been do does did can could will would should how what why when where who which to of in on for at by with from and or but if so this that there here about into please just get got have has not no yes any some one want need like up someone somebody anyone thing'.split(
    ' ',
  ),
)

// Everyday words members use, mapped to the words the Help Centre uses.
const SAME: Record<string, string> = {
  signup: 'register', join: 'register', registration: 'register', create: 'register', open: 'register',
  login: 'signin', sign: 'signin', log: 'signin',
  pic: 'picture', photo: 'picture', image: 'picture', avatar: 'picture', dp: 'picture',
  remove: 'delete', close: 'delete', deactivate: 'delete',
  name: 'username', handle: 'username',
  email: 'email', mail: 'email', verify: 'verification', confirm: 'verification', verified: 'verification',
  post: 'post', thread: 'thread', discussion: 'thread', topic: 'thread',
  flag: 'report', complain: 'report', complaint: 'report',
  bully: 'harass', bullying: 'harass', harassment: 'harass', insult: 'harass', abuse: 'harass',
  block: 'block', ban: 'ban', banned: 'ban',
  hidden: 'hidden', hide: 'hidden', removed: 'hidden', disappeared: 'hidden', missing: 'hidden',
  volunteering: 'volunteer', volunteers: 'volunteer', moderator: 'moderator', mod: 'moderator', moderators: 'moderator',
  story: 'story', stories: 'story', success: 'story',
  nominate: 'nominate', nomination: 'nominate', spotlight: 'month', motm: 'month',
  event: 'event', events: 'event', meeting: 'event', gathering: 'event', calendar: 'calendar',
  indigene: 'abia', state: 'abia',
  election: 'election', elections: 'election', elect: 'election', vote: 'vote', voting: 'vote', voted: 'vote', votes: 'vote', ballot: 'vote',
  contest: 'contest', contests: 'contest', award: 'contest', awards: 'contest', poll: 'poll', polls: 'poll',
  secret: 'secret', anonymous: 'secret', code: 'code', codes: 'code', result: 'result', results: 'result', winner: 'result', won: 'result',
}

function stem(w: string): string {
  if (SAME[w]) return SAME[w]
  for (const end of ['ing', 'ed', 'es', 's']) {
    if (w.length > end.length + 3 && w.endsWith(end)) {
      const base = w.slice(0, -end.length)
      return SAME[base] ?? base
    }
  }
  return w
}

// Phrases that mean one thing.
const PHRASES: Array<[RegExp, string]> = [
  [/\bsign(ed|ing)? ?up\b/g, 'register'],
  [/\b(sign|log)(ged|ging)? ?(in|on)\b/g, 'signin'],
  [/\bmember of the month\b/g, 'month'],
  [/\bprofile (pic|picture|photo|image)\b/g, 'picture'],
]

export function words(text: string): string[] {
  let t = text.toLowerCase().replace(/[’']/g, '')
  for (const [re, to] of PHRASES) t = t.replace(re, to)
  return t
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem)
}

export interface Match {
  item: QA
  section: string
  score: number
}

const INDEX = HELP_SECTIONS.flatMap((s) =>
  s.items.map((item) => ({ item, section: s.title, q: new Set(words(item.q)), a: new Set(words(item.a)) })),
)

/** The best answers for a question, most likely first. Empty when nothing fits well. */
export function findAnswers(question: string, limit = 3): Match[] {
  const asked = [...new Set(words(question))]
  if (!asked.length) return []
  return INDEX.map(({ item, section, q, a }) => {
    let score = 0
    let inQuestion = 0
    for (const w of asked) {
      if (q.has(w)) {
        score += 3
        inQuestion++
      } else if (a.has(w)) score += 1
    }
    // A short question that matches a Help question closely should win.
    if (inQuestion && inQuestion === asked.length) score += 2
    return { item, section, score, inQuestion }
  })
    .filter((m) => m.inQuestion > 0 && m.score >= 3)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map(({ item, section, score }) => ({ item, section, score }))
}

export type Intent = 'hello' | 'thanks' | 'human' | null

/** Small talk the chat answers without the Help Centre. */
export function intentOf(text: string): Intent {
  const t = text.toLowerCase().trim()
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|ndewo|kedu)\b[!. ]*$/.test(t)) return 'hello'
  if (/^(thanks|thank you|ok thanks|okay|ok|great|daalu|dalu)\b/.test(t)) return 'thanks'
  if (/\b(human|real person|agent|someone|staff|admin|contact us|contact you|call you|talk to|speak to|customer (care|service))\b/.test(t)) return 'human'
  return null
}
