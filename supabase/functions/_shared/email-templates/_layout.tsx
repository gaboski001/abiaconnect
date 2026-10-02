/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

// Shared look for every AbiaConnect email (account and app emails).
// Email clients support only simple HTML: tables, inline styles, no external
// CSS. Gradients get a solid colour first, for clients that ignore them.

const SITE = 'https://abiaconnect.com'
const LOGO_URL = `${SITE}/brand-logo.png` // 499 x 290, transparent

// Brand palette (matches the website).
export const brand = {
  green: '#1a4f3a',
  greenDeep: '#0f3326',
  greenSoft: '#f1f7f3',
  gold: '#d4a017',
  ink: '#1f2a24',
  body: '#3a4a42',
  muted: '#6b7c73',
  line: '#e3ebe6',
}

interface BrandLayoutProps {
  preview: string
  children: React.ReactNode
  unsubscribeUrl?: string
  manageUrl?: string
  /** Account emails (password reset etc.) are not newsletters: no unsubscribe line. */
  transactional?: boolean
}

export const BrandLayout = ({
  preview,
  children,
  unsubscribeUrl = `${SITE}/unsubscribe`,
  manageUrl = `${SITE}/notifications`,
  transactional = false,
}: BrandLayoutProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Container style={card}>
          {/* Brand accent bar */}
          <Section style={accentBar}>&nbsp;</Section>

          {/* Header: logo on white so its blue and orange stay vivid */}
          <Section style={header}>
            <Link href={SITE} style={{ textDecoration: 'none' }}>
              <Img
                src={LOGO_URL}
                alt="AbiaConnect"
                width="150"
                height="87"
                style={{ display: 'block', margin: '0 auto', border: 0, outline: 'none', textDecoration: 'none' }}
              />
            </Link>
            <Text style={tagline}>Connecting Abians worldwide</Text>
          </Section>

          {/* Body */}
          <Section style={bodySection}>{children}</Section>

          {/* Help strip */}
          <Section style={helpStrip}>
            <Text style={helpText}>
              Need help? Visit our <Link href={`${SITE}/help`} style={helpLink}>Help centre</Link> or reply to{' '}
              <Link href="mailto:support@abiaconnect.com" style={helpLink}>support@abiaconnect.com</Link>.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerBrand}>AbiaConnect</Text>
            <Text style={footerTag}>
              The community forum connecting indigenous people of Abia State at home and abroad.
            </Text>
            <Text style={footerNav}>
              <Link href={SITE} style={footerLink}>Home</Link>
              <span style={dot}> · </span>
              <Link href={`${SITE}/about`} style={footerLink}>About</Link>
              <span style={dot}> · </span>
              <Link href={`${SITE}/help`} style={footerLink}>Help centre</Link>
            </Text>
            <Text style={footerSocial}>
              <Link href="https://facebook.com/Abiaconnect" style={socialPill}>Facebook</Link>
              <Link href="https://instagram.com/abiaconnect_forum" style={socialPill}>Instagram</Link>
            </Text>
            <Hr style={hr} />
            <Text style={copyright}>
              © {new Date().getFullYear()} AbiaConnect · <Link href={SITE} style={mutedLink}>abiaconnect.com</Link>
            </Text>
            {transactional ? (
              <Text style={copyright}>
                You received this email because of an action on your AbiaConnect account.
              </Text>
            ) : (
              <Text style={copyright}>
                <Link href={unsubscribeUrl} style={footerLink}>Unsubscribe</Link>
                <span style={dot}> · </span>
                <Link href={manageUrl} style={footerLink}>Manage notifications</Link>
              </Text>
            )}
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
)

/** Main call-to-action button (bulletproof table button). */
export const CtaButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '8px auto 28px' }}>
    <tr>
      <td align="center" style={buttonCell}>
        <Link href={href} style={button}>
          {children}
        </Link>
      </td>
    </tr>
  </table>
)

/** "Button not working?" line with the raw link, for clients that block buttons. */
export const FallbackLink = ({ href }: { href: string }) => (
  <Text style={fallback}>
    Button not working? Copy and paste this link into your browser:
    <br />
    <Link href={href} style={fallbackUrl}>
      {href}
    </Link>
  </Text>
)

