import { getStorageUrl, getAvatarFallback } from '@/lib/images'
import { SafeImage } from './SafeImage'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  avatarUrl: string | null | undefined
  displayName: string | null | undefined
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-xl',
}

export function UserAvatar({ avatarUrl, displayName, size = 'md', className }: UserAvatarProps) {
  const resolvedUrl = getStorageUrl(avatarUrl, 'avatars')
  const fallback = getAvatarFallback(displayName)
  return (
    <SafeImage
      src={resolvedUrl}
      fallback={fallback}
      alt={displayName || 'User avatar'}
      className={cn(sizeMap[size], 'rounded-full flex-shrink-0 border-2 border-border', className)}
    />
  )
}

export default UserAvatar
