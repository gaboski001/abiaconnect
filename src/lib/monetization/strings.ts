// Monetization copy, keyed for future localization. Components call t(key)
// instead of hard-coding strings.
const en = {
  'pricing.title': 'Upgrade your dating experience',
  'pricing.subtitle': 'Free stays useful. Premium gives you more reach and control.',
  'pricing.monthly': 'Monthly',
  'pricing.yearly': 'Yearly',
  'pricing.per_month': '/month',
  'pricing.per_year': '/year',
  'pricing.effective_monthly': '{price}/month when billed yearly',
  'pricing.recommended': 'Recommended',
  'pricing.current_plan': 'Your current plan',
  'pricing.active_until': 'Active until {date}',
  'pricing.choose': 'Choose {plan}',
  'pricing.extend': 'Extend {plan}',
  'pricing.free_forever': 'Free',
  'pricing.billing_info':
    'One-time payment for {days} days of access. It does not renew automatically and you will not be charged again unless you choose to buy more time.',
  'pricing.secure': 'Payments are processed securely by {provider}. We never see your card details.',
  'pricing.pay_with': 'Pay with',
  'pricing.unavailable': 'Premium plans are not available right now. Please check back soon.',
  'pricing.app_store_notice': 'Upgrades are not available in this app.',
  'pricing.history': 'Purchase history',
  'pricing.no_history': 'No purchases yet.',

  'checkout.starting': 'Starting secure checkout…',
  'checkout.error': 'Your payment could not be started. Please try again.',
  'payment.processing': 'Your payment is being processed.',
  'payment.activating': 'Your payment has been received and your benefits are being activated.',
  'payment.success': 'Payment successful. Your {plan} benefits are now active.',
  'payment.failed': 'Your payment could not be completed. Please try again.',
  'payment.abandoned': 'The payment was cancelled. You have not been charged.',
  'payment.mismatch': 'We could not confirm the full payment. Please contact support with your reference.',
  'payment.refunded': 'This payment was refunded.',
  'payment.reference': 'Reference: {reference}',

  'paywall.likes.title': "You're out of likes for today",
  'paywall.likes.body': 'Upgrade to Premium for unlimited likes, or come back tomorrow for more.',
  'paywall.likes.cta': 'Upgrade to Premium',
  'paywall.likes.later': 'Continue tomorrow',
  'paywall.see_likes.title': 'You have new likes waiting',
  'paywall.see_likes.body': 'See everyone who likes you and match instantly with Premium.',
  'paywall.see_likes.cta': 'See who likes you',
  'paywall.not_now': 'Not now',

  'likes.title': 'Likes & matches',
  'likes.tab_likes': 'Likes you',
  'likes.tab_matches': 'Matches',
  'likes.empty': 'No new likes yet. Keep your profile fresh to get noticed.',
  'likes.count': '{count} people like you',
  'likes.count_one': '1 person likes you',
  'likes.locked': 'Upgrade to see who they are.',
  'likes.matches_empty': 'No matches yet. Like profiles in Discover to start matching.',
  'likes.message': 'Message',
  'likes.like_back': 'Like back',
  'likes.new': 'New',

  'match.title': "It's a match!",
  'match.body': 'You and {name} like each other.',
  'match.message': 'Send a message',
  'match.keep': 'Keep discovering',

  'discover.like': 'Like',
  'discover.pass': 'Pass',
  'discover.message': 'Message',
  'discover.likes_left': '{count} likes left today',
  'discover.profile_required': 'Create your dating profile first to like people.',
  'discover.unavailable': 'This profile is no longer available.',
  'discover.restricted': 'Your account cannot do this right now.',
} as const

export type StringKey = keyof typeof en

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100)
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`
  }
}
