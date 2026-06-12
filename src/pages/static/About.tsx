import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'
import {
  MessagesSquare,
  BarChart3,
  Users,
  Mail,
  Bell,
  Trophy,
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

export default function About() {
  return (
    <StaticPage
      badge="Our Story"
      title="About AbiaConnect"
      subtitle="The story behind Nigeria's most dedicated community platform for Abia State indigenes."
    >
      <h2>Who We Are</h2>
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

      <h2>Our Story</h2>
      <p>
        The idea for AbiaConnect was born from a familiar frustration: Abia State has always
        produced brilliant, industrious, and deeply connected people — yet there was no single
        trusted online space where that energy could gather. Facebook groups fragmented the
        conversation. WhatsApp chats were private and temporary. Important announcements, business
        opportunities, and cultural discussions were scattered across platforms with no continuity.
      </p>
      <p>
        AbiaConnect was created to change that. We built a platform that respects the intelligence
        of our people, protects their privacy, and gives every Abian — whether in Umuahia or in
        Toronto — a dignified space to speak, connect, trade, and thrive.
      </p>

      <h2>What AbiaConnect Offers</h2>
      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <h3 className="font-semibold text-foreground">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <h2>AbiaConnect by the Numbers</h2>
      <div className="not-prose grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
        {STATS.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-secondary">{s.number}</div>
            <div className="text-muted-foreground text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <h2>Built by Abians, for Abians</h2>
      <p>
        AbiaConnect is not owned by a corporation. It was built by Abians, for Abians. Every
        feature, every policy, and every decision is guided by one question: Does this serve our
        people? We invite you to join us, contribute, and help shape the future of this community.
      </p>

      <div className="not-prose flex justify-center pt-6">
        <Button asChild size="lg">
          <Link to="/register">Join AbiaConnect Free</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
