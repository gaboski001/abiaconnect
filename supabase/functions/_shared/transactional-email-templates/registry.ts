import * as React from 'npm:react@18.3.1'
import { template as newDeviceLogin } from './new-device-login.tsx'
import { template as birthdayGreeting } from './birthday-greeting.tsx'

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
}
