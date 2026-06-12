import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import StaticPage from '@/components/layout/StaticPage'
import { Star } from 'lucide-react'

const PAST = [
  { name: 'Ada Nwosu', month: 'March 2025', quote: 'Built the most-read thread in forum history' },
  { name: 'Obinna Kalu', month: 'February 2025', quote: 'Connected 12 Abia businesses with UK buyers' },
  { name: 'Chioma Eze', month: 'January 2025', quote: 'Launched the Abia Mothers Network subgroup' },
]

export default function MemberSpotlight() {
  const [username, setUsername] = useState('')
  const [reason, setReason] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !reason.trim()) return
    toast.success("Thank you! We'll review your nomination.")
    setUsername('')
    setReason('')
  }

  return (
    <StaticPage
      badge="Featured"
      title="Member Spotlight"
      subtitle="Each month, we celebrate a member who exemplifies the AbiaConnect spirit."
    >
      <div className="not-prose bg-card border-2 border-secondary rounded-2xl p-8 my-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
            <Star className="w-3.5 h-3.5" /> Member of the Month
          </span>
        </div>
        <h3 className="text-2xl font-bold text-foreground">Ikenna Okafor</h3>
        <p className="text-sm text-muted-foreground mb-4">
          LGA: Arochukwu · Member Since: January 2025
        </p>
        <blockquote className="border-l-4 border-secondary pl-4 italic text-lg text-foreground/90 my-4">
          “AbiaConnect gave me a platform to share what I know about palm oil export regulations.
          Three members have since successfully closed their first international deals. That is
          what community means.”
        </blockquote>
        <p className="text-muted-foreground leading-relaxed">
          Ikenna is a commodity trade consultant based in Port Harcourt with 15 years of experience
          in agricultural export. Since joining AbiaConnect he has contributed over 80 posts,
          answered hundreds of questions in the Business and Commerce category, and organised two
          virtual workshops for forum members — all without being asked.
        </p>
      </div>

      <h2>Past Spotlights</h2>
      <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        {PAST.map((p) => (
          <div key={p.name} className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground">{p.name}</h3>
            <p className="text-xs text-muted-foreground mb-2">{p.month}</p>
            <p className="text-sm text-muted-foreground italic">“{p.quote}”</p>
          </div>
        ))}
      </div>

      <h2>Nominate a Member</h2>
      <form onSubmit={submit} className="not-prose bg-card border border-border rounded-2xl p-6 space-y-4 my-6">
        <div>
          <Label htmlFor="username">Member Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            required
          />
        </div>
        <div>
          <Label htmlFor="reason">Reason (max 300 characters)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            maxLength={300}
            rows={4}
            placeholder="Why does this member deserve the spotlight?"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">{reason.length}/300</p>
        </div>
        <Button type="submit">Submit Nomination</Button>
      </form>
    </StaticPage>
  )
}
