import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SafeImageProps {
  src: string | null | undefined
  fallback: string
  alt: string
  className?: string
  width?: number
  height?: number
  onError?: () => void
}

export function SafeImage({ src, fallback, alt, className, width, height, onError }: SafeImageProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src, fallback])

  const showFallback = hasError || !src
  // If we'd fall back but have no fallback to show, render nothing (caller renders its own placeholder).
  if (showFallback && !fallback) return null

  return (
    <img
      src={showFallback ? fallback : (src as string)}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={cn('object-cover', className)}
      onError={() => {
        if (!hasError) {
          setHasError(true)
          onError?.()
        }
      }}
    />
  )
}

export default SafeImage

