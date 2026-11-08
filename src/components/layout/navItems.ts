import {
  BarChart3,
  Flag,
  Gift,
  HandHeart,
  Handshake,
  Info,
  LayoutDashboard,
  MessagesSquare,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Users,
  Trophy,
  Vote,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { matchPath } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { canDonateHere } from '@/lib/storePolicy'
import { isNewcomer, useJourney } from '@/lib/journey'
import { useVolunteerPowers } from '@/lib/volunteerTeam'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Opens in a new tab (e.g. the store). */
  external?: boolean
  /** Only exact path counts as active (used for "/"). */
  end?: boolean
  /** Visually highlighted call to action. */
  highlight?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

/**
 * Single source of truth for the site navigation, shared by the desktop
 * header, the tablet drawer and the mobile drawer.
 */
export function useNavSections() {
  const { user, role, isAdmin } = useAuth()
  const powers = useVolunteerPowers().data
  const { settings } = useSiteSettings()
  const subgroupsEnabled = settings.global_subgroups_enabled !== 'false'
  const storeLink = settings.store_link
  // In their first week, new members see a shorter menu; the rest is under Community.
  const journey = useJourney()
  const simple = isNewcomer(journey.data)
  const later: NavItem[] = [{ label: 'Contests', to: '/contests', icon: Vote }]

  const primary: NavItem[] = [
    { label: 'Forums', to: '/', icon: MessagesSquare, end: true },
    ...(subgroupsEnabled ? [{ label: 'Groups', to: '/subgroups', icon: Users }] : []),
    { label: 'Polls', to: '/polls', icon: BarChart3 },
    ...(simple ? [] : later),
  ]

  const community: NavItem[] = [
    ...(simple ? later : []),
    { label: 'About Us', to: '/about', icon: Info },
  ]

  // Kept out of the main bar so the forum comes across as the heart of the site.
  const more: NavItem[] = [
    { label: 'Connect', to: '/relationship', icon: Handshake },
    ...(storeLink ? [{ label: 'Store', to: storeLink, icon: ShoppingBag, external: true }] : []),
    ...(canDonateHere() ? [{ label: 'Donate', to: '/donate', icon: HandHeart, highlight: true }] : []),
  ]

  const account: NavItem[] = user
    ? [
        ...(role !== 'guest' ? [{ label: 'My Dashboard', to: '/dashboard', icon: LayoutDashboard }] : []),
        { label: 'My Profile', to: '/profile', icon: UserRound },
        { label: 'My Rewards', to: '/rewards', icon: Gift },
        { label: 'Leaderboard', to: '/leaderboard', icon: Trophy },
      ]
    : []

  const admin: NavItem[] = isAdmin
    ? [
        { label: 'Admin Portal', to: '/admin/dashboard', icon: ShieldCheck },
        { label: 'Moderator tools', to: '/moderate', icon: Flag },
        { label: 'Donations', to: '/admin/donations', icon: Wallet },
      ]
    : powers?.moderate || powers?.review
      ? [{ label: 'Moderator tools', to: '/moderate', icon: Flag }]
      : []

  const sections: NavSection[] = [
    { title: 'Explore', items: primary },
    { title: 'Community', items: community },
    { title: 'More', items: more },
    ...(account.length ? [{ title: 'Account', items: account }] : []),
    ...(admin.length ? [{ title: isAdmin ? 'Admin' : 'Volunteer team', items: admin }] : []),
  ]

  return { primary, community, more, account, admin, sections }
}

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.external) return false
  return !!matchPath({ path: item.to, end: item.end ?? false }, pathname)
}
