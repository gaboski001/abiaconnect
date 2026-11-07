/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, FallbackLink, h1, text, infoBox, infoLabel, infoText, note } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  posts?: Array<{ id: string; title: string; replies: number }>
  lga?: string
  unsubscribeUrl?: string
}

const FORUM_URL = 'https://abiaconnect.com/'

const AbiaThisWeekEmail = ({ name, posts = [], lga, unsubscribeUrl }: Props) => (
  <BrandLayout preview="What Abians talked about this week." unsubscribeUrl={unsubscribeUrl}>
    <h1 style={h1 as any}>Abia this week</h1>

    <Text style={text}>{name ? `Dear ${name},` : 'Dear member,'}</Text>

    <Text style={text}>Here is what people are talking about on AbiaConnect. Join in and add your voice.</Text>

    <div style={infoBox}>
      <Text style={infoLabel as any}>This week’s discussions</Text>
      {posts.map((p) => (
        <Text key={p.id} style={infoText as any}>
          <Link href={`https://abiaconnect.com/thread/${p.id}`}>{p.title}</Link>
          {p.replies > 0 ? ` (${p.replies} ${p.replies === 1 ? 'reply' : 'replies'})` : ''}
        </Text>
      ))}
    </div>

    {lga ? <Text style={text}>{lga} is leading the LGA of the month. Is your LGA next?</Text> : null}

    <CtaButton href={FORUM_URL}>Open the forum</CtaButton>

    <FallbackLink href={FORUM_URL} />

    <Text style={note}>We send this email at most once a week.</Text>
  </BrandLayout>
)

export const template = {
  component: AbiaThisWeekEmail,
  subject: 'Abia this week',
  displayName: 'Abia this week',
  previewData: {
    name: 'Chinedu',
    posts: [
      { id: '1', title: 'What is the best way to start a small business in Aba?', replies: 12 },
      { id: '2', title: 'Which new yam festival should I attend this year?', replies: 1 },
    ],
    lga: 'Aba North',
    unsubscribeUrl: 'https://abiaconnect.com/unsubscribe',
  },
} satisfies TemplateEntry
