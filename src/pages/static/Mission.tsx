import StaticPage from '@/components/layout/StaticPage'

const PILLARS = [
  {
    icon: '🤝',
    title: 'Connect',
    body: 'Bridging the gap between Abians at home and in the diaspora. Strengthening the social fabric that holds our communities together across geography and generation.',
  },
  {
    icon: '💡',
    title: 'Inform',
    body: 'Providing timely, accurate, community-sourced information on matters that affect Abia State — from government policy to market prices, from scholarship opportunities to health advisories.',
  },
  {
    icon: '📈',
    title: 'Empower',
    body: 'Amplifying Abian businesses, voices, and ideas. Creating pathways for economic participation, professional growth, and entrepreneurial success.',
  },
  {
    icon: '🏛️',
    title: 'Preserve',
    body: 'Protecting and celebrating Igbo culture, Abia heritage, and the traditions that define who we are — ensuring they are passed to future generations.',
  },
]

export default function Mission() {
  return (
    <StaticPage
      badge="Why We Exist"
      title="Our Mission & Vision"
      subtitle="A clear purpose drives everything we build at AbiaConnect."
    >
      <h2>Mission Statement</h2>
      <blockquote className="text-xl md:text-2xl font-medium border-l-4 border-secondary pl-6 italic">
        “To create the most trusted, vibrant, and inclusive digital community for Abia State —
        empowering every Abian to connect, contribute, and thrive.”
      </blockquote>

      <h2>Vision Statement</h2>
      <blockquote className="text-lg border-l-4 border-primary pl-6 italic">
        “A future where every Abian — regardless of location, background, or circumstance — has
        access to community, opportunity, and a voice in shaping the story of Abia State.”
      </blockquote>

      <h2>Our Strategic Pillars</h2>
      <div className="not-prose grid sm:grid-cols-2 gap-4 my-6">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="text-3xl mb-3">{p.icon}</div>
            <h3 className="font-semibold text-lg text-foreground mb-2">{p.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      <h2>What Success Looks Like For Us</h2>
      <p>
        AbiaConnect measures its success not in numbers alone, but in outcomes: a trader in Ariaria
        who found an export buyer through our Business forum. A student in Uturu who secured a
        scholarship posted by a community member. An Abian in London who reconnected with their LGA
        through our Diaspora subgroup. A village in Ukwa East that received attention for their
        road project because someone posted about it here and it went viral within the community.
      </p>
      <p>These are the stories that drive us.</p>
    </StaticPage>
  )
}
