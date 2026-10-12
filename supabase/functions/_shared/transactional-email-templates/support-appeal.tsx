/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, text, infoBox, infoLabel, infoText, note } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  unsubscribeUrl?: string
}

const DONATE_URL = 'https://abiaconnect.com/donate'

const SupportAppealEmail = ({ name, unsubscribeUrl }: Props) => (
  <BrandLayout preview="AbiaConnect is free for every member. Here is how you can help keep it that way." unsubscribeUrl={unsubscribeUrl}>
    <h1 style={h1 as any}>Help keep AbiaConnect running</h1>

    <Text style={text}>{name ? `Dear ${name},` : 'Dear member,'}</Text>

    <Text style={text}>
      Thank you for being part of AbiaConnect. The forum is free for every member, and we want to
      keep it that way.
    </Text>

    <div style={infoBox}>
      <Text style={infoLabel as any}>What your support pays for</Text>
      <Text style={infoText as any}>
        • The servers that keep the website and the app online
        <br />• Moderation, so discussions stay safe and respectful
        <br />• New features for Abians at home and abroad
      </Text>
    </div>

    <Text style={text}>
      If AbiaConnect has been useful to you, please consider supporting it. Any amount helps, and it
      takes about a minute on our website.
    </Text>

    <CtaButton href={DONATE_URL}>Support AbiaConnect</CtaButton>

    <Text style={text}>
      Giving is entirely your choice. Your account and everything you use today stay free whether or
      not you give.
    </Text>

    <FallbackLink href={DONATE_URL} />

    <Text style={note}>We send this email at most once every three months.</Text>
  </BrandLayout>
)

export const template = {
  component: SupportAppealEmail,
  subject: 'Help keep AbiaConnect running',
  displayName: 'Support appeal',
  previewData: { name: 'Chinedu', unsubscribeUrl: 'https://abiaconnect.com/unsubscribe' },
} satisfies TemplateEntry
