import StaticPage from '@/components/layout/StaticPage'

const RULES = [
  {
    icon: '🤝',
    title: 'Be Respectful',
    body: 'Personal attacks, insults, and harassment of any kind are not permitted. You may disagree with an idea — you may never attack the person holding it. This includes disagreements about politics, religion, business, or culture.',
  },
  {
    icon: '📰',
    title: 'Be Accurate',
    body: 'Do not spread unverified news, rumours, or misinformation about individuals, communities, or institutions. If you are unsure something is true, say so. Label opinions clearly as opinions.',
  },
  {
    icon: '🏛️',
    title: 'Respect Abia Culture',
    body: 'This is a platform that honours Igbo identity and Abia heritage. Content that demeans, mocks, or disrespects our culture, language, or traditions will be removed.',
  },
  {
    icon: '🚫',
    title: 'No Hate Speech',
    body: 'Content targeting any person or group based on ethnicity, religion, gender, disability, sexual orientation, or political affiliation is strictly forbidden and will result in immediate account suspension.',
  },
  {
    icon: '💼',
    title: 'No Spam or Unsolicited Advertising',
    body: 'Do not post the same content repeatedly. Do not promote businesses, products, or services outside the designated Business & Commerce category without moderator approval. Affiliate links must be clearly disclosed.',
  },
  {
    icon: '🔒',
    title: 'Protect Privacy',
    body: "Never share another person's private information — phone numbers, home address, personal photographs, financial details — without their explicit consent. This is a serious violation that results in immediate banning.",
  },
  {
    icon: '🔞',
    title: 'Age-Appropriate Content',
    body: 'AbiaConnect is accessible to members of all ages. All content must be suitable for a general audience. Explicit, adult, or sexually suggestive content is not permitted under any circumstances.',
  },
  {
    icon: '✅',
    title: 'Stay On Topic',
    body: 'Post in the most relevant category. Off-topic posts may be moved by moderators without notice. This keeps the forum organised and useful for everyone.',
  },
]

export default function ForumGuidelines() {
  return (
    <StaticPage
      badge="Community Rules"
      title="Forum Guidelines"
      subtitle="Simple, fair rules that keep AbiaConnect a great place for everyone."
    >
      <p>
        AbiaConnect is a community built on respect, authenticity, and shared love for Abia State.
        These guidelines exist not to restrict you, but to protect the quality of conversation and
        the safety of every member. Please read them before posting.
      </p>

      <h2>The Golden Rule</h2>
      <blockquote className="border-l-4 border-secondary pl-6 italic">
        Treat every member the way you would want to be treated at an Abia State community
        gathering. With respect, patience, and goodwill.
      </blockquote>

      <h2>The Rules</h2>
      <div className="not-prose space-y-4 my-6">
        {RULES.map((r, i) => (
          <div key={r.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="text-2xl">{r.icon}</div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  {i + 1}. {r.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2>Consequences</h2>
      <ul>
        <li><strong>First violation:</strong> Warning issued by a moderator</li>
        <li><strong>Second violation:</strong> Temporary suspension (3–7 days)</li>
        <li><strong>Third violation:</strong> Permanent ban with no appeal</li>
        <li><strong>Severe violations</strong> (hate speech, privacy breach, harassment): Immediate permanent ban</li>
      </ul>

      <h2>Reporting</h2>
      <p>
        If you see content that violates these guidelines, use the Report button on any post or
        contact our moderation team at{' '}
        <a href="mailto:moderation@abiaconnect.com">moderation@abiaconnect.com</a>. We investigate
        every report, usually within 24 hours.
      </p>
    </StaticPage>
  )
}
