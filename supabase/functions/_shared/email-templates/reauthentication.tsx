/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, codeStyle, h1, text } from './_layout.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandLayout preview="Your AbiaConnect verification code">
    <h1 style={h1 as any}>Confirm reauthentication</h1>
    <Text style={text}>Use the code below to confirm your identity:</Text>
    <Text style={codeStyle as any}>{token}</Text>
    <Text style={{ ...text, fontSize: '13px', color: '#5a6b62' }}>
      This code will expire shortly. If you didn't request this, you can safely ignore this email.
    </Text>
  </BrandLayout>
)

export default ReauthenticationEmail
