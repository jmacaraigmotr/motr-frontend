/** StatusPill — §4.2
 *  Rectangular data flag used inside table cells only. Never interactive.
 *  Each tone maps to one of the semantic design tokens.
 */

export type StatusTone = 'waiting' | 'in-progress' | 'done' | 'overdue' | 'draft' | 'new'

interface StatusPillProps {
  label: string
  tone?: StatusTone
  className?: string
}

const toneStyles: Record<StatusTone, { dot: string; wrapper: string; text: string }> = {
  waiting: {
    dot:     'bg-[var(--warning)]',
    wrapper: 'bg-[var(--warning-bg)] border-[var(--warning-border)]',
    text:    'text-[var(--warning-fg)]',
  },
  'in-progress': {
    dot:     'bg-[var(--info)]',
    wrapper: 'bg-[var(--info-bg)] border-[var(--info-border)]',
    text:    'text-[var(--info-fg)]',
  },
  done: {
    dot:     'bg-[var(--success)]',
    wrapper: 'bg-[var(--success-bg)] border-[var(--success-border)]',
    text:    'text-[var(--success-fg)]',
  },
  overdue: {
    dot:     'bg-[var(--danger)]',
    wrapper: 'bg-[var(--danger-bg)] border-[var(--danger-border)]',
    text:    'text-[var(--danger-fg)]',
  },
  draft: {
    dot:     'bg-[var(--text-muted)]',
    wrapper: 'bg-[var(--surface-1)] border-[var(--line)]',
    text:    'text-[var(--text-muted)]',
  },
  new: {
    dot:     'bg-[var(--text-muted)]',
    wrapper: 'bg-[var(--surface-1)] border-[var(--line)]',
    text:    'text-[var(--text-default)]',
  },
}

export function StatusPill({ label, tone = 'new', className = '' }: StatusPillProps) {
  const s = toneStyles[tone] ?? toneStyles.new
  return (
    <span
      role="status"
      className={[
        'inline-flex items-center gap-1.5 px-2 h-5 rounded-[var(--radius-sm)] border',
        'text-[11px] font-medium uppercase tracking-[0.04em] leading-none whitespace-nowrap',
        s.wrapper,
        s.text,
        className,
      ].join(' ')}
    >
      <span className={['block w-[6px] h-[6px] rounded-full shrink-0', s.dot].join(' ')} aria-hidden="true" />
      {label}
    </span>
  )
}

/* ── Mapping helpers ── */

import type { ROStatus } from '@/types/repairOrder'

export function roStatusToTone(status: ROStatus): StatusTone {
  switch (status) {
    case 'new':
    case 'estimate_pending':
    case 'pre_order':
      return 'new'
    case 'estimate_approved':
    case 'scheduled':
    case 'in_production':
    case 'parts_ordered':
    case 'parts_partial':
    case 'parts_complete':
    case 'qa_check':
    case 'detail':
      return 'in-progress'
    case 'ready_for_pickup':
      return 'waiting'
    case 'delivered':
    case 'closed':
      return 'done'
    default:
      return 'new'
  }
}

export function roStatusLabel(status: ROStatus): string {
  const map: Partial<Record<ROStatus, string>> = {
    new:               'New',
    estimate_pending:  'Est. Pending',
    estimate_approved: 'Est. Approved',
    pre_order:         'Pre-Order',
    parts_ordered:     'Parts Ordered',
    parts_partial:     'Parts Partial',
    parts_complete:    'Parts Complete',
    scheduled:         'Scheduled',
    in_production:     'In Production',
    qa_check:          'QA Check',
    detail:            'Detail',
    ready_for_pickup:  'Ready',
    delivered:         'Delivered',
    closed:            'Closed',
  }
  return map[status] ?? status
}
