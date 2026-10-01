import { matchPath } from 'react-router-dom'

/** Bottom-tab destinations: shown with a large title and no back button. */
export const TAB_ROOTS: Record<string, string> = {
  '/subgroups': 'Community',
  '/messages': 'Messages',
  '/relationship': 'Connect',
}

/**
 * App-bar titles for inner screens (the app shows a back button + this title).
 * Order matters: more specific patterns first.
 */
const TITLES: Array<[string, string]> = [
  ['/thread/:id', 'Discussion'],
  ['/category/:id', 'Topic'],
  ['/create-thread', 'New discussion'],
  ['/subgroups/invite/:token', 'Group invite'],
  ['/subgroups/:id', 'Group'],
  ['/relationship/edit', 'Connect profile'],
  ['/relationship/likes', 'Requests'],
  ['/relationship/premium', 'Membership'],
  ['/relationship/payment/callback', 'Payment'],
  ['/relationship/:userId', 'Member profile'],
  ['/notifications', 'Notifications'],
  ['/profile', 'My profile'],
  ['/dashboard', 'Dashboard'],
  ['/polls', 'Polls'],
  ['/search', 'Search'],
  ['/rewards', 'My rewards'],
  ['/leaderboard', 'Leaderboard'],
  ['/contests/new', 'New contest'],
  ['/contests/:id', 'Contest'],
  ['/contests', 'Contests & elections'],
  ['/events', 'Events'],
  ['/donate', 'Donate'],
  ['/settings/devices', 'Devices & security'],
  ['/version', 'App version'],
  ['/download', 'Get the app'],
  ['/about/lgas', 'The 17 LGAs'],
  ['/about/known-for', 'Abia is known for'],
  ['/about/absu', 'ABSU'],
  ['/about', 'About'],
  ['/mission', 'Our mission'],
  ['/team', 'Our team'],
  ['/careers', 'Careers'],
  ['/success-stories', 'Success stories'],
  ['/member-spotlight', 'Member spotlight'],
  ['/help', 'Help centre'],
  ['/report-issue', 'Report a problem'],
  ['/forum-guidelines', 'Forum guidelines'],
  ['/community-standards', 'Community standards'],
  ['/privacy-policy', 'Privacy policy'],
  ['/terms-of-service', 'Terms of service'],
  ['/cookie-policy', 'Cookie policy'],
  ['/unsubscribe', 'Email preferences'],
  ['/reset-password', 'Reset password'],
  ['/admin/dashboard', 'Admin'],
  ['/admin/moderation', 'Moderation'],
  ['/admin/donations', 'Donations'],
  ['/admin/email-dns', 'Email setup'],
  ['/admin/birthday-preview', 'Birthday emails'],
]

export type NativeScreen =
  | { kind: 'home' }
  | { kind: 'tab'; title: string }
  | { kind: 'inner'; title: string }

export function nativeScreenFor(pathname: string): NativeScreen {
  if (pathname === '/') return { kind: 'home' }
  const tab = TAB_ROOTS[pathname.replace(/\/+$/, '')]
  if (tab) return { kind: 'tab', title: tab }
  for (const [pattern, title] of TITLES) {
    if (matchPath({ path: pattern, end: true }, pathname)) return { kind: 'inner', title }
  }
  return { kind: 'inner', title: 'AbiaConnect' }
}
