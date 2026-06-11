import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

export default function MemberSpotlight() {
  return (
    <StaticPage
      badge="Featured"
      title="Member Spotlight"
      subtitle="Every month we celebrate an outstanding AbiaConnect member who has made a notable contribution."
    >
      <p>
        Every month we celebrate an outstanding AbiaConnect member who has made a notable
        contribution to our community or to Abia State. Past honourees have included community
        organisers, business leaders, cultural advocates, and everyday Abians whose generosity
        makes this platform better.
      </p>

      <h2>How Nominations Work</h2>
      <p>
        Nominations are open to all registered members. To nominate someone, post in the{' '}
        <strong>Success Stories</strong> category with the hashtag{' '}
        <strong>#MemberSpotlight</strong>. Tell us:
      </p>
      <ul>
        <li>Who you are nominating (their AbiaConnect username if you know it)</li>
        <li>What they have contributed to the community or to Abia State</li>
        <li>Why they inspire you</li>
      </ul>
      <p>
        Our editorial team reviews nominations at the end of each month and announces the spotlight
        member on the first Friday of the following month.
      </p>

      <h2>The Spotlight Promise</h2>
      <p>
        Honourees receive a featured profile, a permanent badge on their account, and an invitation
        to share their story with the wider community. There is no nomination fee and no
        self-nomination required — though we welcome you to recognise others freely.
      </p>

      <div className="not-prose flex flex-wrap gap-3 pt-4">
        <Button asChild>
          <Link to="/create-thread">Submit a Nomination</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Browse the Forum</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
