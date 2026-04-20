import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { repairOrdersApi } from '@/api/repairOrders'
import type { RepairOrderListItem } from '@/types/repairOrder'
import { formatCurrency, formatDate } from '@/lib/utils'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import { Car, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'

const ZONE_COLORS: Record<string, { bg: string; color: string }> = {
  north: { bg: '#1565C0', color: '#fff' },
  south: { bg: '#7B1FA2', color: '#fff' },
  east: { bg: '#00695C', color: '#fff' },
  west: { bg: '#E65100', color: '#fff' },
  inside: { bg: '#37474F', color: '#fff' },
}

function ZoneBadge({ zone }: { zone: string | null | undefined }) {
  if (!zone) return <Typography variant="caption" color="text.disabled">—</Typography>
  const key = zone.toLowerCase()
  const style = ZONE_COLORS[key] ?? { bg: '#424242', color: '#fff' }
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 1.5,
        py: 0.25,
        borderRadius: 2,
        bgcolor: style.bg,
        color: style.color,
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {zone}
    </Box>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color?: string
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, flex: 1, minWidth: 0 }}>
      <CardContent sx={{ p: '16px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {label}
          </Typography>
          <Box sx={{ color: color ?? 'text.disabled', opacity: 0.7, mt: 0.25 }}>
            <Icon size={16} />
          </Box>
        </Box>
        <Typography variant="h4" fontWeight={900} sx={{ color: color ?? 'text.primary', lineHeight: 1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

function RecentROTable({ ros }: { ros: RepairOrderListItem[] }) {
  if (ros.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.disabled">
          No repair orders found.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          '& th': {
            textAlign: 'left',
            px: 2,
            py: 1,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'text.disabled',
            borderBottom: '1px solid',
            borderColor: 'divider',
          },
          '& td': {
            px: 2,
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            fontSize: '0.85rem',
          },
          '& tbody tr:nth-of-type(even)': {
            bgcolor: 'rgba(0,0,0,0.015)',
          },
        }}
      >
        <thead>
          <tr>
            <th>RO #</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {ros.map((ro) => (
            <tr key={ro.id}>
              <td>{ro.ro_number}</td>
              <td>{ro.customer ? `${ro.customer.first_name} ${ro.customer.last_name}` : '–'}</td>
              <td>{ro.status ? ro.status.replace(/_/g, ' ') : '–'}</td>
              <td>{ro.actual_total ? formatCurrency(ro.actual_total) : ro.estimated_total ? formatCurrency(ro.estimated_total) : '–'}</td>
              <td>{ro.created_at ? formatDate(ro.created_at) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  )
}

export default function AdminOverviewView() {
  const { shop, user } = useAuth()
  const { data: rosData, isLoading } = useQuery({
    queryKey: ['repair_orders', { shop_id: shop?.id, page: 1, per_page: 50 }],
    queryFn: () => repairOrdersApi.list({ shop_id: shop?.id, per_page: 50 }),
    staleTime: 60_000,
  })

  const ros = (rosData?.data ?? []) as RepairOrderListItem[]
  const total = rosData?.pagination?.total ?? 0

  const openStatuses = [
    'new',
    'estimate_pending',
    'estimate_approved',
    'pre_order',
    'parts_ordered',
    'parts_partial',
    'parts_complete',
    'scheduled',
    'in_production',
    'qa_check',
    'detail',
    'ready_for_pickup',
  ]
  const inProd = ros.filter((r) => r.status === 'in_production').length
  const readyPickup = ros.filter((r) => r.status === 'ready_for_pickup').length
  const rush = ros.filter((r) => r.priority === 'rush').length

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Admin dashboard
        </Typography>
        <Typography variant="h5" fontWeight={900} mt={0.5}>
          {greeting}
          {user?.first_name ? `, ${user.first_name}` : ''}.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading stats…
            </Typography>
          </Box>
        ) : (
          <>
            <StatCard label="Total Open ROs" value={total} icon={Car} color="#FBBF24" />
            <StatCard label="In Production" value={inProd} icon={TrendingUp} color="#42A5F5" />
            <StatCard label="Ready for Pickup" value={readyPickup} icon={CheckCircle} color="#66BB6A" />
            <StatCard label="Rush Jobs" value={rush} icon={AlertCircle} color="#EF5350" />
          </>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary" display="block" mb={1.5}>
          Vehicle counts by location
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {['North', 'South', 'East', 'West', 'Inside'].map((zone) => {
            const count = ros.filter((r) => (r.zone ?? '').toLowerCase() === zone.toLowerCase()).length
            return (
              <Card key={zone} variant="outlined" sx={{ borderRadius: 3, minWidth: 120 }}>
                <CardContent sx={{ p: '12px 16px !important', textAlign: 'center' }}>
                  <ZoneBadge zone={zone} />
                  <Typography variant="h5" fontWeight={900} mt={1} sx={{ lineHeight: 1 }}>
                    {count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    vehicles
                  </Typography>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Recent repair orders
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Showing {ros.length} of {total}
          </Typography>
        </Box>
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <RecentROTable ros={ros} />
          )}
        </Card>
      </Box>
    </Box>
  )
}
