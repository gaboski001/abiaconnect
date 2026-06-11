import StaticPage from '@/components/layout/StaticPage'

const JOBS = [
  {
    title: 'Senior React Developer',
    type: 'Full-time',
    location: 'Remote',
    summary:
      'We are looking for an experienced React/TypeScript developer to help scale the AbiaConnect platform. You will work on new features, performance optimisation, and the mobile experience.',
    reqs: '3+ years React, TypeScript, Supabase or similar BaaS, state management, strong communication skills.',
  },
  {
    title: 'Community Moderator — Abia State',
    type: 'Part-time',
    location: 'Remote (Abia State preferred)',
    summary:
      'Help maintain the quality and safety of our community discussions. You will review reported content, enforce guidelines, and support members in having productive conversations.',
    reqs: 'Strong written English, knowledge of Abia State communities, patience, fairness, and attention to detail.',
  },
  {
    title: 'Content Writer — Abia Culture & News',
    type: 'Freelance',
    location: 'Remote',
    summary:
      'Research and write engaging articles, success stories, and cultural features for the AbiaConnect editorial section.',
    reqs: 'Strong writing skills, journalism or communications background, deep knowledge of Abia State culture and current affairs.',
  },
  {
    title: 'Business Development Associate',
    type: 'Part-time',
    location: 'Remote',
    summary:
      'Identify and develop partnership opportunities with Abia businesses, government agencies, and diaspora organisations.',
    reqs: 'Sales or partnership experience, strong network in Abia business community, self-motivated.',
  },
]

export default function Careers() {
  return (
    <StaticPage
      badge="Join Us"
      title="Careers at AbiaConnect"
      subtitle="Help us build the most important community platform for Abia State."
    >
      <p>
        We are a remote-first team of Abians building something we genuinely believe in. If you are
        talented, community-minded, and want your work to have real impact on Abia State, we want
        to hear from you.
      </p>

      <h2>What We Offer</h2>
      <ul>
        <li>Fully remote work — contribute from anywhere in the world</li>
        <li>Flexible hours built around your life</li>
        <li>Meaningful work with visible community impact</li>
        <li>A team that understands and respects Abia culture</li>
        <li>Competitive compensation for the right candidates</li>
        <li>Equity participation for core team members</li>
      </ul>

      <h2>Open Positions</h2>
      <div className="not-prose space-y-4 my-6">
        {JOBS.map((j) => (
          <div
            key={j.title}
            className="rounded-lg border border-border border-l-4 border-l-secondary bg-card p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-lg text-foreground">{j.title}</h3>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{j.type}</span> · {j.location}
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{j.summary}</p>
            <p className="text-sm">
              <span className="font-semibold text-foreground">Requirements: </span>
              <span className="text-muted-foreground">{j.reqs}</span>
            </p>
          </div>
        ))}
      </div>

      <h2>How to Apply</h2>
      <p>
        Send your CV, a brief cover letter explaining why you care about AbiaConnect, and any
        relevant work samples to:{' '}
        <a href="mailto:careers@abiaconnect.com">careers@abiaconnect.com</a>
      </p>
      <p>We review every application personally. We will respond within 14 working days.</p>

      <p className="text-sm">
        <em>
          Note: We are an equal opportunity team. We especially encourage applications from women,
          persons with disabilities, and candidates from underrepresented LGAs in Abia State.
        </em>
      </p>
    </StaticPage>
  )
}
