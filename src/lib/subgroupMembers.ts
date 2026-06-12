// Conflict target columns for the unique constraint:
//   subgroup_members_subgroup_id_user_id_key UNIQUE (subgroup_id, user_id)
// Use these constants for every upsert against `subgroup_members` so the
// conflict handling stays consistent across the app.
export const SUBGROUP_MEMBERS_UNIQUE_CONSTRAINT =
  'subgroup_members_subgroup_id_user_id_key' as const

export const SUBGROUP_MEMBERS_CONFLICT_TARGET = 'subgroup_id,user_id' as const

export const SUBGROUP_MEMBERS_UPSERT_OPTIONS = {
  onConflict: SUBGROUP_MEMBERS_CONFLICT_TARGET,
  ignoreDuplicates: true,
} as const
