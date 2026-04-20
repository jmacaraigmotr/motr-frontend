import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { repairOrdersApi } from '@/api/repairOrders'
import { RO_STATUS_LABELS, RO_STATUS_COLORS } from '@/types/repairOrder'
import type { RepairOrderListItem, ROStatus } from '@/types/repairOrder'
import { formatDate } from '@/lib/utils'
import RODetailDrawer from '../customer-view/components/RODetailDrawer'
import NewROWizard from '@/components/NewROWizard'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import { Search, RefreshCw, ChevronRight, Package, Plus } from 'lucide-react'

const ZONE_COLORS: Record<string, { bg: string; color: string }> = {
  north:  { bg: '#1565C0', color: '#fff' },
  south:  { bg: '#7B1FA2', color: '#fff' },
  east:   { bg: '#00695C', color: '#fff' },
  west:   { bg: '#E65100', color: '#fff' },
  inside: { bg: '#37474F', color: '#fff' },
  'pre-order': { bg: '#F06292', color: '#fff' },
}

function ZoneBadge({ zone }: { zone?: string | null }) {
  if (!zone) return <Typography variant="caption" color="text.disabled">—</Typography>
  const key = zone.toLowerCase()
  const style = ZONE_COLORS[key] ?? { bg: '#424242', color: '#fff' }
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      px: 1.5, py: 0.25, borderRadius: 2,
      bgcolor: style.bg, color: style.color,
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {zone}
    </Box>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const color = priority === 'rush' ? '#EF5350' : priority === 'high' ? '#FFA726' : 'transparent'
  if (color === 'transparent') return null
  return <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: color, mr: 1, flexShrink: 0 }} />
}

const STATUS_GROUPS = [
  { label: 'All Open', value: 'open' },
  { label: 'New',      value: 'new' },
  { label: 'Pre-Order',value: 'pre_order' },
  { label: 'Parts',    value: 'parts_ordered' },
  { label: 'In Prod',  value: 'in_production' },
  { label: 'QA',       value: 'qa_check' },
  { label: 'Ready',    value: 'ready_for_pickup' },
  { label: 'Closed',   value: 'closed' },
] as const

const OPEN_STATUSES: ROStatus[] = [
  'new','estimate_pending','estimate_approved','pre_order',
  'parts_ordered','parts_partial','parts_complete',
  'scheduled','in_production','qa_check','detail','ready_for_pickup',
]

