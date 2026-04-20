/** KpiCard — §4.3
 *  Compact stat card matching the Dashboard MetricCard aesthetic.
 *  Icon sits on the same row as the label. Optional tone colors border + icon bg.
 */

import type { ReactNode } from 'react'

export type KpiTone = 'warning' | 'danger' | 'success' | 'neutral'

interface KpiCardProps {
  label: string
  value: ReactNode
  caption?: string
  trend?: string
  tone?: KpiTone
  icon?: ReactNode
  onClick?: () => void
  className?: string
}

const cardStyles: Record<KpiTone, string> = {
  neutral: 'border-[var(--line)] bg-white',
  warning: 'border-[rgba(245,158,11,0.22)] bg-[rgba(255,251,235,0.92)]',
  danger:  'border-[rgba(239,68,68,0.22)]  bg-[rgba(254,242,242,0.92)]',
  success: 'border-[rgba(34,197,94,0.22)]  bg-[rgba(240,253,244,0.92)]',
}

const iconStyles: Record<KpiTone, string> = {
  neutral: 'bg-[var(--surface-1)] text-[var(--text-strong)]',
  warning: 'bg-[rgba(245,158,11,0.12)] text-[var(--warning)]',
  danger:  'bg-[rgba(239,68,68,0.12)]  text-[var(--danger)]',
  success: 'bg-[rgba(34,197,94,0.12)]  text-[var(--success)]',
}

export function KpiCard({ label, value, caption, trend, tone = 'neutral', icon, onClick, className = '' }: KpiCardProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'relative min-w-[160px] overflow-hidden text-left',
        'rounded-[18px] border p-4',
        'shadow-[0_8px_28px_rgba(15,23,42,0.05)]',
        cardStyles[tone],
        onClick ? 'cursor-pointer transition-shadow hover:shadow-[0_12px_32px_rgba(15,23,42,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:ring-offset-1' : '',
        className,
      ].join(' ')}
    >
      {/* Label row — icon sits right-aligned on same line */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] leading-none">
          {label}
        </p>
        {icon && (
          <div className={['flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', iconStyles[tone]].join(' ')}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <p className="mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.03em] text-[var(--text-strong)]">
        {value}
      </p>

      {/* Trend */}
      {trend && (
        <>
          <span className="block w-full h-px bg-[var(--line)] mt-3" aria-hidden="true" />
          <span className="block text-[12px] text-[var(--text-muted)] mt-2">{trend}</span>
        </>
      )}
    </Tag>
  )
}
