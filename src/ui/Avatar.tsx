/** Avatar — §4.8
 *  Neutral circular avatar. surface-1 fill, text-default initials.
 *  No random saturated colors. Optional status ring.
 */

import type { CSSProperties } from 'react'
import type { StatusTone } from './StatusPill'

type AvatarSize = 'sm' | 'md' | 'lg'

interface AvatarProps {
  initials: string
  size?: AvatarSize
  statusTone?: StatusTone
  className?: string
  style?: CSSProperties
  title?: string
}

const sizeMap: Record<AvatarSize, string> = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-[12px]',
  lg: 'w-10 h-10 text-[14px]',
}

const ringTone: Record<string, string> = {
  waiting:     'ring-[var(--warning)]',
  'in-progress': 'ring-[var(--info)]',
  done:        'ring-[var(--success)]',
  overdue:     'ring-[var(--danger)]',
}

export function Avatar({ initials, size = 'md', statusTone, className = '', style, title }: AvatarProps) {
  return (
    <span
      aria-label={title ?? initials}
      title={title ?? initials}
      style={style}
      className={[
        'inline-flex items-center justify-center rounded-full shrink-0',
        'bg-[var(--surface-1)] border border-[var(--line)]',
        'text-[var(--text-default)] font-semibold select-none',
        statusTone ? ['ring-2 ring-offset-1', ringTone[statusTone] ?? ''].join(' ') : '',
        sizeMap[size],
        className,
      ].join(' ')}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  )
}
