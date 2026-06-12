import StaticPage from '@/components/layout/StaticPage'
import { Heart, ShieldCheck, Users, MessageSquare, Lock, TrendingUp } from 'lucide-react'

const VALUES = [
  { icon: Heart, name: 'Community First', body: 'Every decision prioritises the wellbeing and growth of our members over any commercial interest.' },
  { icon: ShieldCheck, name: 'Safety and Respect', body: 'We enforce strict standards of conduct to ensure AbiaConnect remains a dignified space for all.' },
  { icon: Users, name: 'Inclusive Representation', body: 'All 17 LGAs, all age groups, all professions, and all genders are equally valued here.' },
  { icon: MessageSquare, name: 'Freedom of Expression', body: "We protect members' right to speak freely on matters of public interest, within the bounds of mutual respect." },
  { icon: Lock, name: 'Privacy and Trust', body: 'We do not sell member data. Your information belongs to you, always.' },
  { icon: TrendingUp, name: 'Continuous Growth', body: 'We listen to our community and improve the platform based on member feedback, not trends.' },
]

export default function Mission() {
  return (
    <StaticPage
      badge="What We Stand For"
      title="Our Mission and Vision"
      subtitle="What drives us, what we stand for, and where we are going."
    >
      <blockquote className="not-prose border-l-4 border-secondary bg-secondary/8 rounded-r-xl px-6 py-5 italic text-foreground/90 text-lg my-6">
        “To build the most trusted, inclusive, and impactful digital community for Abia State
        indigenes — empowering every Abian to connect, contribute, and create positive change from
        wherever they are in the world.”
      </blockquote>

      <h2>Our Vision</h2>
      <p>
        We envision an Abia State where geography is no longer a barrier to opportunity. Where a
        farmer in Ugwunagbo can connect with an agricultural exporter in the diaspora. Where a
        young programmer in Ohafia can find a mentor in Silicon Valley. Where our elders' wisdom
        and our youth's innovation meet in one shared digital space.
      </p>
      <p>AbiaConnect will be the infrastructure of that connection.</p>

      <h2>Our Core Values</h2>
      <div className="not-prose space-y-3 my-6">
        {VALUES.map(({ icon: Icon, name, body }) => (
          <div key={name} className="flex gap-4 bg-card border border-border rounded-2xl p-5 hover:border-secondary/40 transition-colors">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground">
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold text-foreground">{name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>What We Commit To You</h2>
      <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-2">To Members</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A safe, welcoming space. Fair moderation. Your data protected. A platform that grows
            with your needs.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-2">To Abia State</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Positive representation of our people. Amplifying Abia achievements. Supporting local
            businesses and governance accountability.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-2">To the Diaspora</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A reliable bridge to home. Verified information. Investment opportunities. Cultural
            continuity for your children.
          </p>
        </div>
      </div>
    </StaticPage>
  )
}
