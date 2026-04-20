import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { repairOrdersApi } from '@/api/repairOrders'
import type { ROAuditEntry } from '@/api/repairOrders'
import type { ROEvent, StaffMember, JobStatus } from '@/types/repairOrder'
import { JOB_STATUS_LABELS } from '@/types/repairOrder'
import { formatCurrency } from '@/lib/utils'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import { alpha, useTheme } from '@mui/material/styles'
import { Plus, Pencil, Trash2, MessageSquare, Clock } from 'lucide-react'
import IntakeDetailModal from './IntakeDetailModal'

interface Props {
  roId: number
  events: ROEvent[]
  staffList?: StaffMember[]
  jobNumber?: number | null
  roNumber?: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  repair_orders : 'Repair Order',
  intakes       : 'Intake',
  ro_insurance  : 'Insurance',
  rentals       : 'Rental',
  vehicles      : 'Vehicle',
  payments      : 'Transaction',
  payment_events: 'Transaction',
}

const ACTION_CONFIG = {
  create: { Icon: Plus,    label: 'Created', color: '#10B981' },
  update: { Icon: Pencil,  label: 'Updated', color: '#3B82F6' },
  delete: { Icon: Trash2,  label: 'Deleted', color: '#EF4444' },
} as const

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)   return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function resolveStaffName(userId: number | null, staffList: StaffMember[]): string {
  if (!userId) return 'System'
  const m = staffList.find(s => s.id === userId)
  if (!m) return `User #${userId}`
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || m.name
}

function resolveAuditName(entry: ROAuditEntry): string {
  if (entry.user) {
    const full = [entry.user.first_name, entry.user.last_name].filter(Boolean).join(' ')
    return full || entry.user.name || entry.user.email || `User #${entry.user.id}`
  }
  return entry.user_id ? `User #${entry.user_id}` : 'System'
}

function entityName(raw: string | null): string | null {
  if (!raw) return null
  if (/^\d+$/.test(raw)) return `#${raw}`
  return raw
}

// Replace raw snake_case job status values in audit description text
function formatDescription(text: string | null): string | null {
  if (!text) return null
  return text.replace(/\b(open|waiting_for_payment|closed)\b/g,
    m => JOB_STATUS_LABELS[m as JobStatus] ?? m.replace(/_/g, ' '))
}

// ── Timeline item ──────────────────────────────────────────────────────────

function TimelineRow({
  iconColor,
  Icon,
  actor,
  actionLabel,
  actionColor,
  entityLabel,
  name,
  description,
  timestamp,
  onClick,
}: {
  iconColor: string
  Icon: React.ElementType
  actor: string
  actionLabel: string
  actionColor: string
  entityLabel: string
  name?: string | null
  description?: string | null
  timestamp: string
  onClick?: () => void
}) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 1,
        py: 1.5,
        borderRadius: 1,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, onClick ? 0.07 : 0.03) },
        transition: 'background-color 0.15s ease',
      }}
    >
      {/* Circular icon */}
      <Box sx={{
        flexShrink: 0,
        width: 32, height: 32,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: alpha(iconColor, isDark ? 0.2 : 0.12),
        mt: 0.25,
      }}>
        <Icon size={14} color={iconColor} />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.4 }}>
          {actor}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4, mt: 0.2 }}>
          <Box component="span" sx={{ color: actionColor, fontWeight: 600 }}>{actionLabel}</Box>
          {' '}{entityLabel}
          {name && (
            <> — <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{name}</Box></>
          )}
          {onClick && (
            <Box component="span" sx={{ ml: 0.75, fontSize: '0.7rem', color: 'primary.main', fontWeight: 600, opacity: 0.8 }}>
              · View
            </Box>
          )}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {description}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
          {relativeTime(timestamp)}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────

type TimelineItem =
  | { _kind: 'event'; data: ROEvent;      ts: number }
  | { _kind: 'audit'; data: ROAuditEntry; ts: number }

// ── Main component ─────────────────────────────────────────────────────────

export default function EventsPanel({ roId, events, staffList = [], jobNumber, roNumber }: Props) {
  const [intakeModalRoId, setIntakeModalRoId] = useState<number | null>(null)

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['ro_activity', roId],
    queryFn: () => repairOrdersApi.activity(roId),
    staleTime: 30_000,
  })

  const items: TimelineItem[] = [
    ...events.map(e  => ({ _kind: 'event' as const, data: e,  ts: new Date(e.created_at).getTime() })),
    ...auditLogs.map(a => ({ _kind: 'audit' as const, data: a, ts: new Date(a.created_at).getTime() })),
  ].sort((a, b) => b.ts - a.ts)

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={2}>
        History ({items.length})
      </Typography>

      {items.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.disabled' }}>
          <Clock size={16} />
          <Typography variant="body2">No history yet.</Typography>
        </Box>
      ) : (
        <Box>
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1

            if (item._kind === 'event') {
              const evt = item.data
              const actor = resolveStaffName(evt.user_id, staffList)
              return (
                <Box key={`evt-${evt.id}`}>
                  <TimelineRow
                    iconColor="#8B5CF6"
                    Icon={MessageSquare}
                    actor={actor}
                    actionLabel={evt.type ? evt.type.replace(/_/g, ' ') : 'Note'}
                    actionColor="#8B5CF6"
                    entityLabel=""
                    name={null}
                    description={formatDescription(evt.description)}
                    timestamp={evt.created_at}
                  />
                  {!isLast && <Divider sx={{ mx: 1, opacity: 0.6 }} />}
                </Box>
              )
            }

            const audit = item.data
            const actor = resolveAuditName(audit)
            const config = ACTION_CONFIG[audit.action_type] ?? ACTION_CONFIG.update
            const label = ENTITY_LABELS[audit.entity_type] ?? audit.entity_type.replace(/_/g, ' ')

            // For repair_order entries show Job # prominently
            let displayName: string | null = entityName(audit.entity_name)
            if (audit.entity_type === 'repair_orders' && (jobNumber != null || roNumber)) {
              displayName = jobNumber != null ? `Job #${jobNumber}` : `RO-${roNumber}`
            }

            // For payment/transaction entries try to surface the amount from description
            let auditDescription = formatDescription(audit.description)
            if ((audit.entity_type === 'payments' || audit.entity_type === 'payment_events') && !auditDescription && audit.entity_name && /^\d+(\.\d+)?$/.test(audit.entity_name)) {
              auditDescription = `Amount: ${formatCurrency(Number(audit.entity_name))}`
            }

            // Intake entries are clickable — open the intake detail modal
            const isIntakeEntry = audit.entity_type === 'intakes' && audit.action_type !== 'delete'
            const handleClick = isIntakeEntry ? () => setIntakeModalRoId(roId) : undefined

            return (
              <Box key={`audit-${audit.id}-${idx}`}>
                <TimelineRow
                  iconColor={config.color}
                  Icon={config.Icon}
                  actor={actor}
                  actionLabel={config.label}
                  actionColor={config.color}
                  entityLabel={label}
                  name={displayName}
                  description={auditDescription}
                  timestamp={audit.created_at}
                  onClick={handleClick}
                />
                {!isLast && <Divider sx={{ mx: 1, opacity: 0.6 }} />}
              </Box>
            )
          })}
        </Box>
      )}

      <IntakeDetailModal roId={intakeModalRoId} onClose={() => setIntakeModalRoId(null)} />
    </Box>
  )
}
