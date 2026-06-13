import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'
import SafeImage from '@/components/ui/SafeImage'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { getAvatarFallback } from '@/lib/images'
import {
  MessagesSquare,
  BarChart3,
  Users,
  Mail,
  Bell,
  Trophy,
  Globe,
  MapPin,
  Landmark,
  Code2,
  Wrench,
  Rocket,
} from 'lucide-react'

const FEATURES = [
  { icon: MessagesSquare, title: 'Community Forums', body: 'Structured discussions across 14 topic categories, from business and politics to culture and faith.' },
  { icon: BarChart3, title: 'Live Polls', body: 'Real-time community polls that capture the pulse of Abia opinion on issues that matter.' },
  { icon: Users, title: 'Subgroups', body: 'Focused communities within the community — for LGAs, professions, diaspora cities, and shared interests.' },
  { icon: Mail, title: 'Private Messaging', body: 'Secure, direct messaging between members for trusted one-on-one conversations.' },
  { icon: Bell, title: 'Smart Notifications', body: 'Stay informed about replies, mentions, and community activity without noise.' },
  { icon: Trophy, title: 'Success Stories', body: 'A dedicated space to celebrate Abian achievements and inspire the next generation.' },
]

const STATS = [
  { number: '10,000+', label: 'Registered Members' },
  { number: '14', label: 'Forum Categories' },
  { number: '100+', label: 'Active Subgroups' },
  { number: '17', label: 'LGAs Represented' },
]

const STANDS = [
  { title: 'Identity', body: 'Celebrating and preserving Abian culture, language, and heritage.' },
  { title: 'Community', body: 'Building genuine connections between Abians at home and abroad.' },
  { title: 'Knowledge', body: 'Sharing information on education, business, health, governance, and opportunity.' },
  { title: 'Progress', body: 'Driving development conversations that lead to real change in Abia State.' },
]

const CREDENTIALS = [
  { icon: Code2, label: 'Full-Stack Developer' },
  { icon: Wrench, label: 'Software Engineer' },
  { icon: Users, label: 'Community Builder' },
  { icon: Rocket, label: 'Tech Entrepreneur' },
  { icon: MapPin, label: 'Bende LGA, Abia State' },
]

