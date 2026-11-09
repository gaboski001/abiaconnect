/**
 * Website pages that work like an app screen: chats, live rooms, groups,
 * polls, contests, Connect, post forms and personal dashboards. They hide the
 * site footer so the screen ends where the tool ends, instead of a long page
 * that pushes forms and chat boxes up and buries what matters. Information
 * pages (home, about, help, policies, careers) keep the footer and its links.
 */
const APP_PAGES = [
  /^\/messages(\/|$)/,
  /^\/live(\/|$)/,
  /^\/polls(\/|$)/,
  /^\/contests(\/|$)/,
  /^\/subgroups(\/|$)/,
  /^\/relationship(\/|$)/,
  /^\/create-thread(\/|$)/,
  /^\/thread\//,
  /^\/category\//,
  /^\/events(\/|$)/,
  /^\/opportunities(\/|$)/,
  /^\/search(\/|$)/,
  /^\/member\//,
  /^\/profile(\/|$)/,
  /^\/dashboard(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/rewards(\/|$)/,
  /^\/leaderboard(\/|$)/,
  /^\/moderate(\/|$)/,
  /^\/admin(\/|$)/,
]

export function isAppPage(pathname: string): boolean {
  return APP_PAGES.some((re) => re.test(pathname))
}
