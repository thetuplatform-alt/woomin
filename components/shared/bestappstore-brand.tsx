import Image from 'next/image'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import styles from './bestappstore-brand.module.css'

type BestAppStoreBrandProps = HTMLAttributes<HTMLSpanElement> & {
  compact?: boolean
}

export function BestAppStoreBrand({ compact = false, className, ...props }: BestAppStoreBrandProps) {
  return (
    <span
      className={cn(styles.brand, compact && styles.compact, className)}
      {...props}
    >
      <Image
        alt="BestAppStore"
        className={styles.logo}
        height={728}
        sizes={compact ? '110px' : '(max-width: 560px) 118px, 142px'}
        src="/bestappstore-logo.png"
        width={2160}
      />
    </span>
  )
}
