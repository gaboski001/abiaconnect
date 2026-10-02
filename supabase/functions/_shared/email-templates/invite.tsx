/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, infoBox, infoLabel, infoText, link, note, text } from './_layout.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, confirmationUrl }: InviteEmailProps) => (
  <BrandLayout preview={`You've been invited to join ${siteName}`} transactional>
    <h1 style={h1}>You're invited to {siteName}</h1>
    <Text style={text}>
      Someone from the {siteName} team has invited you to join our community: the forum connecting
      indigenous people of Abia State at home and abroad.
    </Text>
    <CtaButton href={confirmationUrl}>Accept invitation</CtaButton>
    <FallbackLink href={confirmationUrl} />
    <Text style={note}>If you weren't expecting this invitation, you can safely ignore this email.</Text>
  </BrandLayout>
)

export default InviteEmail
