import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Members first: the home page shows what members wrote, and the Newsdesk's
 * news on a tab of its own. The database side is in
 * supabase/migrations/20261025090000_members_first.sql.
 */

const sb = supabase as any

/** The account the Newsdesk posts as, or null (also before the database update). */
export async function loadNewsdeskAuthor(): Promise<string | null> {
  const { data, error } = await sb.rpc('newsdesk_author_id')
  if (error) return null
  return (data as string | null) ?? null
}

export function useNewsdeskAuthor() {
  return useQuery({ queryKey: ['newsdesk-author'], queryFn: loadNewsdeskAuthor, staleTime: Infinity })
}

/** The Desk's own conversation starters belong with members' posts, not the news. */
const DESK_STARTERS = '{question-of-the-day}'

/**
 * Narrow a threads query to members' posts ("community") or the Newsdesk's
 * news ("news"). Members' posts include public group posts, but not the pinned
 * group welcome threads.
 */
export function feedFilter<Q>(query: Q, kind: 'community' | 'news', newsdesk: string | null): Q {
  const q = query as any
  if (kind === 'news') {
    if (!newsdesk) return q.is('subgroup_id', null)
    return q.is('subgroup_id', null).eq('author_id', newsdesk).or(`tags.is.null,tags.not.cs.${DESK_STARTERS}`)
  }
  const members = q.or('tags.is.null,tags.not.cs.{welcome}')
  if (!newsdesk) return members.is('subgroup_id', null)
  return members.or(`author_id.is.null,author_id.neq.${newsdesk},tags.cs.${DESK_STARTERS}`)
}
