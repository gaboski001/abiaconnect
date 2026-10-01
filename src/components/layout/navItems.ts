import {
  BarChart3,
  Gift,
  HandHeart,
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
  const { settings } = useSiteSettings()
  const subgroupsEnabled = settings.global_subgroups_enabled !== 'false'
  const storeLink = settings.store_link

  const primary: NavItem[] = [
    { label: 'Forums', to: '/', icon: MessagesSquare, end: true },
    ...(subgroupsEnabled ? [{ label: 'Subgroups', to: '/subgroups', icon: Users }] : []),
    { label: 'Polls', to: '/polls', icon: BarChart3 },
    { label: 'Contests', to: '/contests', icon: Vote },
  ]

  const community: NavItem[] = [
    { label: 'About Us', to: '/about', icon: Info },
    ...(storeLink ? [{ label: 'Store', to: storeLink, icon: ShoppingBag, external: true }] : []),
    { label: 'Donate', to: '/donate', icon: HandHeart, highlight: true },
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
        { label: 'Donations', to: '/admin/donations', icon: Wallet },
      ]
    : []

  const sections: NavSection[] = [
    { title: 'Explore', items: primary },
    { title: 'Community', items: community },
    ...(account.length ? [{ title: 'Account', items: account }] : []),
    ...(admin.length ? [{ title: 'Admin', items: admin }] : []),
  ]

  return { primary, community, account, admin, sections }
}

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.external) return false
  return !!matchPath({ path: item.to, end: item.end ?? false }, pathname)
}
