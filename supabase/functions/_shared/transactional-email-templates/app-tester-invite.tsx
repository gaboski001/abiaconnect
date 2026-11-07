/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, text, infoBox, infoLabel, infoText, note } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  unsubscribeUrl?: string
}

const GROUP_URL = 'https://groups.google.com/g/abiaconnect-app-testers'
const TESTER_URL = 'https://play.google.com/apps/testing/com.abiaconnect.app'

const AppTesterInviteEmail = ({ name, unsubscribeUrl }: Props) => (
  <BrandLayout preview="Be among the first to use the AbiaConnect Android app." unsubscribeUrl={unsubscribeUrl}>
    <h1 style={h1 as any}>Help us test the AbiaConnect app</h1>

    <Text style={text}>{name ? `Hello ${name},` : 'Hello,'}</Text>

    <Text style={text}>
      We’re getting the AbiaConnect Android app ready for Google Play, and we’d like you to be among the first to use it.
    </Text>

    <div style={infoBox}>
      <Text style={infoLabel as any}>Three quick steps</Text>
      <Text style={infoText as any}>
        1. <Link href={GROUP_URL}>Join the testers group</Link>
      </Text>
      <Text style={infoText as any}>
        2. <Link href={TESTER_URL}>Open the tester link</Link> and tap “Become a tester”
      </Text>
      <Text style={infoText as any}>3. Install the app and use it for a few days</Text>
    </div>

    <CtaButton href={GROUP_URL}>Join the testers group</CtaButton>

    <FallbackLink href={GROUP_URL} />

    <Text style={text}>
      Then tell us what works and what doesn’t at <Link href="mailto:support@abiaconnect.com">support@abiaconnect.com</Link>.
      Your feedback helps us make the app better for Abians everywhere.
    </Text>

    <Text style={note}>We send this invitation once.</Text>
  </BrandLayout>
)

export const template = {
  component: AppTesterInviteEmail,
  subject: 'Help us test the AbiaConnect app',
  displayName: 'App tester invitation',
  previewData: { name: 'Chinedu', unsubscribeUrl: 'https://abiaconnect.com/unsubscribe' },
} satisfies TemplateEntry
