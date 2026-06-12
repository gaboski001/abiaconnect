/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, button, h1, link, text } from './_layout.tsx'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <BrandLayout preview={`Confirm your email change for Abiaconnect`}>
    <h1 style={h1 as any}>Confirm your email change</h1>
    <Text style={text}>
      You requested to change your Abiaconnect email address from{' '}
      <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> to{' '}
      <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
    </Text>
    <Text style={text}>Click the button below to confirm this change:</Text>
    <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
      <Link href={confirmationUrl} style={button}>Confirm Email Change</Link>
    </div>
    <Text style={{ ...text, fontSize: '13px', color: '#5a6b62' }}>
      If you didn't request this change, please secure your account immediately.
    </Text>
  </BrandLayout>
)

export default EmailChangeEmail
