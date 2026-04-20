import { useState, lazy, Suspense } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Pagination from '@mui/material/Pagination'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/types/repairOrder'
import type { RepairOrderListItem } from '@/types/repairOrder'
import type { Customer } from '@/types/customer'
import type { FilterKey } from '../hooks/useROFilters'
import CSRDetailDialog from '@/components/CSRDetailDialog'

const CustomerDetailDialog = lazy(() => import('@/views/customers-view/components/CustomerDetailDialog'))

interface Props {
  items:        RepairOrderListItem[]
  page:         number
  pageCount:    number
  onPageChange: (page: number) => void
  onRowClick:   (id: number) => void
  filter:       FilterKey
  accentColor?: string
}

function ScheduledOut({ ro }: { ro: RepairOrderListItem }) {
  if (!ro.scheduled_out_date) return <Typography variant="caption" color="text.disabled">—</Typography>
  const isOverdue = new Date(ro.scheduled_out_date) < new Date()
  return (
    <Typography
      variant="caption"
      sx={{ color: isOverdue ? 'error.main' : 'text.secondary', fontWeight: isOverdue ? 700 : 400 }}
    >
      {formatDate(ro.scheduled_out_date)}
      {isOverdue ? ' · Overdue' : ''}
    </Typography>
  )
}

