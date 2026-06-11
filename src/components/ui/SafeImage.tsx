import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SafeImageProps {
  src: string | null | undefined
  fallback: string
  alt: string
  className?: string
  width?: number
  height?: number
}

export function SafeImage({ src, fallback, alt, className, width, height }: SafeImageProps) {
  const initial = src || fallback
  const [imgSrc, setImgSrc] = useState<string>(initial)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
    setImgSrc(src || fallback)
  }, [src, fallback])

  return (
    <img
      src={hasError || !src ? fallback : imgSrc}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={cn('object-cover', className)}
      onError={() => {
        if (!hasError) {
          setHasError(true)
          setImgSrc(fallback)
        }
      }}
    />
  )
}

export default SafeImage
