import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

const TEAM = [
  { name: 'Okechukwu Gabriel E.', role: 'Founder and CEO', lga: 'Abia State', bio: 'Gabriel founded AbiaConnect, registered in Nigeria in 2021, and designed and built the platform himself: the website, the Android app and the community tools. He also built AbiaConnect Store and FlowSocial.' },
]

export default function Team() {
  return (
    <StaticPage
      badge="The People"
      title="The AbiaConnect Team"
      subtitle="The people committed to building and maintaining this community."
    >
      <p>
        AbiaConnect was founded and built by Okechukwu Gabriel E. and is growing with the help of
        Abians who give their time and skills to build something lasting for our people. If you
        share that love for Abia State, there is a place for you on the team.
      </p>

      <div className="not-prose grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-8">
        {TEAM.map((m) => (
          <div key={m.name} className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-secondary font-bold text-xl">
                {m.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h2 className="font-semibold text-foreground leading-tight">{m.name}</h2>
                <p className="text-sm text-muted-foreground">{m.role}</p>
              </div>
            </div>
            <span className="inline-block text-xs font-medium bg-secondary/15 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full mb-3">
              {m.lga}
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">{m.bio}</p>
          </div>
        ))}
      </div>

      <div className="not-prose bg-card border-2 border-secondary rounded-2xl p-8 text-center my-8">
        <h2 className="text-xl font-bold text-foreground mb-2">Want to Contribute?</h2>
        <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
          AbiaConnect welcomes volunteers who share our mission. Whether you are a developer,
          writer, moderator, or connector — there is a role for you here. Fill in a short
          application and our team will review it and reply by email.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/volunteer">Apply to Volunteer</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/careers">View Open Roles</Link>
          </Button>
        </div>
      </div>
    </StaticPage>
  )
}
