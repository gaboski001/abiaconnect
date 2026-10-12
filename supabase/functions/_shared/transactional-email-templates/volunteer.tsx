/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, CtaButton, h1, text, infoBox, infoLabel, infoText, note as noteStyle } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

// The three emails a volunteer applicant can get: application received,
// approved, and not selected.

interface Props {
  name?: string
  /** The role as shown on the form, e.g. "Community Moderator". */
  role?: string
  /** Optional personal note from the admin who reviewed the application. */
  note?: string
}

const hello = (name?: string) => (name ? `Dear ${name},` : 'Hello,')
const roleText = (role?: string) => (role ? ` as a ${role}` : '')

const AdminNote = ({ note }: { note?: string }) =>
  note ? (
    <div style={infoBox}>
      <Text style={infoLabel as any}>A note from the team</Text>
      <Text style={{ ...infoText, whiteSpace: 'pre-wrap' } as any}>{note}</Text>
    </div>
  ) : null

const Signature = () => (
  <Text style={text}>
    Warm regards,
    <br />
    The AbiaConnect Team
  </Text>
)

const ReceivedEmail = ({ name, role }: Props) => (
  <BrandLayout preview="Thank you for offering your time to AbiaConnect." transactional>
    <h1 style={h1 as any}>We have received your application</h1>

    <Text style={text}>{hello(name)}</Text>

    <Text style={text}>
      Thank you for applying to volunteer with AbiaConnect{roleText(role)}. We are truly pleased that
      you want to give your time and skill to our community. It is people like you who keep this
      forum alive for Abians at home and abroad.
    </Text>

    <div style={infoBox}>
      <Text style={infoLabel as any}>What happens next</Text>
      <Text style={infoText as any}>
        1. Our team reads every application carefully.
        <br />
        2. We will email you our decision, usually within 7 days.
        <br />
        3. If you are selected, we will arrange a short introduction and get you started.
      </Text>
    </div>

    <Text style={text}>
      You do not need to do anything for now. If you want to add something to your application,
      simply reply to support@abiaconnect.com.
    </Text>

    <Signature />
  </BrandLayout>
)

const ApprovedEmail = ({ name, role, note }: Props) => (
  <BrandLayout preview="Your volunteer application has been approved." transactional>
    <h1 style={h1 as any}>Welcome to the team 🎉</h1>

    <Text style={text}>{hello(name)}</Text>

    <Text style={text}>
      We are delighted to tell you that your application to volunteer with AbiaConnect{roleText(role)} has
      been <strong>approved</strong>. Thank you for choosing to serve our community.
    </Text>

    <AdminNote note={note} />

    <div style={infoBox}>
      <Text style={infoLabel as any}>Your next steps</Text>
      <Text style={infoText as any}>
        1. A member of our team will contact you within a few days, by email or WhatsApp, to arrange a short
        introduction.
        <br />
        2. Please read our Community Standards, which guide everything we do.
        <br />
        3. If you do not have an AbiaConnect account yet, please create one with this email address.
      </Text>
    </div>

    <CtaButton href="https://abiaconnect.com/community-standards">Read the Community Standards</CtaButton>

    <Text style={text}>If you have any question before then, write to support@abiaconnect.com.</Text>

    <Signature />
  </BrandLayout>
)

const DeclinedEmail = ({ name, role, note }: Props) => (
  <BrandLayout preview="An update on your volunteer application." transactional>
    <h1 style={h1 as any}>An update on your application</h1>

    <Text style={text}>{hello(name)}</Text>

    <Text style={text}>
      Thank you for applying to volunteer with AbiaConnect{roleText(role)}, and for the time you put into your
      application. After careful review, we are not able to offer you a volunteer role at this time.
    </Text>

    <AdminNote note={note} />

    <Text style={text}>
      This is not a judgement of you or your ability. We receive more applications than we have roles for, and
      our needs change through the year. You are welcome to apply again in the future.
    </Text>

    <Text style={text}>
      You remain a valued member of the community, and we hope to keep seeing you on the forum.
    </Text>

    <Signature />

    <Text style={noteStyle}>Questions about this decision can be sent to support@abiaconnect.com.</Text>
  </BrandLayout>
)

const preview = { name: 'Chinedu', role: 'Community Moderator' }

export const received = {
  component: ReceivedEmail,
  subject: 'We have received your volunteer application',
  displayName: 'Volunteer application received',
  previewData: preview,
} satisfies TemplateEntry

export const approved = {
  component: ApprovedEmail,
  subject: 'Your AbiaConnect volunteer application is approved',
  displayName: 'Volunteer application approved',
  previewData: { ...preview, note: 'We loved your answer about handling disagreements calmly.' },
} satisfies TemplateEntry

export const declined = {
  component: DeclinedEmail,
  subject: 'An update on your AbiaConnect volunteer application',
  displayName: 'Volunteer application not selected',
  previewData: preview,
} satisfies TemplateEntry
