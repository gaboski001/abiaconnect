/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, infoBox, infoLabel, infoText, link, note, text } from './_layout.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, recipient, confirmationUrl }: SignupEmailProps) => (
  <BrandLayout preview={`Confirm your email to finish joining ${siteName}`} transactional>
    <h1 style={h1}>Welcome to {siteName}! 🎉</h1>
    <Text style={text}>
      Thank you for joining the community that connects Abians at home and abroad. Please confirm that{' '}
      <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link> is your email address to activate your account.
    </Text>
    <CtaButton href={confirmationUrl}>Confirm my email</CtaButton>
    <div style={infoBox}>
      <Text style={infoLabel}>What's next</Text>
      <Text style={infoText}>
        Complete your profile, join discussions in your LGA and community groups, and meet Abians around the world.
      </Text>
    </div>
    <FallbackLink href={confirmationUrl} />
    <Text style={note}>If you didn't create an account, you can safely ignore this email.</Text>
  </BrandLayout>
)

export default SignupEmail
