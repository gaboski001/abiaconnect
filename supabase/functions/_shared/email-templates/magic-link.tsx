/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, infoBox, infoLabel, infoText, link, note, text } from './_layout.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <BrandLayout preview={`Your secure sign-in link for ${siteName}`} transactional>
    <h1 style={h1}>Your sign-in link</h1>
    <Text style={text}>
      Tap the button below to sign in to {siteName}. For your security, this link works once and expires shortly.
    </Text>
    <CtaButton href={confirmationUrl}>Sign in to {siteName}</CtaButton>
    <FallbackLink href={confirmationUrl} />
    <Text style={note}>If you didn't ask to sign in, you can ignore this email. Your account stays safe.</Text>
  </BrandLayout>
)

export default MagicLinkEmail
