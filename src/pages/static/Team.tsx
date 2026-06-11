import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

const TEAM = [
  {
    name: 'Chukwuemeka Obi',
    role: 'Founder & CEO',
    lga: 'Aba North',
    bio: 'Serial entrepreneur and software engineer with 12 years building community platforms. Emeka started AbiaConnect after struggling to find reliable information about Abia as a member of the diaspora.',
  },
  {
    name: 'Adaeze Nnaji',
    role: 'Head of Community',
    lga: 'Umuahia South',
    bio: 'A trained sociologist and community organiser, Ada ensures every member feels welcome and every conversation stays constructive. She is the heartbeat of our moderation team.',
  },
  {
    name: 'Ikechukwu Mba',
    role: 'Lead Engineer',
    lga: 'Ohafia',
    bio: 'Full-stack developer and open-source contributor. Ike architects the platform that keeps AbiaConnect fast, secure, and reliable for thousands of concurrent users.',
  },
  {
    name: 'Chidinma Ezeh',
    role: 'Content & Culture Lead',
    lga: 'Arochukwu',
    bio: 'Journalist and cultural researcher. Chidinma ensures AbiaConnect reflects authentic Abia identity in every piece of content, from community guidelines to cultural features.',
  },
  {
    name: 'Obinna Kalu',
    role: 'Business Development',
    lga: 'Bende',
    bio: 'Former investment banker turned startup builder. Obinna manages partnerships, sponsorships, and opportunities that help Abian businesses grow through the platform.',
  },
  {
    name: 'Ngozi Ibe',
    role: 'User Experience Designer',
    lga: 'Isiala Ngwa North',
    bio: 'UX designer with a passion for accessible, inclusive digital experiences. Ngozi ensures AbiaConnect is easy to use for members of all ages and technical backgrounds.',
  },
]

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export default function Team() {
  return (
    <StaticPage
      badge="The People Behind AbiaConnect"
      title="Meet Our Team"
      subtitle="A passionate group of Abians building something meaningful for our people."
    >
      <p>
        AbiaConnect is built and maintained by a lean, dedicated team of Abians who believe deeply
        in the power of community. We are developers, writers, community managers, and cultural
        advocates — united by love for our state.
      </p>

      <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-3 gap-5 my-8">
        {TEAM.map((m) => (
          <div
            key={m.name}
            className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground flex items-center justify-center text-xl font-bold mb-3">
              {initials(m.name)}
            </div>
            <h3 className="font-semibold text-foreground">{m.name}</h3>
            <p className="text-sm text-secondary font-medium">{m.role}</p>
            <p className="text-xs text-muted-foreground mb-3">{m.lga}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{m.bio}</p>
          </div>
        ))}
      </div>

      <div className="not-prose text-center pt-4">
        <p className="text-muted-foreground mb-3">
          Want to join the team? We're always looking for passionate Abians.
        </p>
        <Button asChild>
          <Link to="/careers">View Open Positions</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
