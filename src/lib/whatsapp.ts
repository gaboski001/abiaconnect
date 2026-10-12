/**
 * Turns a phone number as a member types it into international format
 * (+ and the country code, digits only), or null when it cannot be a real
 * number. A Nigerian number typed the local way (0801 234 5678) gets +234.
 */
export function normaliseWhatsAppNumber(input: string): string | null {
  let n = input.trim().replace(/[\s\-().]/g, '')
  if (n.startsWith('00')) n = `+${n.slice(2)}`
  else if (/^0[789]\d{9}$/.test(n)) n = `+234${n.slice(1)}`
  else if (/^234[789]\d{9}$/.test(n)) n = `+${n}`
  return /^\+[1-9]\d{7,14}$/.test(n) ? n : null
}

/** +2348012345678 shown as +234 801 234 5678; other countries are left as they are. */
export function formatWhatsAppNumber(phone: string): string {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(phone)
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : phone
}
