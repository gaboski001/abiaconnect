import StaticPage from '@/components/layout/StaticPage'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const COOKIES = [
  { name: 'sb-access-token', purpose: 'Keeps you logged in to your account', duration: 'Session', type: 'Essential' },
  { name: 'sb-refresh-token', purpose: 'Renews your login session automatically', duration: '30 days', type: 'Essential' },
  { name: 'abiaconnect-theme', purpose: 'Remembers your light/dark mode preference', duration: '1 year', type: 'Preference' },
  { name: 'abiaconnect-seeded', purpose: 'Admin: tracks if database has been seeded', duration: 'Persistent', type: 'Functional' },
]

export default function CookiePolicy() {
  return (
    <StaticPage badge="Legal" title="Cookie Policy" subtitle="Last updated: June 2025">
      <p>
        This Cookie Policy explains how AbiaConnect uses cookies and similar technologies on
        abiaconnect.com.
      </p>

      <h2>What Are Cookies</h2>
      <p>
        Cookies are small text files stored on your device by your browser when you visit a
        website. They help websites remember your preferences and provide a better experience.
      </p>

      <h2>Cookies We Use</h2>
      <div className="not-prose my-6 rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cookie Name</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COOKIES.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-mono text-xs">{c.name}</TableCell>
                <TableCell>{c.purpose}</TableCell>
                <TableCell>{c.duration}</TableCell>
                <TableCell>{c.type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h2>Types of Cookies</h2>
      <p>
        <strong>Essential Cookies:</strong> Required for the platform to function. You cannot opt
        out of these while using AbiaConnect.
      </p>
      <p>
        <strong>Preference Cookies:</strong> Remember your settings (like dark mode). You can clear
        these by resetting your browser storage.
      </p>
      <p>
        <strong>Analytics Cookies:</strong> We do not currently use third-party analytics cookies
        (like Google Analytics). If we introduce them in the future, we will update this policy and
        request your consent.
      </p>

      <h2>Your Choices</h2>
      <p>
        You can control cookies through your browser settings. Note that disabling essential
        cookies will prevent you from logging in.
      </p>
      <p>
        To clear your preferences, go to Dashboard → Settings → Clear Preferences, or clear your
        browser's local storage for abiaconnect.com.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a>
      </p>
    </StaticPage>
  )
}
