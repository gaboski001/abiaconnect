/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, infoBox, infoLabel, infoText, link, note, text } from './_layout.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <BrandLayout preview={`Reset your ${siteName} password`} transactional>
    <h1 style={h1}>Reset your password</h1>
    <Text style={text}>
      We received a request to reset the password for your {siteName} account. Tap the button below to choose a new one.
    </Text>
    <CtaButton href={confirmationUrl}>Reset my password</CtaButton>
    <div style={infoBox}>
      <Text style={infoLabel}>Security tip</Text>
      <Text style={infoText}>
        {siteName} will never ask for your password, BVN or OTP by email, phone or chat.
      </Text>
    </div>
    <FallbackLink href={confirmationUrl} />
    <Text style={note}>
      If you didn't request a password reset, you can safely ignore this email. Your password won't change.
    </Text>
  </BrandLayout>
)

export default RecoveryEmail
