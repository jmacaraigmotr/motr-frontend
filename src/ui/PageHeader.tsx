/** PageHeader — §4.5
 *  Single source of truth for page title + description + actions.
 *  Eyebrow deleted. Max one primary action + up to two secondaries.
 */

import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-4 px-6 pt-5 pb-4',
        'border-b border-[var(--line)] bg-[var(--surface-0)]',
        className,
      ].join(' ')}
    >
      <div className="min-w-0">
        <h1 className="text-[20px] font-[700] leading-7 tracking-[-0.02em] text-[var(--text-strong)] truncate">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5 leading-5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
