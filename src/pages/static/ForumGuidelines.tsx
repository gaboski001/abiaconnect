import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

export default function ForumGuidelines() {
  return (
    <StaticPage
      badge="Community Rules"
      title="Forum Guidelines"
      subtitle="Rules that keep AbiaConnect a safe, respectful, and productive community."
    >
      <p>
        AbiaConnect exists because we believe Abia people deserve a dignified online space. These
        guidelines are not restrictions — they are the foundation of the trust that makes this
        community work. By registering, every member agrees to uphold them.
      </p>

      <h2>The Golden Rule</h2>
      <blockquote className="not-prose border-l-4 border-secondary bg-secondary/8 rounded-r-xl px-6 py-5 italic text-foreground/90 text-lg my-6">
        “Treat every member the way you would treat a respected elder or a beloved younger
        sibling. Dignity, always.”
      </blockquote>

      <h2>What Is Encouraged</h2>
      <ul>
        <li>Constructive debate</li>
        <li>Sharing personal experiences</li>
        <li>Promoting legitimate businesses</li>
        <li>Asking for help</li>
        <li>Celebrating others</li>
        <li>Respectful disagreement</li>
        <li>Reporting violations</li>
      </ul>

      <h2>What Is Never Permitted</h2>
      <ul>
        <li>Hate speech</li>
        <li>Ethnic slurs</li>
        <li>Personal attacks</li>
        <li>Threats</li>
        <li>Harassment</li>
        <li>Sharing false information</li>
        <li>Spam</li>
        <li>Pyramid schemes</li>
        <li>Sharing private information without consent</li>
        <li>Content that sexualises minors</li>
        <li>Fake accounts</li>
        <li>Impersonation</li>
      </ul>

      <h2>Political Discussion Policy</h2>
      <p>
        We welcome honest discussion of politics and governance. AbiaConnect does not endorse any
        political party or candidate. Members may express political opinions but must do so
        respectfully. Spreading unverified electoral information, inciting violence, or using the
        platform for coordinated political campaigns is prohibited.
      </p>

      <h2>Enforcement Tiers</h2>
      <div className="not-prose space-y-3 my-6">
        {[
          { t: 'Tier 1 — Warning', d: 'First-time minor violations receive a written warning.' },
          { t: 'Tier 2 — Temporary Suspension', d: 'Repeated or moderate offences result in 7–30 day suspension.' },
          { t: 'Tier 3 — Permanent Ban', d: 'Severe violations result in immediate permanent removal.' },
        ].map((e) => (
          <div key={e.t} className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground">{e.t}</h3>
            <p className="text-sm text-muted-foreground mt-1">{e.d}</p>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          All decisions can be appealed:{' '}
          <a href="mailto:moderation@abiaconnect.com" className="text-secondary hover:underline">
            moderation@abiaconnect.com
          </a>
        </p>
      </div>

      <div className="not-prose pt-4">
        <Button asChild>
          <Link to="/report-issue">Report an Issue</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
