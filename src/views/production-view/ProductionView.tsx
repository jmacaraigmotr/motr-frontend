import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { repairOrdersApi } from '@/api/repairOrders'
import { RO_STATUS_LABELS, RO_STATUS_COLORS } from '@/types/repairOrder'
import type { RepairOrderListItem, ROStatus } from '@/types/repairOrder'
import { formatDate } from '@/lib/utils'
import RODetailDrawer from '../customer-view/components/RODetailDrawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { RefreshCw, AlertTriangle, Clock } from 'lucide-react'

// ─── Kanban column config — matches V&J departments ───────────────────────────

interface KanbanColumn {
  key: ROStatus[]
  label: string
  color: string
  accent: string
}

const COLUMNS: KanbanColumn[] = [
  {
    key: ['new', 'estimate_pending', 'estimate_approved'],
    label: 'New / Estimate',
    color: '#1e1e1e',
    accent: '#78909C',
  },
  {
    key: ['pre_order'],
    label: 'Pre-Order',
    color: '#1a1625',
    accent: '#CE93D8',
  },
  {
    key: ['parts_ordered', 'parts_partial'],
    label: 'Parts Ordered',
    color: '#1a1a0f',
    accent: '#FFA726',
  },
  {
    key: ['parts_complete', 'scheduled'],
    label: 'On Deck',
    color: '#0f1a1a',
    accent: '#4FC3F7',
  },
  {
    key: ['in_production'],
    label: 'In Production',
    color: '#0f1520',
    accent: '#42A5F5',
  },
  {
    key: ['qa_check'],
    label: 'QA Check',
    color: '#1a1220',
    accent: '#BA68C8',
  },
  {
    key: ['detail'],
    label: 'Detail',
    color: '#0f1a10',
    accent: '#66BB6A',
  },
  {
    key: ['ready_for_pickup'],
    label: 'Ready for Pickup',
    color: '#0e1a0e',
    accent: '#A5D6A7',
  },
]

// ─── RO Kanban Card ────────────────────────────────────────────────────────────

function ROCard({
  ro, onClick,
}: {
  ro: RepairOrderListItem & Record<string, unknown>
  onClick: () => void
}) {
  const vehicle = ro.vehicles
  const customer = ro.customers
  const isOverdue = ro.scheduled_out_date && new Date(ro.scheduled_out_date) < new Date()
  const isRush = ro.priority === 'rush'
  const isHigh = ro.priority === 'high'

  return (
    <Card
      onClick={onClick}
      variant="outlined"
      sx={{
        borderRadius: 2.5, cursor: 'pointer',
        borderColor: isRush ? 'error.main' : isHigh ? 'warning.main' : 'divider',
        borderWidth: isRush || isHigh ? 1.5 : 1,
        transition: 'border-color 0.15s, transform 0.1s, box-shadow 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 20px rgba(251,191,36,0.1)',
        },
      }}
    >
      <CardContent sx={{ p: '10px 12px !important' }}>
        {/* RO # + priority */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography
            variant="body2" fontWeight={800}
            sx={{ color: 'primary.main', fontFamily: 'monospace', fontSize: '0.8rem' }}
          >
            {ro.ro_number}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isRush && (
              <Chip label="RUSH" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />
            )}
            {isHigh && !isRush && (
              <Chip label="HIGH" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
            )}
          </Box>
        </Box>

        {/* Vehicle */}
        {vehicle && (
          <Typography variant="caption" color="text.secondary" display="block" noWrap mb={0.25}>
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.color ? ` · ${vehicle.color}` : ''}
          </Typography>
        )}

        {/* Customer */}
        {customer && (
          <Typography variant="caption" color="text.disabled" display="block" noWrap mb={0.5}>
            {customer.first_name} {customer.last_name}
          </Typography>
        )}

        {/* Footer: location + due date */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
          {ro.zone ? (
            <Box sx={{
              px: 1, py: 0.125, borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.06)',
              fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {ro.zone as string}
            </Box>
          ) : <span />}

          {ro.scheduled_out_date && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isOverdue
                ? <AlertTriangle size={11} color="#EF5350" />
                : <Clock size={11} style={{ opacity: 0.4 }} />
              }
              <Typography
                variant="caption"
                sx={{ fontSize: '0.65rem', color: isOverdue ? 'error.main' : 'text.disabled' }}
              >
                {formatDate(ro.scheduled_out_date)}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanCol({
  column, ros, onSelect,
}: {
  column: KanbanColumn
  ros: (RepairOrderListItem & Record<string, unknown>)[]
  onSelect: (id: number) => void
}) {
  return (
    <Box sx={{
      flexShrink: 0, width: 240,
      display: 'flex', flexDirection: 'column',
      bgcolor: column.color, borderRadius: 3,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Column header */}
      <Box sx={{
        px: 2, py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: column.accent, flexShrink: 0 }} />
          <Typography variant="caption" fontWeight={700} sx={{ color: column.accent, letterSpacing: '0.04em' }}>
            {column.label}
          </Typography>
        </Box>
        <Box sx={{
          px: 1.25, py: 0.125, borderRadius: 100,
          bgcolor: 'rgba(255,255,255,0.07)',
          fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary',
        }}>
          {ros.length}
        </Box>
      </Box>

      {/* Cards */}
      <Box sx={{ flex: 1, p: 1.25, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {ros.length === 0 ? (
          <Typography variant="caption" color="text.disabled" textAlign="center" py={2} display="block">
            Empty
          </Typography>
        ) : (
          ros.map((ro) => (
            <ROCard key={ro.id} ro={ro} onClick={() => onSelect(ro.id)} />
          ))
        )}
      </Box>
    </Box>
  )
}

// ─── Production View ───────────────────────────────────────────────────────────

export default function ProductionView() {
  const { shop } = useAuth()
  const [selectedROId, setSelectedROId] = useState<number | null>(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['repair_orders_production', { shop_id: shop?.id }],
    queryFn: () => repairOrdersApi.list({ shop_id: shop?.id, per_page: 200 }),
    staleTime: 30_000,
    refetchInterval: 60_000, // auto-refresh every minute
  })

  const ros = (data?.data ?? []) as (RepairOrderListItem & Record<string, unknown>)[]

  // Total WIP count (everything not closed/delivered)
  const activeCount = ros.filter(r => !['closed', 'delivered'].includes(r.status)).length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{
        px: 4, py: 2.5,
        borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <Box>
          <Typography variant="overline" color="text.secondary">Production</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.25 }}>
            <Typography variant="h6" fontWeight={900}>Kanban Board</Typography>
            {!isLoading && (
              <Chip
                label={`${activeCount} active`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.72rem', height: 22 }}
              />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isFetching && !isLoading && (
            <Typography variant="caption" color="text.disabled">Syncing…</Typography>
          )}
          <Tooltip title="Refresh board">
            <IconButton onClick={() => refetch()} size="small">
              <RefreshCw size={16} style={{ animation: isFetching ? 'spin 1s linear infinite' : undefined }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Kanban board */}
      <Box sx={{ flex: 1, overflowX: 'auto', p: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', height: '100%' }}>
            {COLUMNS.map((col) => {
              const colROs = ros.filter(r => col.key.includes(r.status))
              return (
                <KanbanCol
                  key={col.label}
                  column={col}
                  ros={colROs}
                  onSelect={setSelectedROId}
                />
              )
            })}
          </Box>
        )}
      </Box>

      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />
    </Box>
  )
}
