/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, h1, text, infoBox, infoLabel, infoText } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  device?: string
  when?: string
  ip?: string
  location?: string
}

const NewDeviceLoginEmail = ({ device, when, ip, location }: Props) => (
  <BrandLayout preview="New sign-in to your Abiaconnect account">
    <h1 style={h1 as any}>New sign-in detected</h1>
    <Text style={text}>
      We noticed a sign-in to your <strong>Abiaconnect</strong> account from a device we haven't
      seen before. If this was you, you can safely ignore this email.
    </Text>

    <div style={infoBox}>
      <Text style={infoLabel as any}>Sign-in details</Text>
      <Text style={infoText as any}>
        <strong>When:</strong> {when || 'Just now'}<br />
        <strong>Device:</strong> {device || 'Unknown device'}<br />
        {location ? <><strong>Location:</strong> {location}<br /></> : null}
        {ip ? <><strong>IP address:</strong> {ip}</> : null}
      </Text>
    </div>

    <Text style={text}>
      <strong>Didn't sign in?</strong> Please reset your password immediately at{' '}
      <a href="https://abiaconnect.com/forgot-password" style={{ color: '#1a4f3a' }}>
        abiaconnect.com/forgot-password
      </a>{' '}
      and contact us at support@abiaconnect.com.
    </Text>
  </BrandLayout>
)

export const template = {
  component: NewDeviceLoginEmail,
  subject: 'New sign-in to your Abiaconnect account',
  displayName: 'New device sign-in alert',
  previewData: {
    device: 'Chrome on macOS',
    when: 'June 13, 2026 at 11:00 UTC',
    ip: '203.0.113.10',
    location: 'Lagos, NG',
  },
} satisfies TemplateEntry
