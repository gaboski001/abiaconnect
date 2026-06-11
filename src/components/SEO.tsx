import { Helmet } from 'react-helmet-async'

const SITE = 'AbiaConnect'
const BASE_URL = 'https://abiaconnect.com'

interface SEOProps {
  title: string
  description: string
  path: string
  ogType?: 'website' | 'article' | 'profile'
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

export function SEO({ title, description, path, ogType = 'website', jsonLd }: SEOProps) {
  const url = `${BASE_URL}${path}`
  const suffix = title.includes(SITE) ? '' : ` | ${SITE}`
  const maxBase = 60 - suffix.length
  const baseTitle = title.length > maxBase ? title.slice(0, Math.max(maxBase - 3, 0)) + '...' : title
  const fullTitle = baseTitle + suffix
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []
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
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
      ))}
    </Helmet>
  )
}
