import StaticPage from '@/components/layout/StaticPage'

export default function PrivacyPolicy() {
  return (
    <StaticPage badge="Legal" title="Privacy Policy" subtitle="Last updated: June 2025">
      <p>
        AbiaConnect ("we", "our", "us") is committed to protecting your privacy. This Privacy
        Policy explains how we collect, use, store, and protect your personal information when you
        use abiaconnect.com.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        <strong>Account information:</strong> When you register, we collect your name, email
        address, username, date of birth, and Local Government Area of origin.
      </p>
      <p>
        <strong>Profile information:</strong> Display name, profile picture, and biography that
        you voluntarily provide.
      </p>
      <p>
        <strong>Usage data:</strong> Pages visited, threads posted, replies made, votes cast, and
        features used. This data is used in aggregate to improve the platform.
      </p>
      <p>
        <strong>Device information:</strong> Browser type, operating system, and IP address,
        collected automatically for security and analytics purposes.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To create and manage your account.</li>
        <li>To display your profile to other community members.</li>
        <li>To send you notifications about activity relevant to your account.</li>
        <li>To send important platform updates and announcements.</li>
        <li>To investigate reports, enforce our guidelines, and maintain platform safety.</li>
        <li>To improve AbiaConnect's features and user experience.</li>
      </ul>
      <p><strong>We do not sell your personal data to third parties. Ever.</strong></p>

      <h2>3. Information Sharing</h2>
      <p>We share your information only in these limited circumstances:</p>
      <ul>
        <li>
          <strong>With other community members:</strong> your display name, username, profile
          picture, and public posts are visible to all AbiaConnect members.
        </li>
        <li>
          <strong>With service providers:</strong> we use Supabase for database and authentication
          services. They process data on our behalf under strict data protection terms.
        </li>
        <li>
          <strong>When required by law:</strong> we will disclose information if required by a valid
          legal process or to protect the safety of our users or the public.
        </li>
      </ul>

      <h2>4. Data Storage and Security</h2>
      <p>
        Your data is stored on secure servers provided by Supabase, with data centres in compliance
        with international security standards. We use encryption in transit (HTTPS) and at rest.
        We limit access to personal data to authorised team members only.
      </p>

      <h2>5. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate data</li>
        <li>Request deletion of your account and data</li>
        <li>Withdraw consent for optional data processing</li>
        <li>Lodge a complaint with a data protection authority</li>
      </ul>
      <p>
        To exercise any of these rights, contact:{' '}
        <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a>
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use essential cookies to keep you logged in and remember your preferences. See our{' '}
        <a href="/cookie-policy">Cookie Policy</a> for full details.
      </p>

      <h2>7. Children's Privacy</h2>
      <p>
        AbiaConnect is not intended for children under 13. We do not knowingly collect data from
        anyone under 13. If we become aware of such data, we will delete it promptly.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. We will notify registered members of any
        material changes by posting a notice on the platform.
      </p>

      <h2>9. Contact</h2>
      <p>
        For privacy-related questions:{' '}
        <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a>
      </p>
    </StaticPage>
  )
}
