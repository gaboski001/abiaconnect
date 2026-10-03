import { Link } from 'react-router-dom'
import StaticPage from '@/components/layout/StaticPage'

/**
 * Public account deletion page (required by Google Play for apps with
 * sign-up). Explains how to delete an AbiaConnect account in the app or
 * website, how to ask by email, and what is deleted or kept.
 */
export default function DeleteAccount() {
  return (
    <StaticPage badge="Account" title="Delete your AbiaConnect account" subtitle="AbiaConnect, by Abiaconnect (Okechukwu Gabriel E.)">
      <p>
        You can permanently delete your AbiaConnect account and its data at any time, from the app or the website. If you
        can't sign in, you can ask us by email instead.
      </p>

      <h2>1. Delete it yourself (fastest)</h2>
      <ol>
        <li>
          Sign in on the AbiaConnect app or at <Link to="/login">abiaconnect.com</Link>.
        </li>
        <li>
          Open <strong>Dashboard</strong>, then <strong>Settings</strong>.
        </li>
        <li>
          Scroll to <strong>Delete Account</strong>, tap it, type <strong>DELETE</strong> and confirm.
        </li>
      </ol>
      <p>Your account is deleted immediately and you are signed out.</p>

      <h2>2. Ask us by email</h2>
      <p>
        Email <a href="mailto:support@abiaconnect.com?subject=Delete%20my%20AbiaConnect%20account">support@abiaconnect.com</a>{' '}
        from the email address of your account, with the subject <strong>"Delete my AbiaConnect account"</strong>. We confirm
        it is your account and delete it within 7 days.
      </p>

      <h2>3. What is deleted</h2>
      <ul>
        <li>Your sign-in account, email address, password and date of birth</li>
        <li>Your profile, photo, bio and dating/relationship profile</li>
        <li>Your private messages, call history, notifications and device notification tokens</li>
        <li>Your group memberships, saved threads, votes, points and badges</li>
      </ul>

      <h2>4. What may be kept</h2>
      <ul>
        <li>
          Public forum posts and replies you wrote may stay so conversations still make sense, but they are no longer linked
          to you or your profile.
        </li>
        <li>
          Records we must keep by law or for safety, such as payment records and moderation decisions, for up to 6 years,
          then deleted.
        </li>
      </ul>

      <p>
        Questions? See our <Link to="/privacy-policy">Privacy Policy</Link> or contact{' '}
        <a href="mailto:support@abiaconnect.com">support@abiaconnect.com</a>.
      </p>
    </StaticPage>
  )
}
