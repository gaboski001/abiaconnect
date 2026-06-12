import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

const ROLES = [
  {
    title: 'Community Moderator',
    type: 'Volunteer',
    location: 'Remote Nigeria or Diaspora',
    desc: 'Help maintain a respectful, safe forum environment. Review reported content, apply community standards, and support members. Requires 5-8 hours per week and genuine commitment to Abia community values.',
  },
  {
    title: 'Content Writer',
    type: 'Volunteer',
    location: 'Remote',
    desc: 'Write news summaries, member spotlights, and editorial pieces about Abia State. Strong written English and knowledge of current Abia affairs required.',
  },
  {
    title: 'Social Media Coordinator',
    type: 'Volunteer',
    location: 'Remote',
    desc: "Manage AbiaConnect's presence on Instagram, X (Twitter), and Facebook. Creative, consistent, and community-minded candidates preferred.",
  },
  {
    title: 'Frontend Developer',
    type: 'Contract',
    location: 'Remote',
    desc: 'Help build and improve the AbiaConnect web platform. React, TypeScript, and Tailwind CSS experience required. Abia State origin preferred but not mandatory.',
  },
]

export default function Careers() {
  return (
    <StaticPage
      badge="Join Us"
      title="Careers and Volunteering"
      subtitle="Help us build the future of Abia's digital community."
    >
      <p>
        AbiaConnect is a community-first platform. Most of our team members contribute voluntarily,
        driven by love for Abia State. We occasionally bring on paid contractors for specialised
        work. Whether you want to volunteer your skills or explore a paid engagement, we'd love to
        hear from you.
      </p>

      <h2>Current Openings</h2>
      <div className="not-prose space-y-4 my-6">
        {ROLES.map((r) => (
          <div key={r.title} className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 transition-colors">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground text-lg">{r.title}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${r.type === 'Contract' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/15 text-secondary border-secondary/30'}`}>
                {r.type}
              </span>
              <span className="text-xs text-muted-foreground">• {r.location}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.desc}</p>
            <Button asChild size="sm">
              <a href={`mailto:careers@abiaconnect.com?subject=Application: ${r.title}`}>Apply Now</a>
            </Button>
          </div>
        ))}
      </div>

      <h2>How to Apply</h2>
      <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        {[
          { n: '1', t: 'Send Your CV', d: 'Email your CV and a short note about why you want to contribute.' },
          { n: '2', t: 'Intro Call', d: 'Introductory call with our team (30 minutes).' },
          { n: '3', t: 'Trial & Onboarding', d: 'Two-week trial period then full onboarding.' },
        ].map((s) => (
          <div key={s.n} className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold flex items-center justify-center mb-3">
              {s.n}
            </div>
            <h3 className="font-semibold text-foreground mb-1">{s.t}</h3>
            <p className="text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>

      <h2>Team Values</h2>
      <p>
        AbiaConnect expects every team member to embody patience, cultural sensitivity, and
        genuine care for people. AbiaConnect is not a hustle — it is a service.
      </p>
    </StaticPage>
  )
}
