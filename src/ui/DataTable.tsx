/** DataTable — §4.4
 *  Clean table wrapper. Matches the Customers page table system.
 *  - h-11 header, 11px semibold uppercase labels, 1.5px bottom border
 *  - py-3.5 px-5 row density
 *  - Alternating zebra rows: odd white, even surface-0
 *  - Skeleton loading state, EmptyState slot
 */

import type { ReactNode, CSSProperties } from 'react'
import { EmptyState, type EmptyTemplate } from './EmptyState'

export interface Column<T> {
  key: string
  header: string
  width?: string | number
  align?: 'left' | 'right' | 'center'
  render: (row: T, index: number) => ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  loading?: boolean
  skeletonRows?: number
  emptyTemplate?: EmptyTemplate
  emptyHeadline?: string
  emptyBody?: string
  emptyAction?: { label: string; onClick: () => void }
  className?: string
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-[var(--line)] last:border-b-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <span
            className="block h-3.5 rounded-full bg-[var(--surface-2)] animate-pulse"
            style={{ width: i === 0 ? '55%' : '75%' }}
          />
        </td>
      ))}
    </tr>
  )
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  loading = false,
  skeletonRows = 8,
  emptyTemplate = 'no-results',
  emptyHeadline,
  emptyBody,
  emptyAction,
  className = '',
}: DataTableProps<T>) {
  return (
    <div className={['w-full overflow-x-auto', className].join(' ')}>
      <table className="w-full border-collapse text-[14px]">
        <thead className="sticky top-0 z-10">
          <tr style={{ background: 'var(--surface-1)', borderBottom: '1.5px solid var(--line)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={{ width: col.width } as CSSProperties}
                className={[
                  'h-11 px-5 text-[11px] font-semibold uppercase tracking-[0.07em]',
                  'text-[var(--text-default)] opacity-50',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  template={emptyTemplate}
                  headline={emptyHeadline}
                  body={emptyBody}
                  action={emptyAction}
                />
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={getRowKey(row)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                className={[
                  'border-b border-[var(--line)] last:border-b-0 group transition-colors',
                  'odd:bg-white even:bg-[var(--surface-0)]',
                  onRowClick
                    ? 'cursor-pointer hover:!bg-[var(--surface-1)] focus-visible:outline-none focus-visible:!bg-[var(--surface-1)]'
                    : '',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-5 py-3.5 text-[var(--text-default)] align-middle',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '',
                    ].join(' ')}
                  >
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
