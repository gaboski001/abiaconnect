import StaticPage from '@/components/layout/StaticPage'

const COOKIES = [
  { name: 'abiaconnect-theme', purpose: 'Remembers light/dark mode preference', duration: '1 year' },
  { name: 'sb-access-token', purpose: 'Keeps you logged in', duration: 'Session' },
  { name: 'sb-refresh-token', purpose: 'Refreshes login session securely', duration: '7 days' },
]

export default function CookiePolicy() {
  return (
    <StaticPage badge="Legal" title="Cookie Policy" subtitle="Last updated: January 2025">
      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files stored on your device by your browser when you visit a
        website. They allow the site to remember things like whether you are logged in or which
        theme you prefer. Some cookies are essential; others are used for tracking or advertising.
        AbiaConnect uses only essential cookies.
      </p>

      <h2>2. Cookies We Use</h2>
      <div className="not-prose overflow-x-auto my-4">
        <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Cookie Name</th>
              <th className="text-left px-4 py-2 font-semibold">Purpose</th>
              <th className="text-left px-4 py-2 font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.name} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs text-foreground">{c.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.purpose}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>3. Cookies We Do Not Use</h2>
      <ul>
        <li>No advertising cookies.</li>
        <li>No tracking pixels.</li>
        <li>No analytics cookies that identify individual users.</li>
      </ul>

      <h2>4. Managing Cookies</h2>
      <p>You can clear or block cookies in your browser settings:</p>
      <ul>
        <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data.</li>
        <li><strong>Firefox:</strong> Settings → Privacy &amp; Security → Cookies and Site Data.</li>
        <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data.</li>
        <li><strong>Edge:</strong> Settings → Cookies and site permissions → Manage and delete cookies.</li>
      </ul>
      <p>
        Blocking essential cookies will sign you out of AbiaConnect and may break basic platform
        functionality.
      </p>

      <h2>5. Contact</h2>
      <p>
        Questions about cookies? Email{' '}
        <a href="mailto:privacy@abiaconnect.com">privacy@abiaconnect.com</a>.
      </p>
    </StaticPage>
  )
}
