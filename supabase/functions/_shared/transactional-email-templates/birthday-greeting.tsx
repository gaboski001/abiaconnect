/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, h1, text, infoBox, infoText } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
}

const BirthdayGreetingEmail = ({ name }: Props) => (
  <BrandLayout preview="Happy birthday from the AbiaConnect family 🎉">
    <h1 style={h1 as any}>Happy birthday{name ? `, ${name}` : ''} 🎂</h1>

    <Text style={text}>
      From everyone at <strong>AbiaConnect</strong>, we wish you a day filled with joy,
      laughter, and the warm company of family and friends. May this new year of your
      life bring health, prosperity, and every good thing your heart desires.
    </Text>

    <div style={infoBox}>
      <Text style={infoText as any}>
        “Onye kwe, chi ya ekwe.” — Whatever you set your heart on, may the heavens
        bring it to pass. Today the whole AbiaConnect community is rooting for you.
      </Text>
    </div>

    <Text style={text}>
      Thank you for being part of our community. Step into your new year with courage —
      we’re proud to share the journey with you.
    </Text>

    <Text style={text}>
      Warm regards,<br />
      The AbiaConnect Team
    </Text>
  </BrandLayout>
)

export const template = {
  component: BirthdayGreetingEmail,
  subject: ({ name }: Props) => `Happy birthday${name ? `, ${name}` : ''} 🎉`,
  displayName: 'Birthday greeting',
  previewData: { name: 'Chinedu' },
} satisfies TemplateEntry
