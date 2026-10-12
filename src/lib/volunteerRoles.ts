/**
 * The volunteer roles on the application form (page /volunteer) and the extra
 * questions each role asks. The role `id` is what the database stores; the
 * questions are saved with the answers, so an old application still reads
 * correctly after the wording here changes.
 */

export interface VolunteerQuestion {
  question: string
  /** Example or guidance shown inside the empty answer box. */
  hint: string
}

export interface VolunteerRole {
  id: 'moderator' | 'writer' | 'social' | 'developer' | 'connector' | 'other'
  name: string
  /** One line telling the applicant what the role does. */
  summary: string
  questions: VolunteerQuestion[]
}

export const VOLUNTEER_ROLES: VolunteerRole[] = [
  {
    id: 'moderator',
    name: 'Community Moderator',
    summary: 'Keep discussions safe and respectful: review reports and guide members.',
    questions: [
      {
        question: 'Have you moderated a group or community before?',
        hint: 'For example a WhatsApp group, a Facebook group or a forum. Say how big it was and what you did.',
      },
      {
        question: 'A member insults people from another LGA in a heated thread. What would you do?',
        hint: 'Describe the steps you would take, in order.',
      },
      {
        question: 'Which days and times can you usually be online?',
        hint: 'For example: weekday evenings from 7 pm, and Saturday mornings.',
      },
    ],
  },
  {
    id: 'writer',
    name: 'Content Writer',
    summary: 'Write news summaries, member spotlights and stories about Abia State.',
    questions: [
      {
        question: 'Which topics about Abia State would you most like to write about?',
        hint: 'For example: business in Aba, education, culture, sport, local government.',
      },
      {
        question: 'Share a sample of your writing.',
        hint: 'Paste a link to something you have published, or write a short sample of 100 to 200 words here.',
      },
      {
        question: 'How do you check that a story is true before you publish it?',
        hint: 'Say where you look and who you ask.',
      },
    ],
  },
  {
    id: 'social',
    name: 'Social Media Coordinator',
    summary: 'Run our Facebook, Instagram and X pages and bring new members in.',
    questions: [
      {
        question: 'Which platforms do you know best?',
        hint: 'For example: Facebook, Instagram, X, TikTok, WhatsApp channels.',
      },
      {
        question: 'Which pages or accounts have you managed?',
        hint: 'Give the links and say how they grew while you managed them.',
      },
      {
        question: 'Give one idea for a post or campaign that would bring new members to AbiaConnect.',
        hint: 'A few sentences is enough.',
      },
    ],
  },
  {
    id: 'developer',
    name: 'Developer',
    summary: 'Help build and improve the website and the mobile app.',
    questions: [
      {
        question: 'Which technologies do you work with?',
        hint: 'For example: React, TypeScript, Tailwind CSS, PostgreSQL, Android.',
      },
      {
        question: 'Where can we see your work?',
        hint: 'A link to your GitHub profile, portfolio or a live project.',
      },
      {
        question: 'Describe one project you built and your part in it.',
        hint: 'Say what it does, who used it and what you did yourself.',
      },
    ],
  },
  {
    id: 'connector',
    name: 'Community Connector',
    summary: 'Link AbiaConnect with schools, businesses, town unions and organisations.',
    questions: [
      {
        question: 'Which groups or organisations could you connect us with?',
        hint: 'For example: a town union, a student association, a market association, a church group, a company.',
      },
      {
        question: 'Have you organised an event or built a partnership before?',
        hint: 'Describe one and what came out of it.',
      },
      {
        question: 'Which area can you cover in person?',
        hint: 'For example: Umuahia and nearby LGAs, Aba, Lagos, London.',
      },
    ],
  },
  {
    id: 'other',
    name: 'Another way to help',
    summary: 'You have a skill that is not listed here.',
    questions: [
      {
        question: 'How would you like to help AbiaConnect?',
        hint: 'Describe the skill you offer and what you would do with it.',
      },
    ],
  },
]

export const HOURS_OPTIONS = ['1 to 2 hours a week', '3 to 5 hours a week', '6 to 10 hours a week', 'More than 10 hours a week']

export function volunteerRole(id: string | null | undefined): VolunteerRole | undefined {
  return VOLUNTEER_ROLES.find((r) => r.id === id)
}

/** The role name for lists and emails; unknown ids are shown as they are. */
export function volunteerRoleName(id: string): string {
  return volunteerRole(id)?.name ?? id
}
