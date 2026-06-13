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

const LOGO_URL = 'https://abiaconnect.com/icons/icon-512x512.png'

interface BrandLayoutProps {
  preview: string
  children: React.ReactNode
  unsubscribeUrl?: string
  manageUrl?: string
}

export const BrandLayout = ({
  preview,
  children,
  unsubscribeUrl = 'https://abiaconnect.com/unsubscribe',
  manageUrl = 'https://abiaconnect.com/notifications',
}: BrandLayoutProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Container style={card}>
          {/* Header */}
          <Section style={header}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
              <tr>
                <td align="left" style={{ verticalAlign: 'middle' }}>
                  <Img
                    src={LOGO_URL}
                    alt="Abiaconnect"
                    width="140"
                    height="40"
                    style={{ display: 'block', border: 0, outline: 'none', textDecoration: 'none', height: 'auto', maxWidth: '140px' }}
                  />
                </td>
                <td align="right" style={{ verticalAlign: 'middle' }}>
                  <Link href="mailto:support@abiaconnect.com" style={contactBtn}>
                    Contact Us
                  </Link>
                </td>
              </tr>
            </table>
          </Section>

          {/* Body */}
          <Section style={bodySection}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerBrand}>Abiaconnect</Text>
            <Text style={footerTag}>
              The community forum connecting indigenous people of Abia State at home and abroad.
            </Text>
            <Text style={footerNav}>
              <Link href="https://abiaconnect.com" style={footerLink}>Home</Link>
              <span style={dot}> · </span>
              <Link href="https://abiaconnect.com/forum" style={footerLink}>Forum</Link>
              <span style={dot}> · </span>
              <Link href="https://abiaconnect.com/about" style={footerLink}>About</Link>
              <span style={dot}> · </span>
              <Link href="https://abiaconnect.com/support" style={footerLink}>Support</Link>
            </Text>
            <Text style={footerSocial}>
              <Link href="https://instagram.com/abiaconnect_forum" style={socialPill}>Instagram</Link>
              <Link href="https://facebook.com/Abiaconnect" style={socialPill}>Facebook</Link>
              <Link href="https://twitter.com/search?q=%23Abiaconnect" style={socialPill}>X / Twitter</Link>
            </Text>
            <Hr style={hr} />
            <Text style={copyright}>
              © 2026 Abiaconnect — <Link href="https://abiaconnect.com" style={mutedLink}>abiaconnect.com</Link>
            </Text>
            <Text style={copyright}>
              <Link href={unsubscribeUrl} style={footerLink}>Unsubscribe</Link>
              <span style={dot}> · </span>
              <Link href={manageUrl} style={footerLink}>Manage Notifications</Link>
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
)

// Shared body styles
export const h1 = {
  margin: '0 0 16px',
  fontSize: '22px',
  fontWeight: 700 as const,
  color: '#1a4f3a',
  lineHeight: '1.3',
}
export const text = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#3a4a42',
}
export const link = { color: '#1a4f3a', textDecoration: 'underline' }
export const button = {
  display: 'inline-block',
  backgroundColor: '#1a4f3a',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '8px',
  padding: '14px 32px',
  textDecoration: 'none',
}
export const infoBox = {
  backgroundColor: '#f1f7f3',
  borderLeft: '4px solid #1a4f3a',
  borderRadius: '6px',
  padding: '16px 18px',
  margin: '0 0 24px',
}
export const infoLabel = {
  margin: '0 0 6px',
  fontSize: '13px',
  fontWeight: 700 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  color: '#1a4f3a',
}
export const infoText = {
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.5,
  color: '#3a4a42',
}
export const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '26px',
  fontWeight: 700 as const,
  color: '#1a4f3a',
  letterSpacing: '4px',
  margin: '0 0 24px',
}

// Layout styles
const main = {
  backgroundColor: '#f4f6f5',
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  margin: 0,
  padding: 0,
}
const outer = { padding: '24px 12px', width: '100%', maxWidth: '100%' }
const card = {
  maxWidth: '600px',
  width: '100%',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden',
  padding: 0,
}
const header = { backgroundColor: '#1a4f3a', padding: '24px 28px' }
const brandName = {
  margin: 0,
  fontSize: '22px',
  fontWeight: 700 as const,
  color: '#ffffff',
  lineHeight: 1.1,
}
const brandTag = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: '#cfe3d8',
  letterSpacing: '0.4px',
}
const contactBtn = {
  display: 'inline-block',
  padding: '9px 18px',
  border: '1.5px solid #ffffff',
  borderRadius: '999px',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 600 as const,
}
const bodySection = { padding: '36px 36px 32px' }
const footer = {
  backgroundColor: '#1a2b22',
  padding: '32px 28px',
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
  margin: '0 0 20px',
  fontSize: '12px',
  lineHeight: 1.6,
  color: '#8fa89c',
  textAlign: 'center' as const,
}
const footerNav = { margin: '0 0 18px', fontSize: '13px', textAlign: 'center' as const }
const footerSocial = { margin: '0 0 8px', textAlign: 'center' as const }
const footerLink = { color: '#cfe3d8', textDecoration: 'none', margin: '0 6px', fontSize: '13px' }
const socialPill = {
  display: 'inline-block',
  margin: '0 4px',
  textDecoration: 'none',
  color: '#cfe3d8',
  fontSize: '12px',
  padding: '6px 12px',
  border: '1px solid #2f4438',
  borderRadius: '999px',
}
const dot = { color: '#3a4a42' }
const hr = { borderColor: '#2f4438', margin: '20px 0 16px' }
const copyright = {
  margin: '0 0 6px',
  fontSize: '12px',
  color: '#8fa89c',
  textAlign: 'center' as const,
}
const mutedLink = { color: '#8fa89c', textDecoration: 'none' }
