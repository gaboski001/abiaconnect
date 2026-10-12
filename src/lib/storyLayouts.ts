/**
 * Ready-made outlines for the thread composer, so a member can write a post
 * with the same tidy shape as a Newsdesk update: an opening line, a few short
 * sections, then a question for readers.
 *
 * A layout only puts headings into the editor. The grey guide text under each
 * heading is shown by the editor while the line is empty and is never saved.
 */

export interface StorySection {
  heading: string
  /** Guide text shown under the heading until the member starts typing. */
  hint: string
}

export interface StoryLayout {
  id: string
  name: string
  /** One line telling the member when to pick this layout. */
  summary: string
  /** Guide text for the opening line, above the first heading. */
  opening: string
  sections: StorySection[]
}

export const STORY_LAYOUTS: StoryLayout[] = [
  {
    id: 'news',
    name: 'News update',
    summary: 'Something that happened in Abia that people should know about.',
    opening: 'Start with the main point in one or two sentences: what happened, where and when.',
    sections: [
      { heading: 'The details', hint: 'Give the facts in short paragraphs: who was involved, the numbers, what was said.' },
      { heading: 'Why it matters', hint: 'Say what this means for people in the area or in Abia State.' },
      { heading: 'Over to you', hint: 'Ask readers one or two questions to start the discussion.' },
      { heading: 'Source', hint: 'Say where you got it: paste the link, or write "I was there" if you saw it yourself.' },
    ],
  },
  {
    id: 'question',
    name: 'Question',
    summary: 'You need an answer, advice or a recommendation.',
    opening: 'Ask your question in one clear sentence.',
    sections: [
      { heading: 'Background', hint: 'Explain the situation so people understand what you are asking.' },
      { heading: 'What I have tried', hint: 'Say what you have already done or found out, if anything.' },
      { heading: 'What I need', hint: 'Say the kind of answer that would help: a contact, a price, steps to follow.' },
    ],
  },
  {
    id: 'event',
    name: 'Event or announcement',
    summary: 'A meeting, programme, celebration or public notice.',
    opening: 'Say what is happening in one or two sentences.',
    sections: [
      { heading: 'Date and time', hint: 'Give the day, the date and the time.' },
      { heading: 'Venue', hint: 'Give the full address and a landmark that helps people find it.' },
      { heading: 'Who it is for', hint: 'Say who should come, and whether it is free or paid.' },
      { heading: 'How to take part', hint: 'Say how to register or who to contact.' },
    ],
  },
  {
    id: 'offer',
    name: 'Business or opportunity',
    summary: 'A product, a service, a job, a scholarship or a grant.',
    opening: 'Say what you are offering or what the opportunity is, in one or two sentences.',
    sections: [
      { heading: 'What is on offer', hint: 'Describe it plainly, with the price or the benefit.' },
      { heading: 'Who can benefit', hint: 'Say who can buy or apply, and the location.' },
      { heading: 'How to get it', hint: 'Give the steps, the contact and any closing date.' },
    ],
  },
  {
    id: 'opinion',
    name: 'Opinion',
    summary: 'Your view on an issue, with your reasons.',
    opening: 'State your view in one or two sentences.',
    sections: [
      { heading: 'My reasons', hint: 'Give your strongest reasons, one short paragraph each.' },
      { heading: 'The other side', hint: 'Mention what people who disagree might say, fairly.' },
      { heading: 'Over to you', hint: 'Ask readers one or two questions to start the discussion.' },
    ],
  },
]

export const OPENING_HINT = 'Start with your main point in one or two sentences.'

const HINTS = new Map<string, string>(
  STORY_LAYOUTS.flatMap((l) => l.sections.map((s) => [s.heading.toLowerCase(), s.hint] as [string, string])),
)

/** The guide text for an empty line that sits under the given heading. */
export function hintForHeading(heading: string): string {
  return HINTS.get(heading.trim().toLowerCase()) ?? ''
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The headings of a layout, each followed by an empty line to write in. */
export function layoutHtml(layout: StoryLayout): string {
  return ['<p></p>', ...layout.sections.map((s) => `<h3>${escapeHtml(s.heading)}</h3><p></p>`)].join('')
}

function isBlank(el: Element): boolean {
  return el.tagName === 'P' && !el.textContent?.trim() && !el.querySelector('img')
}

/**
 * Headings that have nothing written under them. A heading directly followed
 * by a smaller heading is fine; one followed by the end of the post, or by
 * another heading of the same size, is an unfinished section.
 */
export function emptySections(html: string): string[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  const blocks = Array.from(body.children).filter((el) => !isBlank(el))
  const level = (el: Element) => (/^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : 0)
  const out: string[] = []
  blocks.forEach((el, i) => {
    const mine = level(el)
    if (!mine) return
    const next = blocks[i + 1]
    const nextLevel = next ? level(next) : 0
    if (!next || (nextLevel && nextLevel <= mine)) out.push(el.textContent?.trim() || 'Untitled heading')
  })
  return out
}

/** Word count and reading time (200 words a minute, at least 1 minute). */
export function readingStats(text: string): { words: number; minutes: number } {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return { words, minutes: Math.max(1, Math.round(words / 200)) }
}
