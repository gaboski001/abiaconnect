/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, button, h1, infoBox, infoLabel, infoText, link, text } from './_layout.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, recipient, confirmationUrl }: SignupEmailProps) => (
  <BrandLayout preview={`Confirm your email for ${siteName}`}>
    <Text style={text}>Hi there,</Text>
    <h1 style={h1 as any}>Welcome to Abiaconnect — confirm your email</h1>
    <Text style={text}>
      Thanks for joining <strong>Abiaconnect</strong>, the community forum connecting Abians
      worldwide. Please confirm your email address (
      <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>) to activate your account
      and start connecting.
    </Text>

    <div style={infoBox}>
      <Text style={infoLabel as any}>What's next</Text>
      <Text style={infoText as any}>
        Click the button below to verify your email. The link expires in 24 hours.
      </Text>
    </div>

    <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
      <Link href={confirmationUrl} style={button}>Verify Email</Link>
    </div>

    <Text style={{ ...text, fontSize: '13px', color: '#5a6b62' }}>
      If you didn't create an account, you can safely ignore this email.
    </Text>
  </BrandLayout>
)

export default SignupEmail
