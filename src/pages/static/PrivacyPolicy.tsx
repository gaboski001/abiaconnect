import { Link } from 'react-router-dom'
import StaticPage from '@/components/layout/StaticPage'

export default function PrivacyPolicy() {
  return (
    <StaticPage badge="Legal" title="Privacy Policy" subtitle="Last updated: 3 October 2026">
      <h2>1. Introduction</h2>
      <p>
        AbiaConnect ("we", "us") runs the AbiaConnect website (abiaconnect.com) and the AbiaConnect mobile apps. This policy
        explains what personal data we collect, why, who we share it with, how long we keep it, and the choices and rights you
        have. It applies to the website and the apps alike.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li>
          <strong>Account:</strong> name, username, email address, password (stored only in encrypted, hashed form), date of
          birth and LGA of origin.
        </li>
        <li>
          <strong>Profile (optional):</strong> profile photo, bio, current city, occupation, sex and marital status.
        </li>
        <li>
          <strong>Relationship profile (optional, adults only):</strong> photos, description and preferences you add to use
          the relationship features.
        </li>
        <li>
          <strong>Content:</strong> discussions, replies, poll votes, group memberships, reports and appeals you submit.
          Discussions and replies in public forums can be seen by other members and, for some forums, by visitors.
        </li>
        <li>
          <strong>Private messages and attachments:</strong> messages you send to other members. Chat attachments are deleted
          automatically after 48 hours.
        </li>
        <li>
          <strong>Calls:</strong> voice and video calls connect directly between the two members' devices where possible, or
          through a relay server when needed. We do not record calls. We keep call details (who called whom, when and for how
          long) to show your call history.
        </li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <strong>Device and technical data:</strong> device or browser type, IP address and a notification token for your
          device, used to deliver notifications, keep accounts secure (for example new sign-in alerts) and prevent abuse.
        </li>
        <li>
          <strong>Usage data:</strong> features used and interactions such as views, votes and reactions, used to run and
          improve AbiaConnect.
        </li>
      </ul>
      <h3>App permissions</h3>
      <ul>
        <li><strong>Camera:</strong> video calls and taking photos you choose to share.</li>
        <li><strong>Microphone:</strong> voice and video calls.</li>
        <li><strong>Notifications:</strong> messages, calls, replies and account alerts.</li>
        <li>
          <strong>Fingerprint / face unlock (optional):</strong> to unlock the app. Your biometric data stays on your device;
          we never receive it.
        </li>
      </ul>
      <p>You can turn these permissions off at any time in your device settings; the related feature will stop working.</p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To create and run your account and provide forums, groups, polls, messaging, calls and events.</li>
        <li>
          To send notifications and emails: account and security emails (such as sign-up confirmation, password reset and new
          sign-in alerts), birthday wishes on your birthday, and activity notifications you can manage in settings.
        </li>
        <li>
          To keep the community safe: posts, replies and messages are checked by automated moderation (our AI moderator "Ugo")
          before or after posting, files you upload are scanned for malware, and our team reviews reports and appeals.
        </li>
        <li>
          To share selected public discussions on the AbiaConnect Facebook Page (title and link only). Anonymous discussions
          and discussions in private groups are never shared.
        </li>
        <li>To process optional premium purchases made on our website.</li>
        <li>To prevent fraud, abuse and security incidents, and to meet legal obligations.</li>
      </ul>

      <h2>4. Who we share information with</h2>
      <p>We do not sell your personal data and we do not use it for targeted advertising. We share it only with:</p>
      <ul>
        <li>
          <strong>Service providers that run AbiaConnect for us:</strong> cloud hosting and database, email delivery, push
          notifications (Google Firebase Cloud Messaging), call relay servers, malware scanning of uploaded files, automated
          content moderation (text of posts and messages being checked), and payment providers for website purchases. They
          may use the data only to provide their service to us.
        </li>
        <li>
          <strong>Other members and the public:</strong> your public profile and public posts are visible to other members as
          described above. Private messages are visible only to the people in the conversation.
        </li>
        <li>
          <strong>Authorities:</strong> when the law requires it, or to protect the safety of our members or the public.
        </li>
      </ul>
      <p>
        Payment card details are handled by the payment provider; we never see or store your full card number. Some of our
        service providers process data outside Nigeria, with appropriate safeguards.
      </p>

      <h2>5. Data security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and protected at rest. Access is limited by strict permission rules and to
        authorised team members who need it. We review our security regularly.
      </p>

      <h2>6. How long we keep your information</h2>
      <ul>
        <li>Account and profile data: until you delete your account.</li>
        <li>Chat attachments: 48 hours.</li>
        <li>Moderation, security and payment records: up to 6 years, where needed for safety or legal reasons.</li>
      </ul>

      <h2>7. Deleting your account</h2>
      <p>
        You can delete your account at any time in the app or website under Dashboard → Settings → Delete Account, or by
        email. Deleting your account removes your account, profile, private messages and other personal data. Public posts you
        wrote may remain but are no longer linked to you. See <Link to="/delete-account">Delete your account</Link> for full
        details.
      </p>

      <h2>8. Your rights</h2>
      <p>You can:</p>
      <ul>
        <li>access the personal data we hold about you;</li>
        <li>correct inaccurate information (most of it directly in your profile);</li>
        <li>delete your account and data;</li>
        <li>ask for a copy of your data in a portable format;</li>
        <li>withdraw consent, for example by turning off notifications or permissions.</li>
      </ul>
      <p>
        To use these rights, email <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a>. We reply within 30
        days.
      </p>

      <h2>9. Age requirements</h2>
      <p>
        AbiaConnect is not for children under 13, and we do not knowingly collect their data. Relationship features are only
        for adults aged 18 or over. If you believe a child has given us personal data, contact us and we will delete it.
      </p>

      <h2>10. Cookies</h2>
      <p>
        We use essential cookies and similar storage only, to keep you signed in and remember preferences such as your theme.
        We do not use advertising cookies. See our <Link to="/cookie-policy">Cookie Policy</Link>.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We will tell members about significant changes by email or an in-app notice before they take effect. The date at the
        top shows when this policy was last updated.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about privacy? Email <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a> or{' '}
        <a href="mailto:support@abiaconnect.com">support@abiaconnect.com</a>.
      </p>
    </StaticPage>
  )
}
