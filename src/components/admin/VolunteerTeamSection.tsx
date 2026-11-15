import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Eye, EyeOff, Loader2, Pencil, UserMinus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ActionLog } from '@/pages/ModeratorTools'
import {
  fetchModActions,
  fetchTeam,
  modUndo,
  setTeamProfile,
  setTeamRole,
  TEAM_DEFAULT_INTRO,
  TEAM_INTRO_MAX,
  TEAM_ROLE_NAMES,
  TEAM_ROLE_POWERS,
  type TeamMember,
  type TeamRole,
} from '@/lib/volunteerTeam'

const TEAM_KEY = ['admin-volunteer-team']
const ROLES = Object.keys(TEAM_ROLE_NAMES) as TeamRole[]

/** Admin -> Volunteer team: who has which tools, add or remove in one tap, and every moderator decision. */
export function VolunteerTeamSection() {
  const qc = useQueryClient()
  const team = useQuery({ queryKey: TEAM_KEY, queryFn: fetchTeam, retry: false })
  const actions = useQuery({ queryKey: ['admin-mod-actions'], queryFn: () => fetchModActions(100), retry: false })

  const change = useMutation({
    mutationFn: (v: { user: string; role: TeamRole | null; name: string }) => setTeamRole(v.user, v.role),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: TEAM_KEY })
      qc.invalidateQueries({ queryKey: ['public-team'] })
      toast.success(
        v.role
          ? `${v.name} is now ${TEAM_ROLE_NAMES[v.role]}. They have been told.`
          : `${v.name} is off the team: tools switched off and removed from the Team page. They have been told.`,
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const undo = useMutation({
    mutationFn: modUndo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-mod-actions'] })
      qc.invalidateQueries({ queryKey: ['admin-todo'] })
      toast.success('Put back. The member has been told.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Approving a volunteer application switches their tools on straight away. If they have no account yet, it
          happens when they sign up with the same email. Volunteers never get settings, money or member roles.
          Everyone on the team also appears on the public Team page with their name, photo, role and a short intro.
          Removing someone switches their tools off and takes them off that page.
        </p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {ROLES.map((r) => (
            <li key={r} className="rounded-xl border p-3">
              <p className="font-medium">{TEAM_ROLE_NAMES[r]}</p>
              <p className="text-xs text-muted-foreground">{TEAM_ROLE_POWERS[r]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">The team</h3>
        {team.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : team.isError ? (
          <p className="text-sm text-destructive">{(team.error as Error).message}</p>
        ) : (team.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody yet. Approve a volunteer application, or add a member below.</p>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {team.data!.map((m) => (
              <TeamRow
                key={m.user_id}
                member={m}
                busy={change.isPending}
                onRole={(role, name) => change.mutate({ user: m.user_id, role, name })}
              />
            ))}
          </ul>
        )}
        <AddMember existing={new Set((team.data ?? []).map((m) => m.user_id))} onAdd={(user, role, name) => change.mutate({ user, role, name })} />
      </section>

      <ActionLog actions={actions.data ?? []} onUndo={(id) => undo.mutate(id)} undoing={undo.isPending} showWho canUndoAll />
    </div>
  )
}

/** One volunteer: role, their intro on the Team page, show or hide there, and remove (asks first). */
function TeamRow({ member: m, busy, onRole }: { member: TeamMember; busy: boolean; onRole: (role: TeamRole | null, name: string) => void }) {
  const qc = useQueryClient()
  const name = m.display_name || m.username || 'Member'
  const [editing, setEditing] = useState(false)
  const [intro, setIntro] = useState(m.intro ?? '')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const shownIntro = m.intro?.trim() || TEAM_DEFAULT_INTRO[m.role]

  const save = useMutation({
    mutationFn: (v: { intro: string; show: boolean }) => setTeamProfile(m.user_id, v.intro, v.show),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: TEAM_KEY })
      qc.invalidateQueries({ queryKey: ['public-team'] })
      setEditing(false)
      toast.success(v.show === m.show_on_team ? 'Intro saved. It shows on the Team page.' : v.show ? `${name} now shows on the Team page.` : `${name} is hidden from the Team page.`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <UserAvatar avatarUrl={m.avatar_url} displayName={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {m.username ? `@${m.username} · ` : ''}on the team {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
            {m.from_application ? ' · from an application' : ''}
            {m.show_on_team ? '' : ' · hidden from the Team page'}
          </p>
        </div>
        <Select value={m.role} onValueChange={(r) => onRole(r as TeamRole, name)}>
          <SelectTrigger className="h-9 w-48" aria-label={`Role for ${name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {TEAM_ROLE_NAMES[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {confirmRemove ? (
          <span className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Remove {name} from the team?</span>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => onRole(null, name)}>
              Yes, remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}>
            <UserMinus /> Remove
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 pl-11">
          <Textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value.slice(0, TEAM_INTRO_MAX))}
            placeholder={TEAM_DEFAULT_INTRO[m.role]}
            rows={3}
            aria-label={`Intro for ${name} on the Team page`}
          />
          <p className="text-xs text-muted-foreground">
            A sentence or two about what they do for the community. Leave it empty to use the line for their role. {intro.length}/{TEAM_INTRO_MAX}
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ intro, show: m.show_on_team })}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null} Save intro
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIntro(m.intro ?? '')
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2 pl-11">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Team page intro: </span>
            {shownIntro}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil /> Edit intro
          </Button>
          <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ intro: m.intro ?? '', show: !m.show_on_team })}>
            {m.show_on_team ? <EyeOff /> : <Eye />} {m.show_on_team ? 'Hide from Team page' : 'Show on Team page'}
          </Button>
        </div>
      )}
    </li>
  )
}

function AddMember({ existing, onAdd }: { existing: Set<string>; onAdd: (user: string, role: TeamRole, name: string) => void }) {
  const [term, setTerm] = useState('')
  const [role, setRole] = useState<TeamRole>('moderator')
  const q = term.trim().replace(/^@/, '')
  const search = useQuery({
    queryKey: ['admin-team-search', q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const like = `%${q.replace(/[\\%_,()]/g, ' ')}%`
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .limit(8)
      if (error) throw error
      return data ?? []
    },
  })
  const results = (search.data ?? []).filter((p) => !existing.has(p.id))

  return (
    <div className="space-y-2 rounded-2xl border p-3">
      <p className="text-sm font-medium">Add a member to the team</p>
      <div className="flex flex-wrap gap-2">
        <Input className="min-w-48 flex-1" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name or username" aria-label="Search members" />
        <Select value={role} onValueChange={(r) => setRole(r as TeamRole)}>
          <SelectTrigger className="w-48" aria-label="Role to give">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {TEAM_ROLE_NAMES[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {results.length ? (
        <ul className="divide-y rounded-xl border">
          {results.map((p) => {
            const name = p.display_name || p.username || 'Member'
            return (
              <li key={p.id} className="flex items-center gap-2 p-2 text-sm">
                <UserAvatar avatarUrl={p.avatar_url} displayName={name} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  {name} {p.username ? <span className="text-muted-foreground">@{p.username}</span> : null}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    onAdd(p.id, role, name)
                    setTerm('')
                  }}
                >
                  Add
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export default VolunteerTeamSection
