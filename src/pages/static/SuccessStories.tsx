import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

const STORIES = [
  {
    tag: 'Business',
    headline: 'From 50,000 Naira to a Shoe Factory: How Emeka Built Aba\'s Newest Export Brand',
    body: 'Starting with a single table in Ariaria market, Emeka Okonkwo spent 12 years learning every aspect of leather goods before launching his own manufacturing line. Today his factory employs 23 people and ships to Ghana and Cameroon. He credits the Aba spirit — relentless, creative, and resilient.',
  },
  {
    tag: 'Education',
    headline: 'ABSU Graduate Wins Prestigious Commonwealth Scholarship to Oxford',
    body: 'Chidinma Eze, a 2021 graduate of Abia State University, is now pursuing a doctorate in public health policy at the University of Oxford on a full Commonwealth Scholarship. She wants to return to Abia State and reshape how rural healthcare is delivered.',
  },
  {
    tag: 'Community',
    headline: 'How One Woman From Ohafia Built a School for 400 Children With No Government Help',
    body: "When Mrs Adaeze Nwosu returned from the UK in 2019, she found her home village's primary school had collapsed. She fundraised among the diaspora, coordinated local labour, and rebuilt the school in 18 months. Enrolment today stands at 400 pupils.",
  },
]

export default function SuccessStories() {
  return (
    <StaticPage
      badge="Celebrating Abians"
      title="Success Stories"
      subtitle="Celebrating the achievements of Abia State's finest sons and daughters."
    >
      <p>
        Every Abian who succeeds carries the pride of the whole state. AbiaConnect's Success
        Stories section documents, celebrates, and amplifies those wins — from the Aba trader who
        built a manufacturing empire to the Umuahia-born surgeon saving lives in Atlanta.
      </p>

      <div className="not-prose space-y-5 my-8">
        {STORIES.map((s) => (
          <article key={s.headline} className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 transition-colors">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider bg-secondary/15 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full mb-3">
              {s.tag}
            </span>
            <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">{s.headline}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{s.body}</p>
            <Button variant="outline" size="sm">Read Full Story</Button>
          </article>
        ))}
      </div>

      <div className="not-prose text-center pt-4">
        <Button asChild size="lg">
          <Link to="/create-thread?category=success-stories">Submit Your Story</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
