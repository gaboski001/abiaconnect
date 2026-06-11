import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

export default function Events() {
  return (
    <StaticPage
      badge="Community"
      title="Events Calendar"
      subtitle="Cultural, civic, and business happenings across Abia State and the diaspora."
    >
      <p>
        AbiaConnect events are discussed and announced directly within our community forum, where
        members can ask questions, RSVP, and connect with other attendees.
      </p>
      <p>
        From New Yam Festival celebrations in Arochukwu and Ohafia, to ABSU alumni reunions,
        diaspora town halls in London and Houston, and business mixers in Aba — our community keeps
        you informed about what matters.
      </p>

      <h2>How to Find Events</h2>
      <ul>
        <li>Browse the latest event threads in the community forum</li>
        <li>Join LGA or interest-based subgroups for hyper-local events</li>
        <li>Follow members who regularly organise gatherings</li>
        <li>Watch the homepage announcements for major community-wide events</li>
      </ul>

      <h2>Organising Your Own Event?</h2>
      <p>
        Members are warmly invited to post their own Abia-related events. Use a clear title, the
        date and location, and a short description of what attendees can expect.
      </p>

      <div className="not-prose flex flex-wrap gap-3 pt-4">
        <Button asChild>
          <Link to="/">Browse the Forum</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/register">Join AbiaConnect Free</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
