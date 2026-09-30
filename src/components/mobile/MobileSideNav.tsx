import { SiteNavDrawer } from '@/components/layout/SiteNavDrawer'

/**
 * Mobile left-side drawer. Shares the same drawer as the tablet Navbar menu
 * (branded header, search, grouped sections, account footer).
 */
export function MobileSideNav() {
  return <SiteNavDrawer triggerClassName="md:hidden" />
}

export default MobileSideNav