export default function ROTable({ items, page, pageCount, onPageChange, onRowClick, filter, accentColor }: Props) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCsrId, setSelectedCsrId] = useState<number | null>(null)

  return (
    <>
      <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', mb: 2, ...(accentColor && { borderTop: `3px solid ${accentColor}` }) }}>
        <Box
          component="table"
          sx={{
            width: '100%', borderCollapse: 'collapse',
            '& th': {
              textAlign: 'left', px: 2.5, py: 1.5,
              fontSize: '0.6875rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'text.disabled',
              borderBottom: '1.5px solid', borderColor: 'divider',
              whiteSpace: 'nowrap',
            },
            '& td': {
              px: 2.5, py: 1.75,
              fontSize: '0.8125rem',
              borderBottom: '1px solid', borderColor: 'divider',
              whiteSpace: 'nowrap',
            },
            '& tr:last-child td': { borderBottom: 'none' },
            // Zebra striping + clearer scanlines for dense shop tables.
            '& tbody tr:nth-of-type(even) td': { bgcolor: 'rgba(0,0,0,0.015)' },
            '& tbody tr': {
              cursor: 'pointer',
              '&:hover td': { bgcolor: 'rgba(0,0,0,0.035)' },
            },
          }}
        >
          <thead>
            <tr>
              <th>Job #</th>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Assigned</th>
              <th>Job Status</th>
              <th>Flags</th>
              <th>Created</th>
              <th>Sched. Out</th>
              <th style={{ textAlign: 'right' }}>Billing</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {items.map(ro => {
              const customerName = ro.customer ?? ro.customers
              const vehicle      = ro.vehicle  ?? ro.vehicles
              const vehicleLabel = vehicle
                ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || '—'
                : null

              return (
                <tr key={ro.id} onClick={() => onRowClick(ro.id)}>

                  {/* Job # */}
                  <td>
                    <Typography fontWeight={800} fontSize="0.92rem">
                      {ro.job_number != null ? `Job #${ro.job_number}` : ro.ro_number}
                    </Typography>
                    <Typography fontSize="0.72rem" color="text.disabled">
                      {ro.ro_number}
                    </Typography>
                  </td>

                  {/* Customer */}
                  <td onClick={customerName && ro.customer?.id ? e => { e.stopPropagation(); setSelectedCustomer(ro.customer as Customer) } : undefined}>
                    {customerName ? (
                      <Typography
                        fontSize="0.8125rem"
                        sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {customerName.first_name} {customerName.last_name}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </td>

                  {/* Vehicle */}
                  <td>
                    {vehicleLabel
                      ? (
                        <Box>
                          <Typography fontSize="0.8125rem">{vehicleLabel}</Typography>
                          {vehicle && 'color' in vehicle && vehicle.color && (
                            <Typography fontSize="0.72rem" color="text.disabled">{vehicle.color}</Typography>
                          )}
                        </Box>
                      )
                      : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </td>

                  {/* Assigned (CSR / Estimator) */}
                  <td>
                    {ro.csr || ro.estimator ? (
                      <Box>
                        {ro.csr && (
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            <Typography fontSize="0.62rem" fontWeight={700} color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>CSR</Typography>
                            <Typography
                              fontSize="0.8125rem"
                              sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              onClick={e => { e.stopPropagation(); setSelectedCsrId(ro.csr!.id) }}
                            >
                              {ro.csr.first_name} {ro.csr.last_name}
                            </Typography>
                          </Box>
                        )}
                        {ro.estimator && (
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            <Typography fontSize="0.62rem" fontWeight={700} color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Est</Typography>
                            <Typography
                              fontSize="0.72rem"
                              sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              onClick={e => { e.stopPropagation(); setSelectedCsrId(ro.estimator!.id) }}
                            >
                              {ro.estimator.first_name} {ro.estimator.last_name}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </td>

                  {/* Job Status */}
                  <td>
                    <Chip
                      label={JOB_STATUS_LABELS[ro.job_status ?? 'open']}
                      size="small"
                      color={JOB_STATUS_COLORS[ro.job_status ?? 'open']}
                      sx={{ fontSize: '0.68rem', height: 20 }}
                    />
                  </td>

                  {/* Flags — includes priority */}
                  <td>
                    {(ro.priority !== 'normal' || ro.is_total_loss || ro.rental_needed || (ro.has_outstanding_payment ?? 0) > 0) ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {ro.priority === 'rush'                   && <Chip label="Rush"       size="small" color="error"   variant="outlined" sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }} />}
                        {ro.priority === 'high'                   && <Chip label="High"       size="small" color="warning" variant="outlined" sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }} />}
                        {ro.is_total_loss                         && <Chip label="Total Loss" size="small" color="error"   variant="outlined" sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }} />}
                        {ro.rental_needed                         && <Chip label="Rental"     size="small" color="info"    variant="outlined" sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }} />}
                        {(ro.has_outstanding_payment ?? 0) > 0   && <Chip label="Unpaid"     size="small" color="warning" variant="outlined" sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }} />}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </td>

                  {/* Created At */}
                  <td>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(ro.created_at)}
                    </Typography>
                  </td>

                  {/* Scheduled Out */}
                  <td><ScheduledOut ro={ro} /></td>

                  {/* Job Total / Outstanding */}
                  <td style={{ textAlign: 'right' }}>
                    {(() => {
                      const jobTotal = (ro.job_total ?? []).reduce((s, p) => s + p.amount, 0)
                      const owed = (ro.outstanding_balance ?? []).reduce((s, p) => s + p.amount, 0)
                      if (jobTotal === 0) return <Typography variant="caption" color="text.disabled">—</Typography>
                      return (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Typography fontSize="0.62rem" fontWeight={700} color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</Typography>
                            <Typography fontSize="0.8125rem" fontWeight={600}>{formatCurrency(jobTotal)}</Typography>
                          </Box>
                          {owed > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5 }}>
                              <Typography fontSize="0.62rem" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'warning.main' }}>Owed</Typography>
                              <Typography fontSize="0.72rem" fontWeight={700} sx={{ color: 'warning.main' }}>{formatCurrency(owed)}</Typography>
                            </Box>
                          )}
                        </Box>
                      )
                    })()}
                  </td>

                  <td>
                    <ChevronRight size={14} style={{ opacity: 0.3 }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Box>
      </Card>

      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, v) => onPageChange(v)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}

      <CSRDetailDialog memberId={selectedCsrId} onClose={() => setSelectedCsrId(null)} />

      {selectedCustomer && (
        <Suspense fallback={null}>
          <CustomerDetailDialog
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            onEdit={() => setSelectedCustomer(null)}
            onNewRO={() => setSelectedCustomer(null)}
          />
        </Suspense>
      )}
    </>
  )
}
