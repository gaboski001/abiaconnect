/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, button, h1, text } from './_layout.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <BrandLayout preview={`You've been invited to join Abiaconnect`}>
    <h1 style={h1 as any}>You've been invited</h1>
    <Text style={text}>
      You've been invited to join <strong>Abiaconnect</strong>, the community forum connecting
      indigenous people of Abia State at home and abroad. Click below to accept and create your
      account.
    </Text>
    <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
      <Link href={confirmationUrl} style={button}>Accept Invitation</Link>
    </div>
    <Text style={{ ...text, fontSize: '13px', color: '#5a6b62' }}>
      If you weren't expecting this invitation, you can safely ignore this email.
    </Text>
  </BrandLayout>
)

export default InviteEmail
