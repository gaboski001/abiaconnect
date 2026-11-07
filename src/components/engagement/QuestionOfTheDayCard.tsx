import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CollapsibleCard } from '@/components/community/CollapsibleCard'
import { cn } from '@/lib/utils'

const sb = supabase as any

/**
 * Today's question from the AbiaConnect Desk, a new one every morning: an
 * easy reason to reply and see what other Abians think. Goes away once the
 * member has answered, until the next question.
 */
export function QuestionOfTheDayCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const questionQ = useQuery({
    queryKey: ['question-of-the-day', user?.id],
    staleTime: 10 * 60_000,
    refetchOnMount: 'always',
    queryFn: async () => {
      const since = new Date(Date.now() - 36 * 3_600_000).toISOString()
      const { data, error } = await sb
        .from('threads')
        .select('id, title, replies(count)')
        .contains('tags', ['question-of-the-day'])
        .eq('is_deleted', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error || !data?.length) return null
      const row = data[0] as { id: string; title: string; replies?: { count: number }[] }
      if (user) {
        const { count } = await sb
          .from('replies')
          .select('id', { count: 'exact', head: true })
          .eq('thread_id', row.id)
          .eq('user_id', user.id)
        if (count) return null
      }
      return {
        id: row.id,
        question: row.title.replace(/^Question of the day:\s*/i, ''),
        answers: row.replies?.[0]?.count ?? 0,
      }
    },
  })

  const q = questionQ.data
  if (!q) return null
  return (
    <CollapsibleCard
      name="question-of-the-day"
      version={q.id}
      className={cn('border-amber-500/30 bg-amber-500/[0.06]', compact ? 'p-4' : 'p-5')}
      titleClassName="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400"
      title="Question of the day"
    >
      <p className="font-medium leading-snug text-foreground">{q.question}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <MessageCircle className="size-3.5" />
          {q.answers ? `${q.answers.toLocaleString()} ${q.answers === 1 ? 'answer' : 'answers'}` : 'Be the first to answer'}
        </span>
        <Link
          to={`/thread/${q.id}`}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Answer
        </Link>
      </div>
    </CollapsibleCard>
  )
}
