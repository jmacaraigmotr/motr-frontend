import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { repairOrdersApi } from '@/api/repairOrders'
import { RO_STATUS_LABELS, RO_STATUS_COLORS } from '@/types/repairOrder'
import type { RepairOrderListItem } from '@/types/repairOrder'
import { formatDate } from '@/lib/utils'
import RODetailDrawer from '../customer-view/components/RODetailDrawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'
import { Wrench, Clock, CheckCircle, TrendingUp, Play } from 'lucide-react'
import { initials } from '@/lib/utils'

// ─── Active job card ───────────────────────────────────────────────────────────

function ActiveJobBanner({ ro, onClick }: { ro: RepairOrderListItem; onClick: () => void }) {
  const r = ro as RepairOrderListItem & Record<string, unknown>
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 4, mb: 3, cursor: 'pointer',
        background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.05) 100%)',
        border: '1.5px solid rgba(251,191,36,0.4)',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ p: '20px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: 'rgba(251,191,36,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Play size={18} color="#FBBF24" />
          </Box>
          <Box>
            <Typography variant="caption" color="primary.main" fontWeight={700} display="block">
              ACTIVE JOB
            </Typography>
            <Typography variant="body2" fontWeight={800} sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
              {ro.ro_number}
            </Typography>
          </Box>
          <Chip
            label={RO_STATUS_LABELS[ro.status]}
            size="small"
            color={RO_STATUS_COLORS[ro.status]}
            sx={{ ml: 'auto' }}
          />
        </Box>
        {ro.vehicles && (
          <Typography variant="body2" color="text.secondary">
            {ro.vehicles.year} {ro.vehicles.make} {ro.vehicles.model}
            {ro.vehicles.color ? ` · ${ro.vehicles.color}` : ''}
          </Typography>
        )}
        {ro.customers && (
          <Typography variant="caption" color="text.disabled">
            {ro.customers.first_name} {ro.customers.last_name}
          </Typography>
        )}
        {ro.scheduled_out_date && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
            <Clock size={12} style={{ opacity: 0.5 }} />
            <Typography variant="caption" color="text.secondary">
              Due: {formatDate(ro.scheduled_out_date)}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Queue card ────────────────────────────────────────────────────────────────

function QueueCard({ ro, index, onClick }: { ro: RepairOrderListItem; index: number; onClick: () => void }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, mb: 1.5 }}>
      <CardActionArea onClick={onClick} sx={{ p: 0 }}>
        <CardContent sx={{ p: '14px 16px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              bgcolor: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">{index + 1}</Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace', color: 'primary.main', fontSize: '0.8rem' }}>
                  {ro.ro_number}
                </Typography>
                <Chip
                  label={RO_STATUS_LABELS[ro.status]}
                  size="small"
                  color={RO_STATUS_COLORS[ro.status]}
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
                {ro.priority === 'rush' && (
                  <Chip label="RUSH" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }} />
                )}
              </Box>
              {ro.vehicles && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {ro.vehicles.year} {ro.vehicles.make} {ro.vehicles.model}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType; color?: string
}) {
  return (
    <Box sx={{
      flex: 1, textAlign: 'center', py: 2, px: 1,
      bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 3,
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <Box sx={{ color: color ?? 'text.disabled', mb: 0.5, display: 'flex', justifyContent: 'center' }}>
        <Icon size={20} />
      </Box>
      <Typography variant="h5" fontWeight={900} sx={{ color: color ?? 'text.primary', lineHeight: 1 }}>{value}</Typography>
      <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>{label}</Typography>
    </Box>
  )
}

// ─── Technician View ───────────────────────────────────────────────────────────

export default function TechnicianView() {
  const { user, shop } = useAuth()
  const [selectedROId, setSelectedROId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['repair_orders_tech', { shop_id: shop?.id, status: 'in_production' }],
    queryFn: () => repairOrdersApi.list({ shop_id: shop?.id, status: 'in_production', per_page: 50 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const ros = (data?.data ?? []) as RepairOrderListItem[]
  // For now treat first RO as "active" — once clock_entry API is built this will be real
  const activeRO = ros[0] ?? null
  const queue = ros.slice(1)

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', px: 2.5, py: 3, height: '100%', overflowY: 'auto' }}>
      {/* User header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ width: 48, height: 48, bgcolor: 'rgba(251,191,36,0.15)', color: 'primary.main', fontWeight: 800, fontSize: 16 }}>
          {initials(user?.first_name, user?.last_name)}
        </Avatar>
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>
            {user?.first_name} {user?.last_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.role?.name ?? 'Technician'}
          </Typography>
        </Box>
      </Box>

      {/* Stats row */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
        <StatTile label="Active" value={activeRO ? 1 : 0} icon={Play} color="#FBBF24" />
        <StatTile label="In Queue" value={queue.length} icon={Clock} color="#42A5F5" />
        <StatTile label="Efficiency" value="—" icon={TrendingUp} color="#66BB6A" />
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          {/* Active job */}
          {activeRO ? (
            <ActiveJobBanner ro={activeRO} onClick={() => setSelectedROId(activeRO.id)} />
          ) : (
            <Box sx={{
              textAlign: 'center', py: 4, mb: 3,
              bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4,
              border: '1px dashed rgba(255,255,255,0.1)',
            }}>
              <Wrench size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
              <Typography variant="body2" color="text.disabled">No active job.</Typography>
              <Typography variant="caption" color="text.disabled">Jobs will appear here when assigned.</Typography>
            </Box>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <>
              <Typography variant="overline" color="text.secondary" display="block" mb={1.5}>
                Up Next
              </Typography>
              {queue.map((ro, i) => (
                <QueueCard key={ro.id} ro={ro} index={i} onClick={() => setSelectedROId(ro.id)} />
              ))}
            </>
          )}
        </>
      )}

      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />
    </Box>
  )
}