// Shared body styles
export const h1 = {
  margin: '0 0 16px',
  fontSize: '24px',
  fontWeight: 700 as const,
  color: brand.green,
  lineHeight: '1.3',
  textAlign: 'center' as const,
}
export const text = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: '1.65',
  color: brand.body,
}
export const link = { color: brand.green, textDecoration: 'underline' }
export const buttonCell = {
  borderRadius: '10px',
  backgroundColor: brand.green,
  backgroundImage: `linear-gradient(135deg, #2f7d5b 0%, ${brand.green} 55%, ${brand.greenDeep} 100%)`,
}
export const button = {
  display: 'inline-block',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 700 as const,
  borderRadius: '10px',
  padding: '14px 34px',
  textDecoration: 'none',
  letterSpacing: '0.2px',
}
export const infoBox = {
  backgroundColor: brand.greenSoft,
  borderLeft: `4px solid ${brand.gold}`,
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '0 0 24px',
}
export const infoLabel = {
  margin: '0 0 6px',
  fontSize: '12px',
  fontWeight: 700 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.6px',
  color: brand.green,
}
export const infoText = {
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.55,
  color: brand.body,
}
export const codeStyle = {
  fontFamily: "'SFMono-Regular', Consolas, 'Courier New', monospace",
  fontSize: '30px',
  fontWeight: 700 as const,
  color: brand.green,
  letterSpacing: '8px',
  textAlign: 'center' as const,
  backgroundColor: brand.greenSoft,
  border: `1px dashed ${brand.green}`,
  borderRadius: '10px',
  padding: '16px 8px',
  margin: '0 0 24px',
}
export const note = {
  margin: '0 0 8px',
  fontSize: '13px',
  lineHeight: '1.6',
  color: brand.muted,
}

// Layout styles
const main = {
  backgroundColor: '#eef3f0',
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  margin: 0,
  padding: 0,
}
const outer = { padding: '28px 12px', width: '100%', maxWidth: '100%' }
const card = {
  maxWidth: '600px',
  width: '100%',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  overflow: 'hidden',
  padding: 0,
  border: `1px solid ${brand.line}`,
}
const accentBar = {
  height: '6px',
  lineHeight: '6px',
  fontSize: '1px',
  backgroundColor: brand.green,
  backgroundImage: `linear-gradient(90deg, ${brand.greenDeep} 0%, ${brand.green} 45%, ${brand.gold} 100%)`,
}
const header = {
  backgroundColor: '#ffffff',
  padding: '28px 28px 8px',
  textAlign: 'center' as const,
}
const tagline = {
  margin: '10px 0 0',
  fontSize: '12px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: brand.muted,
  textAlign: 'center' as const,
}
const bodySection = { padding: '24px 40px 28px' }
const fallback = {
  margin: '0 0 8px',
  fontSize: '12px',
  lineHeight: '1.6',
  color: brand.muted,
  wordBreak: 'break-all' as const,
}
const fallbackUrl = { color: brand.green, textDecoration: 'underline' }
const helpStrip = {
  backgroundColor: brand.greenSoft,
  padding: '16px 28px',
  borderTop: `1px solid ${brand.line}`,
}
const helpText = { margin: 0, fontSize: '13px', lineHeight: '1.6', color: brand.body, textAlign: 'center' as const }
const helpLink = { color: brand.green, fontWeight: 600 as const, textDecoration: 'underline' }
const footer = {
  backgroundColor: '#13261d',
  backgroundImage: `linear-gradient(180deg, #1a3328 0%, #10211a 100%)`,
  padding: '30px 28px',
  textAlign: 'center' as const,
}
const footerBrand = {
  margin: '0 0 8px',
  fontSize: '18px',
  fontWeight: 700 as const,
  color: '#ffffff',
  textAlign: 'center' as const,
}
const footerTag = {
  margin: '0 0 18px',
  fontSize: '12px',
  lineHeight: 1.6,
  color: '#9db5a8',
  textAlign: 'center' as const,
}
const footerNav = { margin: '0 0 16px', fontSize: '13px', textAlign: 'center' as const }
const footerSocial = { margin: '0 0 8px', textAlign: 'center' as const }
const footerLink = { color: '#d6e8de', textDecoration: 'none', margin: '0 6px', fontSize: '13px' }
const socialPill = {
  display: 'inline-block',
  margin: '0 4px',
  textDecoration: 'none',
  color: '#d6e8de',
  fontSize: '12px',
  padding: '6px 14px',
  border: '1px solid #2f4a3c',
  borderRadius: '999px',
}
const dot = { color: '#4a6356' }
const hr = { borderColor: '#2f4a3c', margin: '20px 0 16px' }
const copyright = {
  margin: '0 0 6px',
  fontSize: '12px',
  color: '#9db5a8',
  textAlign: 'center' as const,
}
const mutedLink = { color: '#9db5a8', textDecoration: 'none' }
