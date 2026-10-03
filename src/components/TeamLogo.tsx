import { useState } from 'react'
import { resizedLogo } from '../espn'

interface Props {
  src: string
  size: number  // rendered size in CSS pixels
  className?: string
  alt?: string
}

/** Team logo fetched at display size, falling back to the full-size image if resizing fails */
export function TeamLogo({ src, size, className, alt = '' }: Props) {
  const [useOriginal, setUseOriginal] = useState(false)
  if (!src) return null
  return (
    <img
      src={useOriginal ? src : resizedLogo(src, size)}
      onError={() => setUseOriginal(true)}
      alt={alt}
      className={className}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  )
}