function ROTable({ ros, onSelect }: { ros: RepairOrderListItem[]; onSelect: (id: number) => void }) {
  if (ros.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Package size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
        <Typography variant="body2" color="text.disabled">No repair orders match this filter.</Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" sx={{
        width: '100%', borderCollapse: 'collapse',
        '& th': { textAlign: 'left', px: 2, py: 1.25, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.disabled', borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' },
        '& td': { px: 2, py: 1.5, fontSize: '0.8125rem', borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' },
        '& tr:last-child td': { borderBottom: 'none' },
        '& tbody tr': { cursor: 'pointer', transition: 'background-color 0.1s', '&:hover td': { bgcolor: 'rgba(255,255,255,0.03)' } },
      }}>
        <thead>
          <tr>
            <th style={{ width: 110 }}>Job #</th>
            <th>Model</th>
            <th>Location</th>
            <th>Job Total</th>
            <th>Status</th>
            <th>Customer</th>
            <th>CSR</th>
            <th>Estimator</th>
            <th>Created</th>
            <th>Sched. Out</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {ros.map((ro) => {
            return (
              <tr key={ro.id} onClick={() => onSelect(ro.id)}>
                <td>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PriorityDot priority={ro.priority} />
                    <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.main', fontFamily: 'monospace', fontSize: '0.8rem' }}>{ro.ro_number}</Typography>
                  </Box>
                </td>
                <td>
                  <Typography variant="body2">{ro.vehicles ? `${ro.vehicles.year ?? ''} ${ro.vehicles.make ?? ''} ${ro.vehicles.model ?? ''}`.trim() || '—' : '—'}</Typography>
                  {ro.vehicles?.color && <Typography variant="caption" color="text.disabled" display="block">{ro.vehicles.color}</Typography>}
                </td>
                <td><ZoneBadge zone={ro.zone ?? undefined} /></td>
                <td>
                  <Typography variant="body2" fontWeight={500}>
                    {ro.actual_total ? `$${(ro.actual_total / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </Typography>
                </td>
                <td><Chip label={RO_STATUS_LABELS[ro.status]} size="small" color={RO_STATUS_COLORS[ro.status]} sx={{ fontSize: '0.7rem', height: 22 }} /></td>
                <td>{ro.customers ? `${ro.customers.first_name} ${ro.customers.last_name}` : '—'}</td>
                <td><Typography variant="caption" color="text.secondary">{ro.csr ? `${ro.csr.first_name} ${ro.csr.last_name}` : '—'}</Typography></td>
                <td><Typography variant="caption" color="text.secondary">{ro.estimator ? `${ro.estimator.first_name} ${ro.estimator.last_name}` : '—'}</Typography></td>
                <td><Typography variant="caption" color="text.secondary">{formatDate(ro.created_at)}</Typography></td>
                <td>
                  <Typography variant="caption" sx={{ color: ro.scheduled_out_date ? (new Date(ro.scheduled_out_date) < new Date() ? 'error.main' : 'text.primary') : 'text.disabled' }}>
                    {formatDate(ro.scheduled_out_date)}
                  </Typography>
                </td>
                <td><ChevronRight size={16} style={{ opacity: 0.3 }} /></td>
              </tr>
            )
          })}
        </tbody>
      </Box>
    </Box>
  )
}

export default function LogisticsView() {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [selectedROId, setSelectedROId] = useState<number | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['repair_orders_logistics', { shop_id: shop?.id }],
    queryFn: () => repairOrdersApi.list({ shop_id: shop?.id, per_page: 200 }),
    staleTime: 30_000,
  })

  const allROs = (data?.data ?? []) as (RepairOrderListItem & Record<string, unknown>)[]

  const filtered = useMemo(() => {
    let list = allROs
    if (statusFilter === 'open') list = list.filter(r => OPEN_STATUSES.includes(r.status))
    else if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => {
        const ro = r as RepairOrderListItem & Record<string, unknown>
        return ro.ro_number?.toLowerCase().includes(q) ||
          `${ro.customers?.first_name ?? ''} ${ro.customers?.last_name ?? ''}`.toLowerCase().includes(q) ||
          ro.vehicles?.make?.toLowerCase().includes(q) ||
          ro.vehicles?.model?.toLowerCase().includes(q) ||
          (ro.zone as string | undefined)?.toLowerCase().includes(q)
      })
    }
    return list
  }, [allROs, statusFilter, search])

  const openCount = allROs.filter(r => OPEN_STATUSES.includes(r.status)).length
  const outstandingCount = allROs.filter(r => OPEN_STATUSES.includes(r.status) && (r.has_outstanding_payment ?? 0) > 0).length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <Box sx={{ px: 4, pt: 4, pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="overline" color="text.secondary">Logistics</Typography>
            <Typography variant="h5" fontWeight={900} mt={0.5}>Repair Orders</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" size="small" startIcon={<Plus size={15} />} onClick={() => setWizardOpen(true)} sx={{ borderRadius: 100 }}>
              Add New Repair Order
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={() => refetch()} disabled={isFetching} size="small">
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Summary */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, flex: 1 }}>
            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="caption" color="text.secondary">Total Open Repair Orders</Typography>
              <Typography variant="h4" fontWeight={900} mt={0.5}>{openCount}</Typography>
            </Box>
          </Card>
          <Card variant="outlined" sx={{ borderRadius: 3, flex: 1 }}>
            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="caption" color="text.secondary"># of Jobs with Outstanding Payments</Typography>
              <Typography variant="h4" fontWeight={900} mt={0.5} color="warning.main">{outstandingCount}</Typography>
            </Box>
          </Card>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small" placeholder="Search job #, customer, model, location…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 300 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={15} style={{ opacity: 0.5 }} /></InputAdornment> }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {STATUS_GROUPS.map((sg) => (
              <Box key={sg.value} component="button" onClick={() => setStatusFilter(sg.value)}
                sx={{
                  px: 2, py: 0.75, borderRadius: 100, border: '1px solid', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                  borderColor: statusFilter === sg.value ? 'primary.main' : 'rgba(255,255,255,0.15)',
                  bgcolor: statusFilter === sg.value ? 'rgba(251,191,36,0.12)' : 'transparent',
                  color: statusFilter === sg.value ? 'primary.main' : 'text.secondary',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                }}>
                {sg.label}
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>{filtered.length} shown</Typography>
        </Box>
      </Box>

      <Box sx={{ px: 4, pb: 4, flex: 1 }}>
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {isLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={24} /></Box>
            : <ROTable ros={filtered} onSelect={setSelectedROId} />}
        </Card>
      </Box>

      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />
      <NewROWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(_roNumber, roId) => {
          setWizardOpen(false)
          qc.invalidateQueries({ queryKey: ['repair_orders_logistics'] })
          setSelectedROId(roId)
        }}
        onViewRO={(roId) => {
          setWizardOpen(false)
          setSelectedROId(roId)
        }}
      />
    </Box>
  )
}
