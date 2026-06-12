/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, button, h1, text } from './_layout.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <BrandLayout preview={`Your login link for ${siteName}`}>
    <h1 style={h1 as any}>Your login link</h1>
    <Text style={text}>
      Click the button below to log in to <strong>Abiaconnect</strong>. This link will expire
      shortly.
    </Text>
    <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
      <Link href={confirmationUrl} style={button}>Log In</Link>
    </div>
    <Text style={{ ...text, fontSize: '13px', color: '#5a6b62' }}>
      If you didn't request this link, you can safely ignore this email.
    </Text>
  </BrandLayout>
)

export default MagicLinkEmail
