/**
 * Ready-made contests for the things Abian communities already vote on:
 * town union and association elections, age grades, women's and youth wings,
 * and community awards. Picking one fills in the form; everything can be edited.
 */

export interface ContestTemplate {
  id: string
  name: string
  hint: string
  title: string
  description: string
  resultsVisibility: 'live' | 'after_close'
  /** Days voting stays open. */
  days: number
  positions: Array<{ title: string; max_choices: number }>
}

const EXEC_RULES =
  'One secret ballot covers every position. Only members who were already in the group when this election was created can vote, so the result truly belongs to our members. Voting closes at the time shown, and results are announced to everyone straight away.'

const AWARD_RULES =
  'Vote for the nominee you think deserves it most. Your vote is secret. The winner is announced to the group when voting closes.'

export const CONTEST_TEMPLATES: ContestTemplate[] = [
  {
    id: 'union-exec',
    name: 'Town union or association election',
    hint: 'President, Vice, Secretary, Treasurer and more, on one ballot',
    title: 'Executive Election',
    description: EXEC_RULES,
    resultsVisibility: 'after_close',
    days: 3,
    positions: [
      { title: 'President / Chairman', max_choices: 1 },
      { title: 'Vice President', max_choices: 1 },
      { title: 'Secretary', max_choices: 1 },
      { title: 'Financial Secretary', max_choices: 1 },
      { title: 'Treasurer', max_choices: 1 },
      { title: 'Public Relations Officer', max_choices: 1 },
    ],
  },
  {
    id: 'wing-leaders',
    name: 'Women’s wing, youth wing or age grade leaders',
    hint: 'Leader, assistant and secretary',
    title: 'Leadership Election',
    description: EXEC_RULES,
    resultsVisibility: 'after_close',
    days: 3,
    positions: [
      { title: 'Leader', max_choices: 1 },
      { title: 'Assistant Leader', max_choices: 1 },
      { title: 'Secretary', max_choices: 1 },
    ],
  },
  {
    id: 'committee',
    name: 'Committee members',
    hint: 'Members vote for several people at once',
    title: 'Committee Election',
    description: EXEC_RULES,
    resultsVisibility: 'after_close',
    days: 3,
    positions: [{ title: 'Committee members', max_choices: 3 }],
  },
  {
    id: 'business-award',
    name: 'Business of the Year',
    hint: 'Celebrate a business from your Local Government Area',
    title: 'Business of the Year',
    description: AWARD_RULES,
    resultsVisibility: 'live',
    days: 7,
    positions: [{ title: 'Nominees', max_choices: 1 }],
  },
  {
    id: 'diaspora-award',
    name: 'Diaspora Abian of the Year',
    hint: 'Honour an Abian abroad who gives back to home',
    title: 'Diaspora Abian of the Year',
    description: AWARD_RULES,
    resultsVisibility: 'live',
    days: 7,
    positions: [{ title: 'Nominees', max_choices: 1 }],
  },
  {
    id: 'project-choice',
    name: 'Choose our next community project',
    hint: 'Borehole, school repairs, scholarships, roads…',
    title: 'Our Next Community Project',
    description: 'Which project should our community do next? Vote for the one that will help the most people. Your vote is secret.',
    resultsVisibility: 'live',
    days: 7,
    positions: [{ title: 'Projects', max_choices: 1 }],
  },
  {
    id: 'member-month',
    name: 'Member of the Month',
    hint: 'Let the group pick its most helpful member',
    title: 'Member of the Month',
    description: AWARD_RULES,
    resultsVisibility: 'live',
    days: 5,
    positions: [{ title: 'Nominees', max_choices: 1 }],
  },
]
