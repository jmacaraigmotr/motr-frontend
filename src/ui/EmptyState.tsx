/** EmptyState — §4.7
 *  Centered in the table body area.
 *  1 icon-free headline, 1 subcopy line, 1 primary CTA.
 */

import type { ReactNode } from 'react'
import { Button } from './Button'

export type EmptyTemplate = 'no-results' | 'no-records-yet' | 'permission'

interface EmptyStateProps {
  template?: EmptyTemplate
  headline?: string
  body?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

const DEFAULTS: Record<EmptyTemplate, { headline: string; body: string }> = {
  'no-results':     { headline: 'No results found',      body: 'Try adjusting your filters or search term.' },
  'no-records-yet': { headline: 'Nothing here yet',      body: 'Create your first record to get started.'   },
  'permission':     { headline: 'Access restricted',     body: "You don't have permission to view this."    },
}

export function EmptyState({ template = 'no-results', headline, body, action, className = '' }: EmptyStateProps) {
  const defaults = DEFAULTS[template]
  const h = headline ?? defaults.headline
  const b = body    ?? defaults.body

  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-3 py-16 px-6 text-center',
        className,
      ].join(' ')}
    >
      <p className="text-[15px] font-semibold text-[var(--text-default)]">{h}</p>
      <p className="text-[14px] text-[var(--text-muted)] max-w-[320px]">{b}</p>
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  )
}