function FounderSection() {
  const photoUrl = useSignedUrl('about/ceo-photo.webp', 'site-assets', 60 * 60 * 24)

  return (
    <section
      id="founder"
      className="not-prose -mx-6 my-12 px-6 py-10 md:py-14 rounded-2xl bg-gradient-to-br from-primary/5 via-card to-secondary/5 border border-border"
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8 md:gap-10 items-start">
        <div className="w-full flex justify-center md:justify-start">
          <div className="overflow-hidden rounded-2xl border-2 border-secondary/40 ring-4 ring-primary/10 shadow-lg w-[180px] h-[220px] md:w-[220px] md:h-[260px]">
            <SafeImage
              src={photoUrl}
              fallback={getAvatarFallback('Okechukwu Gabriel')}
              alt="Okechukwu Gabriel E. — Founder & CEO, AbiaConnect"
              width={220}
              height={260}
              className="w-full h-full object-cover object-top"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-secondary">
            Meet the Founder &amp; CEO
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-1 mt-0">
            Okechukwu Gabriel E.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-4">
            Founder &amp; Chief Executive Officer, AbiaConnect
          </p>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-secondary/15 text-secondary border border-secondary/30 px-3 py-1 rounded-full">
              <MapPin className="size-3" /> Eluama Lodu-Imenyi
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-secondary/15 text-secondary border border-secondary/30 px-3 py-1 rounded-full">
              <Landmark className="size-3" /> Bende LGA
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-secondary/15 text-secondary border border-secondary/30 px-3 py-1 rounded-full">
              <Globe className="size-3" /> Abia State, Nigeria
            </span>
          </div>

          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Okechukwu Gabriel E. is a passionate technology entrepreneur, professional full-stack
              developer, and software engineer with a deep commitment to using technology as a tool
              for community empowerment and cultural preservation.
            </p>
            <p>
              Born into the family of the late Sup Ap Okechukwu W. Obialor, and hailing from
              Eluama Lodu-Imenyi in Bende Local Government Area of Abia State, Okechukwu carries
              the values of his heritage — resilience, community, and purpose — into everything
              he builds.
            </p>
            <p>
              It was this same sense of identity and belonging that inspired the creation of
              AbiaConnect — a platform conceived not just as a forum, but as a digital homeland
              for every Abian, wherever in the world they may be.
            </p>
            <p>
              As a full-stack developer and software architect, Okechukwu personally designed and
              engineered the AbiaConnect platform — from its database architecture and real-time
              infrastructure to its user experience and community features.
            </p>
          </div>

          <blockquote className="my-6 italic px-5 py-4 rounded-r-lg border-l-4 border-secondary bg-secondary/10">
            <p className="text-foreground m-0">
              "AbiaConnect is more than a website. It is a statement — that our people matter,
              our voices matter, and our culture deserves a permanent, powerful home in the
              digital world."
            </p>
            <footer className="text-sm text-muted-foreground mt-2 not-italic">
              — Okechukwu Gabriel E., Founder &amp; CEO
            </footer>
          </blockquote>

          <div className="flex flex-wrap gap-2 mb-4">
            {CREDENTIALS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-card border border-border px-3 py-1.5 rounded-full text-foreground"
              >
                <Icon className="size-3.5 text-secondary" /> {label}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a
              href="https://abiaconnect.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-secondary hover:underline"
            >
              <Globe className="size-4" /> abiaconnect.com
            </a>
            <a
              href="mailto:support@abiaconnect.com"
              className="inline-flex items-center gap-1.5 text-secondary hover:underline"
            >
              <Mail className="size-4" /> support@abiaconnect.com
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function About() {
  return (
    <StaticPage
      badge="Our Story"
      title="About AbiaConnect"
      subtitle="The story behind Nigeria's most dedicated community platform for Abia State indigenes."
    >
      <section className="not-prose mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">01 — Introduction</p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Who We Are</h2>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            AbiaConnect is a digital community platform built exclusively for the sons and daughters of
            Abia State, Nigeria — at home and across the world. We are more than a forum. We are a
            living, breathing extension of the bonds that tie every Abia indigene to their roots, their
            people, and their shared future.
          </p>
          <p>
            Founded with a simple belief — that Abians are stronger together — AbiaConnect brings
            together traders from Ariaria, professionals in London and Houston, farmers from Bende and
            Ikwuano, students at ABSU and FUTO, and leaders across all 17 local government areas into
            one unified digital home.
          </p>
        </div>
      </section>

      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">02 — Our Mission</p>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Geography should never separate a people from their identity, community, or voice. AbiaConnect is
            the digital home of indigenous Abians — bridging home and diaspora so culture, knowledge, commerce,
            and community thrive together.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">03 — Our Vision</p>
          <p className="text-muted-foreground leading-relaxed text-sm">
            To become the most trusted and most active community platform for Abians worldwide — a living forum
            where every Abian, regardless of where life has taken them, can speak, connect, contribute, and belong.
          </p>
        </div>
      </div>

      <section className="not-prose mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">04 — Our Values</p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">What We Stand For</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STANDS.map((s) => (
            <div key={s.title} className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 transition-colors">
              <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="not-prose mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">05 — Platform</p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">What AbiaConnect Offers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shrink-0">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-semibold text-foreground">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="not-prose mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">06 — Our Community</p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">By the Numbers</h2>
        <p className="text-muted-foreground mb-6">A snapshot of the community we are building together.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6 text-center hover:border-secondary/40 transition-colors">
              <div className="text-3xl md:text-4xl font-bold text-secondary">{s.number}</div>
              <div className="text-muted-foreground text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      

      <section className="not-prose mb-8 text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">08 — Join Us</p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Built by Abians, for Abians</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          AbiaConnect is not owned by a corporation. It was built by Abians, for Abians. Every feature, every
          policy, and every decision is guided by one question: Does this serve our people?
        </p>
        <Button asChild size="lg">
          <Link to="/register">Join AbiaConnect Free</Link>
        </Button>
      </section>
    </StaticPage>
  )
}
