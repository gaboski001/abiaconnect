import StaticPage from '@/components/layout/StaticPage'

export default function PrivacyPolicy() {
  return (
    <StaticPage
      badge="Legal"
      title="Privacy Policy"
      subtitle="Last updated: January 2025"
    >
      <h2>1. Introduction</h2>
      <p>
        AbiaConnect is committed to protecting your personal information. This Privacy Policy
        explains what data we collect, why we collect it, how we use it, and the rights you have
        over it. By using AbiaConnect you agree to the practices described in this policy.
      </p>

      <h2>2. Information We Collect</h2>
      <ul>
        <li><strong>Account information:</strong> name, email, date of birth, and LGA of origin provided at registration.</li>
        <li><strong>Profile information:</strong> avatar, bio, username, and any other details you choose to share.</li>
        <li><strong>Usage data:</strong> pages visited, features used, and content interactions.</li>
        <li><strong>Device information:</strong> browser type and IP address, used for security and abuse prevention.</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To operate and improve the platform.</li>
        <li>To send account notifications you have asked for.</li>
        <li>To personalise your experience on AbiaConnect.</li>
        <li>To enforce our Community Guidelines.</li>
        <li>To prevent fraud, abuse, and security incidents.</li>
      </ul>

      <h2>4. What We Do Not Do</h2>
      <ul>
        <li>We do not sell personal data.</li>
        <li>We do not share data with advertisers.</li>
        <li>We do not use data for targeted advertising.</li>
        <li>We do not share private messages except where required by law.</li>
      </ul>

      <h2>5. Data Storage and Security</h2>
      <p>
        Your data is stored securely on Supabase infrastructure with industry-standard encryption
        in transit and at rest. Access is restricted to authorised team members on a need-to-know
        basis. We perform regular security reviews and monitor for unauthorised access.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use essential cookies only — to maintain your login session and remember your theme
        preference. We do not use advertising cookies. See our Cookie Policy for full details.
      </p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate information.</li>
        <li>Request deletion of your account and data.</li>
        <li>Export your data in a portable format.</li>
        <li>Withdraw consent at any time.</li>
      </ul>
      <p>To exercise any of these rights, contact <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a>.</p>

      <h2>8. Changes to This Policy</h2>
      <p>
        Members will be notified of significant changes via email and an on-site notice at least
        14 days before changes take effect.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about this policy? Email{' '}
        <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a>.
      </p>
    </StaticPage>
  )
}
