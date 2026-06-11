import StaticPage from '@/components/layout/StaticPage'

const STANDARDS = [
  {
    icon: '🗣️',
    title: 'Honest Discourse',
    body: 'We speak truth even when it is uncomfortable. We cite evidence. We acknowledge when we are wrong. We do not spread rumours or manipulate information for personal or political gain.',
  },
  {
    icon: '🤲',
    title: 'Generous Contribution',
    body: 'The best communities give more than they take. Share your knowledge, your experience, and your connections freely. A community where everyone gives is a community where everyone benefits.',
  },
  {
    icon: '🌍',
    title: 'Diaspora Solidarity',
    body: 'For Abians abroad, this platform is a piece of home. We welcome and support members of the diaspora with patience and understanding of the unique challenges they face — homesickness, cultural distance, and the pressure to bridge two worlds.',
  },
  {
    icon: '👂',
    title: 'Active Listening',
    body: 'Before responding, read carefully. Before criticising, understand. We practice active listening — seeking to understand before seeking to be understood.',
  },
  {
    icon: '🏆',
    title: 'Celebrating Excellence',
    body: 'When an Abian achieves something remarkable, we celebrate it loudly. AbiaConnect is a platform for amplifying Abian excellence in every field.',
  },
  {
    icon: '🔧',
    title: 'Constructive Criticism',
    body: 'Criticism of government, institutions, businesses, and ideas is healthy and welcome. All criticism must be constructive, evidence-based, and solution-oriented. We do not criticise to tear down — we criticise to build up.',
  },
  {
    icon: '🛡️',
    title: 'Protecting the Vulnerable',
    body: 'We are especially protective of young members, women facing harassment, and anyone sharing personal difficulties. If you see a member being targeted, speak up or use the report function. We look out for each other.',
  },
  {
    icon: '🌱',
    title: 'Long-term Thinking',
    body: 'We consider the long-term health of our community in every decision we make. Short-term outrage and clickbait culture have no place here. We build for the Abia of tomorrow.',
  },
]

export default function CommunityStandards() {
  return (
    <StaticPage
      badge="Standards"
      title="Community Standards"
      subtitle="The values and behaviours that make AbiaConnect a great community."
    >
      <p>
        Our Community Standards go deeper than rules. They describe the kind of community we are
        building together — one that reflects the best of Abia State's people: resilient, generous,
        proud, and forward-looking.
      </p>

      <h2>Who We Are As a Community</h2>
      <p>
        AbiaConnect is not just a website. It is a representation of Abia people in the digital
        world. Every post, reply, and interaction reflects on all of us. We hold ourselves to a
        high standard because Abia deserves it.
      </p>

      <h2>Our Standards</h2>
      <div className="not-prose grid sm:grid-cols-2 gap-4 my-6">
        {STANDARDS.map((s) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="text-3xl mb-3">{s.icon}</div>
            <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </StaticPage>
  )
}
