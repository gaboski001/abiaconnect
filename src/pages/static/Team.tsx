import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

const TEAM = [
  { name: 'Okechukwu Gabriel E.', role: 'Founder and Platform Lead', lga: 'Bende', bio: 'Gabriel has spent 12 years in software product development across Lagos and London. He returned his skills to his roots by founding AbiaConnect in 2024.' },
  { name: 'Adaeze Nwosu', role: 'Community Manager', lga: 'Aba South', bio: 'Ada oversees community health, member support, and moderation policy. She previously managed online communities for two Nigerian media companies.' },
  { name: 'Ikechukwu Eze', role: 'Lead Developer', lga: 'Bende', bio: 'Ike architected the AbiaConnect platform infrastructure. He is a full-stack engineer with experience at startups in Lagos and Nairobi.' },
  { name: 'Ngozi Obi', role: 'Content and Communications', lga: 'Ohafia', bio: "Ngozi leads editorial strategy, ensuring AbiaConnect's voice is warm, credible, and authentically Abian." },
  { name: 'Obinna Kalu', role: 'Partnerships and Business', lga: 'Arochukwu', bio: 'Obinna connects AbiaConnect with businesses, NGOs, and government agencies to bring real opportunities to the community.' },
  { name: 'Chioma Iheme', role: 'Design Lead', lga: 'Isiala Ngwa North', bio: "Chioma is responsible for AbiaConnect's visual identity — every pixel reflects her commitment to an interface that feels both modern and deeply Nigerian." },
]

export default function Team() {
  return (
    <StaticPage
      badge="The People"
      title="The AbiaConnect Team"
      subtitle="The people committed to building and maintaining this community."
    >
      <p>
        AbiaConnect is powered by a passionate team of Abia indigenes who volunteered their skills,
        time, and resources to build something lasting for our people. We come from different LGAs,
        different professions, and different parts of the world — united by a shared love for Abia
        State.
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
          writer, moderator, or connector — there is a role for you here.
        </p>
        <Button asChild>
          <Link to="/careers">View Open Roles</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
