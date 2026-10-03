import { Link } from 'react-router-dom'
import StaticPage from '@/components/layout/StaticPage'

/**
 * Public child safety standards (required by Google Play for social and
 * dating apps): zero tolerance for child sexual abuse and exploitation
 * (CSAE), how we prevent it, how to report it, what we do, and who to contact.
 */
export default function ChildSafetyStandards() {
  return (
    <StaticPage badge="Safety" title="Child Safety Standards" subtitle="AbiaConnect · Last updated: 4 October 2026">
      <p>
        AbiaConnect (the AbiaConnect website and apps, published by AbiaConnect) has <strong>zero tolerance</strong> for child
        sexual abuse and exploitation (CSAE) and child sexual abuse material (CSAM). These standards apply to every member,
        everywhere on AbiaConnect: forums, groups, profiles, private messages, calls and relationship features.
      </p>

      <h2>1. What is prohibited</h2>
      <ul>
        <li>Any sexual content involving a person under 18, including drawings, edited or AI-generated images.</li>
        <li>Grooming: building a relationship with a child to sexually abuse or exploit them, online or offline.</li>
        <li>Sexualising children in words, images, comments or "jokes".</li>
        <li>Sextortion: threatening or pressuring a child to share sexual images or money.</li>
        <li>Child trafficking, or offering, seeking or advertising children for sexual purposes.</li>
        <li>Sharing links to, or asking for, any such material.</li>
      </ul>

      <h2>2. How we prevent it</h2>
      <ul>
        <li>AbiaConnect is not for children under 13. Relationship features are for adults aged 18 and over only.</li>
        <li>
          Our automated moderator, Ugo, checks posts, replies and messages for harmful content before and after they are
          posted, alongside our human safety team.
        </li>
        <li>Uploaded files are scanned, and members can block anyone and control who can message them.</li>
        <li>Accounts that break these standards are banned, and we act to stop them coming back.</li>
      </ul>

      <h2>3. How to report a concern</h2>
      <ul>
        <li>
          <strong>In the app or website:</strong> open the menu, go to <strong>Help</strong> → <strong>Report a problem</strong>{' '}
          (or <Link to="/report-issue">abiaconnect.com/report-issue</Link>), choose the reason{' '}
          <strong>"Child safety"</strong>, and describe or link what you saw. Child safety reports go to the top of our
          safety team's queue.
        </li>
        <li>
          <strong>By email:</strong> <a href="mailto:support@abiaconnect.com?subject=Child%20safety%20report">support@abiaconnect.com</a>{' '}
          with the subject "Child safety report".
        </li>
        <li>
          <strong>If a child is in immediate danger,</strong> contact the police or local emergency services first.
        </li>
      </ul>

      <h2>4. What we do when we receive a report</h2>
      <ul>
        <li>We review child safety reports as our highest priority.</li>
        <li>We remove CSAE content and CSAM as soon as we find it and suspend or ban the accounts involved.</li>
        <li>
          We report child sexual abuse material and exploitation to the relevant authorities, including the National Center
          for Missing &amp; Exploited Children (NCMEC) CyberTipline and, in Nigeria, the National Agency for the Prohibition
          of Trafficking in Persons (NAPTIP) and the Nigeria Police Force, and we cooperate with law enforcement requests.
        </li>
        <li>We preserve information as required by law to support investigations.</li>
      </ul>

      <h2>5. Compliance with the law</h2>
      <p>
        We comply with child safety laws that apply to us, including Nigeria's Child Rights Act 2003, the Cybercrimes
        (Prohibition, Prevention, etc.) Act 2015 and the Trafficking in Persons (Prohibition) Enforcement and Administration
        Act, as well as the laws of the countries where AbiaConnect is available.
      </p>

      <h2>6. Child safety point of contact</h2>
      <p>
        Okechukwu Gabriel E., Founder &amp; CEO, AbiaConnect
        <br />
        Email: <a href="mailto:support@abiaconnect.com">support@abiaconnect.com</a>
      </p>
      <p>
        See also our <Link to="/community-standards">Community Standards</Link> and{' '}
        <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>
    </StaticPage>
  )
}
