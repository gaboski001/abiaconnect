/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, button, h1, text } from './_layout.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <BrandLayout preview={`Reset your password for ${siteName}`}>
    <h1 style={h1 as any}>Reset your password</h1>
    <Text style={text}>
      We received a request to reset your password for <strong>AbiaConnect</strong>. Click the
      button below to choose a new password.
    </Text>
    <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
      <Link href={confirmationUrl} style={button}>Reset Password</Link>
    </div>
    <Text style={{ ...text, fontSize: '13px', color: '#5a6b62' }}>
      If you didn't request a password reset, you can safely ignore this email. Your password will
      not be changed.
    </Text>
  </BrandLayout>
)

export default RecoveryEmail
