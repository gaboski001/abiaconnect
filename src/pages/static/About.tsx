import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

export default function About() {
  return (
    <StaticPage
      badge="Our Story"
      title="About AbiaConnect"
      subtitle="Born from a deep love for Abia State and its people — wherever they are in the world."
    >
      <h2>Who We Are</h2>
      <p>
        AbiaConnect is the leading digital community platform for Abia State indigenes, residents,
        and friends of Abia — both at home and across the global diaspora. We are more than a forum.
        We are a living, breathing connection between the people of the Lion State: a space where
        ideas are exchanged, businesses are born, cultures are celebrated, and voices are heard.
      </p>
      <p>
        Founded with the belief that geography should never disconnect us from our roots,
        AbiaConnect brings together Abians from Aba to Arochukwu, from Umuahia to London, from
        Ohafia to Houston — under one digital roof.
      </p>

      <h2>Our Community</h2>
      <p>
        Today, AbiaConnect is home to thousands of registered members across every Local Government
        Area in Abia State and beyond. Our community includes:
      </p>
      <ul>
        <li>Entrepreneurs and traders from the famous Ariaria International Market</li>
        <li>Students and academics from ABSU, Abia State Polytechnic, and universities worldwide</li>
        <li>Government officials, civil servants, and policy advocates</li>
        <li>Farmers, agripreneurs, and rural community leaders</li>
        <li>Professionals in medicine, law, technology, and finance</li>
        <li>Artists, musicians, and cultural custodians</li>
        <li>Mothers, fathers, and youth who simply love where they come from</li>
      </ul>

      <h2>What We Offer</h2>
      <p>
        AbiaConnect provides a safe, moderated space to discuss, discover, and connect.{' '}
        <strong>Discussion Forums</strong> covering politics, business, culture, health, education,
        agriculture, technology, and everyday life. <strong>Community Subgroups</strong> for
        specific interests, LGAs, professions, and diaspora regions. <strong>Community Polls</strong>{' '}
        to capture the authentic voice of Abia people on important matters.{' '}
        <strong>Private Messaging</strong> for direct connections between members.{' '}
        <strong>Events Calendar</strong> to keep you informed of cultural, civic, and business
        happenings. <strong>Success Stories</strong> to amplify and celebrate Abian excellence.
      </p>

      <h2>Our Values</h2>
      <ul>
        <li><strong>Respect:</strong> Every member deserves to be heard with dignity.</li>
        <li><strong>Authenticity:</strong> We celebrate genuine Abia identity — language, culture, and heritage.</li>
        <li><strong>Progress:</strong> We believe in a better Abia, built by Abians.</li>
        <li><strong>Inclusion:</strong> No LGA, no background, no profession is more welcome than another.</li>
        <li><strong>Accountability:</strong> Our community holds itself to high standards of honest discourse.</li>
      </ul>

      <h2>Join the Movement</h2>
      <p>
        Whether you are contributing to discussions, sharing your business, celebrating your
        culture, or simply staying connected with home — you belong here.
      </p>
      <p><strong>AbiaConnect. One people. One platform. One Abia.</strong></p>

      <div className="not-prose flex flex-wrap gap-3 pt-6">
        <Button asChild>
          <Link to="/register">Join AbiaConnect Free</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Explore the Forum</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
