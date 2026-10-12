/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, text, infoBox, infoLabel, infoText, note } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  unsubscribeUrl?: string
}

const PREMIUM_URL = 'https://abiaconnect.com/relationship/premium'

const PremiumInviteEmail = ({ name, unsubscribeUrl }: Props) => (
  <BrandLayout preview="Connect with more Abians, without the daily limit." unsubscribeUrl={unsubscribeUrl}>
    <h1 style={h1 as any}>Keep connecting{name ? `, ${name}` : ''}</h1>

    <Text style={text}>
      You used all of your free connection requests yesterday. Your requests are back today, and
      you can keep using AbiaConnect for free.
    </Text>

    <Text style={text}>
      If you would like to reach more people, <strong>AbiaConnect Premium</strong> removes the daily limit.
    </Text>

    <div style={infoBox}>
      <Text style={infoLabel as any}>With Premium you can</Text>
      <Text style={infoText as any}>
        • Send connection requests without a daily limit
        <br />• See everyone who wants to connect with you
        <br />• Introduce yourself to a member directly
      </Text>
    </div>

    <CtaButton href={PREMIUM_URL}>See Premium plans</CtaButton>

    <Text style={text}>
      It is a one-time payment made on our website. It does not renew by itself, and your membership
      then works on the website and in the app. Premium members also help keep AbiaConnect free for
      everyone else.
    </Text>

    <FallbackLink href={PREMIUM_URL} />

    <Text style={note}>We send this email at most once a month.</Text>
  </BrandLayout>
)

export const template = {
  component: PremiumInviteEmail,
  subject: 'Connect with more Abians on AbiaConnect',
  displayName: 'Premium invitation',
  previewData: { name: 'Chinedu', unsubscribeUrl: 'https://abiaconnect.com/unsubscribe' },
} satisfies TemplateEntry
