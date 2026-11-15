// Build-time only (scripts/prerender-pages.ts): renders the public information
// pages to HTML with the same components visitors see, so search engines and
// link previews get the real text instead of an empty page. Never imported by
// the app itself.
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'

import About from '@/pages/static/About'
import Careers from '@/pages/static/Careers'
import CommunityStandards from '@/pages/static/CommunityStandards'
import CookiePolicy from '@/pages/static/CookiePolicy'
import Events from '@/pages/static/Events'
import ForumGuidelines from '@/pages/static/ForumGuidelines'
import Help from '@/pages/static/Help'
import MemberSpotlight from '@/pages/static/MemberSpotlight'
import Mission from '@/pages/static/Mission'
import PrivacyPolicy from '@/pages/static/PrivacyPolicy'
import SuccessStories from '@/pages/static/SuccessStories'
import Team from '@/pages/static/Team'
import TermsOfService from '@/pages/static/TermsOfService'
import Volunteer from '@/pages/static/Volunteer'
import LgasGuide from '@/pages/LgasGuide'
import KnownFor from '@/pages/KnownFor'
import AbsuGuide from '@/pages/AbsuGuide'

/** Public pages whose content lives in the code, by path. */
export const STATIC_PAGES: Record<string, ComponentType> = {
  '/about': About,
  '/about/lgas': LgasGuide,
  '/about/known-for': KnownFor,
  '/about/absu': AbsuGuide,
  '/mission': Mission,
  '/team': Team,
  '/careers': Careers,
  '/volunteer': Volunteer,
  '/events': Events,
  '/success-stories': SuccessStories,
  '/member-spotlight': MemberSpotlight,
  '/help': Help,
  '/forum-guidelines': ForumGuidelines,
  '/community-standards': CommunityStandards,
  '/privacy-policy': PrivacyPolicy,
  '/terms-of-service': TermsOfService,
  '/cookie-policy': CookiePolicy,
}

/** Renders one page; data that loads in the browser simply isn't there yet. */
export function render(path: string): string {
  const Page = STATIC_PAGES[path]
  if (!Page) throw new Error(`No static page for ${path}`)
  const queryClient = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  return renderToString(
    <HelmetProvider context={{}}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StaticRouter location={path}>
            <Page />
          </StaticRouter>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}
