import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { profileEditSchema } from '@/lib/profileUpdate'

const BIO_MAX = 500

const bioSchema = profileEditSchema.shape.bio

function validateBio(value: string): string | null {
  const result = bioSchema.safeParse(value)
  if (!result.success) return result.error.issues[0]?.message ?? 'Invalid bio'
  return null
}

interface BioFieldProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Bio textarea with inline character counter and validation error.
 * Shared by Dashboard settings and Profile edit form.
 */
export function BioField({ value, onChange, className }: BioFieldProps) {
  const trimmedLen = value.trim().length
  const overLimit = value.length > BIO_MAX
  const error = overLimit ? `Bio must be ${BIO_MAX} characters or less` : validateBio(value)
  const counterColor =
    value.length > BIO_MAX
      ? 'text-destructive'
      : value.length > BIO_MAX - 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'

  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <Label htmlFor="bio-field">Bio</Label>
        <span className={`text-xs tabular-nums ${counterColor}`}>
          {value.length}/{BIO_MAX}
        </span>
      </div>
      <Textarea
        id="bio-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={BIO_MAX}
        aria-invalid={!!error}
        aria-describedby={error ? 'bio-field-error' : 'bio-field-hint'}
        placeholder="Tell the community a little about yourself…"
        className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
      />
      {error ? (
        <p id="bio-field-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id="bio-field-hint" className="text-xs text-muted-foreground">
          {trimmedLen === 0
            ? 'Optional — leave blank to clear your bio.'
            : 'Looks good. Saved when you tap Save Changes.'}
        </p>
      )}
    </div>
  )
}

export { BIO_MAX, validateBio }
