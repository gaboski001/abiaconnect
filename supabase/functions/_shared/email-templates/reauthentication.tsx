/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, codeStyle, h1, note, text } from './_layout.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandLayout preview="Your AbiaConnect verification code" transactional>
    <h1 style={h1}>Your verification code</h1>
    <Text style={text}>Enter this code in AbiaConnect to confirm it's really you:</Text>
    <Text style={codeStyle}>{token}</Text>
    <Text style={note}>The code expires shortly. Never share it with anyone, including people claiming to be from AbiaConnect.</Text>
    <Text style={note}>If you didn't request this code, you can ignore this email.</Text>
  </BrandLayout>
)

export default ReauthenticationEmail
