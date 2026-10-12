import * as React from 'npm:react@18.3.1'
import { template as newDeviceLogin } from './new-device-login.tsx'
import { template as birthdayGreeting } from './birthday-greeting.tsx'
import { template as premiumInvite } from './premium-invite.tsx'
import { template as supportAppeal } from './support-appeal.tsx'
import { received as volunteerReceived, approved as volunteerApproved, declined as volunteerDeclined } from './volunteer.tsx'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-device-login': newDeviceLogin,
  'birthday-greeting': birthdayGreeting,
  'premium-invite': premiumInvite,
  'support-appeal': supportAppeal,
  'volunteer-received': volunteerReceived,
  'volunteer-approved': volunteerApproved,
  'volunteer-declined': volunteerDeclined,
}
