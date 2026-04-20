/** FilterPill — §4.2
 *  Interactive pill for filter bars. Rectangular (radius-md), h-8.
 *  Matches the Customers page filter button treatment.
 *  Selected state = dark bg, white text.
 */

interface FilterPillProps {
  label: string
  selected?: boolean
  count?: number
  onClick?: () => void
  className?: string
}

export function FilterPill({ label, selected = false, count, onClick, className = '' }: FilterPillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)]',
        'text-[12px] font-medium leading-none whitespace-nowrap',
        'transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:ring-offset-1',
        'cursor-pointer select-none',
        selected
          ? 'bg-[var(--text-strong)] text-white'
          : 'text-[var(--text-muted)] hover:text-[var(--text-default)] hover:bg-[var(--surface-2)]',
        className,
      ].join(' ')}
    >
      {label}
      {count !== undefined && (
        <span
          className={[
            'inline-flex items-center justify-center rounded-[var(--radius-sm)] px-1 text-[11px] font-semibold leading-none min-w-[16px] h-[14px]',
            selected
              ? 'bg-white/20 text-white'
              : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  )
}
