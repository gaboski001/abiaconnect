import { Helmet } from 'react-helmet-async'

const SITE = 'AbiaConnect'
const BASE_URL = 'https://abiaconnect.com'

interface SEOProps {
  title: string
  description: string
  path: string
  ogType?: 'website' | 'article' | 'profile'
}

export function SEO({ title, description, path, ogType = 'website' }: SEOProps) {
  const url = `${BASE_URL}${path}`
  const fullTitle = title.includes(SITE) ? title : `${title} | ${SITE}`
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  )
}
