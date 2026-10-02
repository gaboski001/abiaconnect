/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, infoBox, infoLabel, infoText, link, note, text } from './_layout.tsx'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <BrandLayout preview={`Confirm your new email address for ${siteName}`} transactional>
    <h1 style={h1}>Confirm your email change</h1>
    <Text style={text}>You asked to change the email address on your {siteName} account:</Text>
    <div style={infoBox}>
      <Text style={infoLabel}>From</Text>
      <Text style={{ ...infoText, margin: '0 0 10px' }}>{oldEmail}</Text>
      <Text style={infoLabel}>To</Text>
      <Text style={infoText}>{newEmail}</Text>
    </div>
    <CtaButton href={confirmationUrl}>Confirm email change</CtaButton>
    <FallbackLink href={confirmationUrl} />
    <Text style={note}>
      If you didn't request this change, don't click the button. Reset your password straight away and contact us.
    </Text>
  </BrandLayout>
)

export default EmailChangeEmail
