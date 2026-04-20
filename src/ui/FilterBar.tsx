/** FilterBar — §4.6
 *  Left: search. Middle: FilterPill group. Right: result count.
 *  Active filters shown as dismissable chips below.
 *  Selected filter reflected in URL (?status=…).
 */

import { useRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { FilterPill } from './FilterPill'
import { Button } from './Button'

export interface FilterOption {
  key: string
  label: string
  count?: number
}

interface ActiveChip {
  key: string
  label: string
  onRemove: () => void
}

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  filters: FilterOption[]
  activeFilter: string
  onFilterChange: (key: string) => void
  totalCount?: number
  activeChips?: ActiveChip[]
  onClearAll?: () => void
  className?: string
  extra?: ReactNode
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilter,
  onFilterChange,
  totalCount,
  activeChips = [],
  onClearAll,
  className = '',
  extra,
}: FilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={['border-b border-[var(--line)] bg-[var(--surface-0)]', className].join(' ')}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-6 py-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            ref={inputRef}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={[
              'pl-8 pr-3 h-8 w-48 rounded-[var(--radius-md)] border border-[var(--line)]',
              'bg-white text-[14px] text-[var(--text-default)] placeholder-[var(--text-muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--info)] focus:border-transparent focus:w-64',
              'transition-all duration-[var(--motion-duration)]',
            ].join(' ')}
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Filter">
          {filters.map((f) => (
            <FilterPill
              key={f.key}
              label={f.label}
              count={f.count}
              selected={activeFilter === f.key}
              onClick={() => onFilterChange(f.key)}
            />
          ))}
        </div>

        {/* Extra slot (e.g. secondary controls) */}
        {extra && <div className="ml-auto">{extra}</div>}

        {/* Result count */}
        {totalCount !== undefined && !extra && (
          <span className="ml-auto text-[13px] text-[var(--text-muted)] tabular-nums font-mono shrink-0">
            {totalCount.toLocaleString()} {totalCount === 1 ? 'record' : 'records'}
          </span>
        )}
      </div>

      {/* Active chips row */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 px-6 pb-2 flex-wrap">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface-1)] text-[12px] text-[var(--text-default)]"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Remove filter: ${chip.label}`}
                onClick={chip.onRemove}
                className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-[var(--surface-2)] transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 px-2 text-[12px]">
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
