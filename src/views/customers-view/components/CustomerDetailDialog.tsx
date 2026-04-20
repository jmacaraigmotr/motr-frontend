import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { customersApi } from '@/api/customers'
import { companiesApi } from '@/api/companies'
import { documentsApi } from '@/api/documents'
import { vehiclesApi } from '@/api/vehicles'
import type { UpdateVehicleInput } from '@/api/vehicles'
import { repairOrdersApi } from '@/api/repairOrders'
import { teamApi } from '@/api/team'
import type { Customer, CustomerHistory, ActivityLogEntry } from '@/types/customer'
import type { CustomerDocument } from '@/types/document'
import type { Vehicle } from '@/types/vehicle'
import type { RepairOrderListItem, ROStatus, PaymentWithContext } from '@/types/repairOrder'
import { RO_STATUS_LABELS, RO_STATUS_COLORS, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/types/repairOrder'
import { TRANSACTION_TYPES, PAYMENT_STATUSES } from '@/lib/transactionConstants'
import { formatDistanceToNow } from 'date-fns'
import { formatDate, formatDateTime, formatCurrency, initials } from '@/lib/utils'
import RODetailDrawer from '@/views/customer-view/components/RODetailDrawer'
import AddVehicleDialog from './AddVehicleDialog'
import AddTransactionDialog from './AddTransactionDialog'
import TransactionDetailsModal from '@/components/TransactionDetailsModal'
import VehicleDetailDialog from './VehicleDetailDialog'
import NewROWizard from '@/components/NewROWizard'
import CSRDetailDialog from '@/components/CSRDetailDialog'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Pagination from '@mui/material/Pagination'
import Divider from '@mui/material/Divider'
import {
  X, Pencil, Plus, Phone, Mail, MapPin, Car, FileText,
  ClipboardList, CreditCard, History,
  DollarSign, IdCard, ExternalLink, FolderOpen, Receipt,
} from 'lucide-react'

// ─── Tab Panel ────────────────────────────────────────────────────────────────

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

// ─── Info Field ───────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 500, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.4 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 500, color: value != null ? 'text.primary' : 'text.disabled' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  )
}

// ─── Segmented cell ───────────────────────────────────────────────────────────

function SegCell({ label, value, border, children }: { label: string; value?: string | number | null; border?: boolean; children?: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: border ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
        {label}
      </Typography>
      {children ?? (
        <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: value != null ? 'text.primary' : 'text.disabled' }}>
          {value ?? '—'}
        </Typography>
      )}
    </Box>
  )
}

function SegRow({ children, border }: { children: React.ReactNode; border?: boolean }) {
  return (
    <Box sx={{ display: 'flex', borderTop: border ? '1px solid' : 'none', borderColor: 'divider' }}>
      {children}
    </Box>
  )
}

function SegBlock({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      {children}
    </Box>
  )
}

function SegLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'text.secondary' }}>
        {children}
      </Typography>
    </Box>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>{message}</Typography>
    </Box>
  )
}

// ─── Section Card ────────────────────────────────────────────────────────────

const CARD_SX = {
  borderRadius: 3,
  boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)',
  bgcolor: 'background.paper',
  overflow: 'hidden',
  height: '100%',
  boxSizing: 'border-box',
} as const


function SectionCard({ title, icon, badge, children }: {
  title: string
  icon?: React.ReactNode
  badge?: string
  children: React.ReactNode
}) {
  return (
    <Box sx={CARD_SX}>
      <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'rgba(0,0,0,0.05)', bgcolor: 'rgba(0,0,0,0.015)' }}>
        {icon && <Box sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center' }}>{icon}</Box>}
        <Typography sx={{ fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'text.secondary', flex: 1 }}>
          {title}
        </Typography>
        {badge && (
          <Chip label={badge} size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: 'rgba(0,0,0,0.04)', border: 'none' }} />
        )}
      </Box>
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        {children}
      </Box>
    </Box>
  )
}

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────

function VehiclesTab({ customer, onSelectRO }: { customer: Customer; onSelectRO: (id: number) => void }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [roWizardVehicle, setRoWizardVehicle] = useState<Vehicle | null>(null)
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null)
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null)
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null)
  const [mutError, setMutError] = useState<string | null>(null)

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ['vehicles', customer.id],
    queryFn: () => vehiclesApi.listByCustomer(customer.id),
    staleTime: 30_000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => vehiclesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles', customer.id] })
      qc.invalidateQueries({ queryKey: ['customers_table'] })
      setVehicleToDelete(null)
      setDetailVehicle(null)
      setMutError(null)
    },
    onError: (err: { message?: string }) => setMutError(err.message ?? 'Failed to delete'),
  })

  if (isLoading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {[1, 2, 3].map(i => <Skeleton key={i} height={72} variant="rounded" />)}
    </Box>
  )

  return (
    <Box>
      {/* Header row with Add button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} on file
        </Typography>
        <Button size="small" variant="contained" startIcon={<Plus size={15} />} onClick={() => setShowAdd(true)}>
          Add Vehicle
        </Button>
      </Box>

      {mutError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setMutError(null)}>{mutError}</Alert>}

      {/* Empty state */}
      {vehicles.length === 0 && (
        <Box sx={{ py: 5, textAlign: 'center', borderRadius: 2, border: '1.5px dashed', borderColor: 'divider' }}>
          <Car size={32} style={{ opacity: 0.25, marginBottom: 8 }} />
          <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem', mb: 2 }}>
            No vehicles on file for this customer.
          </Typography>
          <Button variant="contained" size="small" startIcon={<Plus size={15} />} onClick={() => setShowAdd(true)}>
            Add Vehicle
          </Button>
        </Box>
      )}

      {/* Vehicle cards */}
      <Stack spacing={1.5}>
        {vehicles.map((v) => (
          <Box
            key={v.id}
            sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', flexShrink: 0 }}>
              <Car size={20} style={{ opacity: 0.6 }} />
            </Box>
            <Box
              sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
              onClick={() => setDetailVehicle(v)}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
                {v.trim ? ` · ${v.trim}` : ''}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                {[v.color, v.license_plate && [v.license_plate, v.license_state].filter(Boolean).join(' '), v.vin].filter(Boolean).join(' · ') || 'No additional details'}
              </Typography>
            </Box>
            {v.mileage_in && (
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', flexShrink: 0 }}>
                {v.mileage_in.toLocaleString()} mi
              </Typography>
            )}
            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ExternalLink size={13} />}
                onClick={() => setDetailVehicle(v)}
                sx={{ fontSize: '0.78rem' }}
              >
                View Details
              </Button>
              <Button size="small" variant="contained" startIcon={<Plus size={13} />} onClick={() => setRoWizardVehicle(v)} sx={{ fontSize: '0.78rem' }}>
                New RO
              </Button>
              <Button size="small" startIcon={<Pencil size={13} />} onClick={() => setEditVehicle(v)} sx={{ fontSize: '0.78rem' }}>
                Edit
              </Button>
              <Button size="small" color="error" startIcon={<X size={13} />} onClick={() => setVehicleToDelete(v)} sx={{ fontSize: '0.78rem' }}>
                Delete
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>

      {/* Vehicle detail modal */}
      {detailVehicle && (
        <VehicleDetailDialog
          vehicle={detailVehicle}
          onClose={() => setDetailVehicle(null)}
          onEdit={() => { setEditVehicle(detailVehicle); setDetailVehicle(null) }}
          onDelete={() => setVehicleToDelete(detailVehicle)}
          onNewRO={() => setRoWizardVehicle(detailVehicle)}
          onSelectRO={(id) => { setDetailVehicle(null); onSelectRO(id) }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={vehicleToDelete != null}
        onClose={() => !deleteMut.isPending && setVehicleToDelete(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Delete Vehicle</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to delete{' '}
            <strong>
              {[vehicleToDelete?.year, vehicleToDelete?.make, vehicleToDelete?.model].filter(Boolean).join(' ') || 'this vehicle'}
            </strong>
            ? This cannot be undone.
          </Typography>
          {vehicleToDelete && (
            <Box sx={{ px: 2, py: 1.5, borderRadius: 2, bgcolor: 'action.hover', fontSize: '0.85rem', color: 'text.secondary' }}>
              {[vehicleToDelete.color, vehicleToDelete.license_plate, vehicleToDelete.vin].filter(Boolean).join(' · ') || 'No additional details'}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setVehicleToDelete(null)}
            disabled={deleteMut.isPending}
            sx={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => vehicleToDelete && deleteMut.mutate(vehicleToDelete.id)}
            disabled={deleteMut.isPending}
            startIcon={deleteMut.isPending ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ flex: 1 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Vehicle dialog */}
      {showAdd && (
        <AddVehicleDialog
          customer={customer}
          onClose={() => setShowAdd(false)}
          onSaved={() => setShowAdd(false)}
        />
      )}

      {/* Edit Vehicle dialog — same form, pre-filled */}
      {editVehicle && (
        <AddVehicleDialog
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSaved={() => setEditVehicle(null)}
        />
      )}

      <NewROWizard
        open={roWizardVehicle !== null}
        onClose={() => setRoWizardVehicle(null)}
        onSuccess={(_roNumber, roId) => { setRoWizardVehicle(null); onSelectRO(roId) }}
        preselectedCustomer={customer}
        preselectedVehicle={roWizardVehicle}
      />
    </Box>
  )
}

// ─── Repair Orders Tab ────────────────────────────────────────────────────────

const RO_PER_PAGE = 20

function RepairOrdersTab({ customerId, enabled, onSelectRO }: {
  customerId: number
  enabled: boolean
  onSelectRO: (id: number) => void
}) {
  const [page, setPage] = useState(1)
  const [txRo, setTxRo] = useState<RepairOrderListItem | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer_ros_tab', customerId, page],
    queryFn: () => repairOrdersApi.list({ customer_id: customerId, page, per_page: RO_PER_PAGE }),
    staleTime: 30_000,
    enabled,
  })

  const ros: RepairOrderListItem[] = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const pageCount = Math.ceil(total / RO_PER_PAGE)
  const showSkeleton = isLoading && ros.length === 0

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Job #</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>RO #</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Job Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Shop</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Job Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Arrived</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {showSkeleton ? <SkeletonRows cols={8} /> : ros.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No repair orders found.
              </TableCell>
            </TableRow>
          ) : ros.map((ro) => {
            const v = ro.vehicle ?? ro.vehicles
            const vehicleLabel = v
              ? `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim() || '—'
              : '—'
            return (
              <TableRow
                key={ro.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onSelectRO(ro.id)}
              >
                <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{ro.job_number ?? '—'}</TableCell>
                <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{ro.ro_number}</TableCell>
                <TableCell>
                  <Chip
                    label={JOB_STATUS_LABELS[ro.job_status ?? 'open']}
                    color={JOB_STATUS_COLORS[ro.job_status ?? 'open']}
                    size="small"
                    sx={{ fontSize: '0.72rem' }}
                  />
                </TableCell>
                <TableCell>
                  {ro.shop ? (
                    <Chip
                      label={ro.shop.name}
                      size="small"
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: ro.shop.brand_color ? `${ro.shop.brand_color}22` : 'action.selected',
                        color: ro.shop.brand_color ?? 'text.secondary',
                        border: '1px solid',
                        borderColor: ro.shop.brand_color ? `${ro.shop.brand_color}55` : 'divider',
                      }}
                    />
                  ) : '—'}
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                  {ro.job_type?.replace('_', ' ') ?? '—'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{vehicleLabel}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{formatDate(ro.arrived_at) || '—'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      startIcon={<DollarSign size={13} />}
                      onClick={(e) => { e.stopPropagation(); setTxRo(ro) }}
                      sx={{ fontSize: '0.78rem' }}
                    >
                      Add Tx
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ExternalLink size={13} />}
                      onClick={(e) => { e.stopPropagation(); onSelectRO(ro.id) }}
                      sx={{ fontSize: '0.78rem' }}
                    >
                      View
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {isError && ros.length === 0 && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
          Unable to load repair orders. Please try again later.
        </Alert>
      )}

      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            color="primary"
          />
        </Box>
      )}

      {txRo && (
        <AddTransactionDialog
          preselectedRo={txRo}
          onClose={() => setTxRo(null)}
          onSaved={() => setTxRo(null)}
        />
      )}
    </>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

const TX_PER_PAGE = 20

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid:         { bg: '#DCFCE7', text: '#166534' },
  not_paid:     { bg: '#FEE2E2', text: '#991B1B' },
  approved:     { bg: '#DBEAFE', text: '#1E40AF' },
  not_approved: { bg: '#FEF3C7', text: '#92400E' },
}

function TransactionsTab({ customerId, customer, enabled }: {
  customerId: number
  customer: Customer
  enabled: boolean
}) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [addTxOpen, setAddTxOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithContext | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customer_transactions', customerId, page],
    queryFn: () => repairOrdersApi.listAllPayments({ customer_id: customerId, page, per_page: TX_PER_PAGE }),
    staleTime: 30_000,
    enabled,
  })

  const payments: PaymentWithContext[] = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const pageCount = Math.ceil(total / TX_PER_PAGE)

  const totalPaid = payments
    .filter(p => p.payment_status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {total > 0 ? `${total} transaction${total !== 1 ? 's' : ''}` : 'Transactions'}
          </Typography>
          {totalPaid > 0 && (
            <Typography sx={{ fontSize: '0.8rem', color: 'success.main', fontWeight: 600 }}>
              {formatCurrency(totalPaid)} paid
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<DollarSign size={14} />}
          onClick={() => setAddTxOpen(true)}
        >
          Add Transaction
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height={64} variant="rounded" />)}
        </Box>
      ) : payments.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Receipt size={28} style={{ opacity: 0.18, marginBottom: 8 }} />
          <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>No transactions recorded yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {payments.map((p) => {
            const txType = TRANSACTION_TYPES.find(t => t.value === p.transaction_type)
            const status = PAYMENT_STATUSES.find(s => s.value === p.payment_status)
            const statusColors = p.payment_status ? PAYMENT_STATUS_COLORS[p.payment_status] : null
            const dateLabel = p.date_added ? formatDate(p.date_added) : formatDate(p.created_at)
            const ro = p.repair_order
            const employee = p.received_by_user
              ? `${p.received_by_user.first_name} ${p.received_by_user.last_name}`.trim()
              : null

            return (
              <Box
                key={p.id}
                onClick={() => setSelectedPayment(p)}
                sx={{
                  p: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: 2.5,
                  display: 'flex', alignItems: 'center', gap: 2,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.4 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
                      {formatCurrency(p.amount)}
                    </Typography>
                    {statusColors && status && (
                      <Chip
                        label={status.label}
                        size="small"
                        sx={{ bgcolor: statusColors.bg, color: statusColors.text, fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                      />
                    )}
                    {txType && (
                      <Chip label={txType.label} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 20 }} />
                    )}
                    {(p.total_events ?? 0) > 0 && (
                      <Chip
                        label={`${p.total_events} event${p.total_events !== 1 ? 's' : ''}`}
                        size="small"
                        sx={{ fontSize: '0.65rem', height: 20, bgcolor: 'action.selected' }}
                      />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                    {dateLabel}
                    {employee && ` · ${employee}`}
                  </Typography>
                  {p.notes && (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}>{p.notes}</Typography>
                  )}
                </Box>
                {ro && (
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {ro.job_number ? `Job #${ro.job_number}` : `RO #${ro.ro_number}`}
                    </Typography>
                    <Chip
                      label={RO_STATUS_LABELS[ro.status] ?? ro.status}
                      color={RO_STATUS_COLORS[ro.status] ?? 'default'}
                      size="small"
                      sx={{ fontSize: '0.65rem', height: 18, mt: 0.25 }}
                    />
                  </Box>
                )}
              </Box>
            )
          })}
        </Stack>
      )}

      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={pageCount} page={page} onChange={(_, v) => setPage(v)} size="small" color="primary" />
        </Box>
      )}

      {addTxOpen && (
        <AddTransactionDialog
          customer={customer}
          onClose={() => setAddTxOpen(false)}
          onSaved={() => {
            setAddTxOpen(false)
            qc.invalidateQueries({ queryKey: ['customer_transactions', customerId] })
            qc.invalidateQueries({ queryKey: ['customer_payments_summary', customerId] })
            qc.invalidateQueries({ queryKey: ['customer_detail', customerId] })
          }}
        />
      )}

      <TransactionDetailsModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </Box>
  )
}

// ─── Customer History / Activity Tab ─────────────────────────────────────────

// Human-readable labels for each entity_type + action_type combo
function buildActivityText(entry: ActivityLogEntry, customerName: string): string {
  const { action_type, entity_type, entity_name, metadata, new_values } = entry

  // Prefer job_number from metadata, fall back to entity_name
  const roJobNumber = metadata?.job_number != null ? `Job #${metadata.job_number}` : (entity_name ? `"${entity_name}"` : '')
  const entityLabel = entity_name ? `"${entity_name}"` : ''

  if (entity_type === 'customers') {
    if (action_type === 'create') return `added ${customerName} as a customer`
    if (action_type === 'update') return `updated customer info`
    if (action_type === 'delete') return `deleted customer record`
  }
  if (entity_type === 'repair_orders') {
    if (action_type === 'create') return `created Repair Order ${roJobNumber}`
    if (action_type === 'update') return `updated Repair Order ${roJobNumber}`
    if (action_type === 'delete') return `deleted Repair Order ${roJobNumber}`
  }
  if (entity_type === 'payments') {
    const amount = new_values?.amount != null ? ` of ${formatCurrency(Number(new_values.amount))}` : ''
    if (action_type === 'create') return `added a transaction${amount}`
    if (action_type === 'update') return `updated a transaction`
    if (action_type === 'delete') return `deleted a transaction`
  }
  if (entity_type === 'vehicles') {
    if (action_type === 'create') return `added vehicle ${entityLabel}`
    if (action_type === 'update') return `updated vehicle ${entityLabel}`
    if (action_type === 'delete') return `deleted vehicle ${entityLabel}`
  }
  return `${action_type} ${entity_type}${entityLabel ? ` ${entityLabel}` : ''}`
}

const FIELD_LABELS: Record<string, string> = {
  first_name:                  'First Name',
  last_name:                   'Last Name',
  company_id:                  'Company',
  email:                       'Email',
  phone:                       'Phone',
  phone_secondary:             'Secondary Phone',
  preferred_contact:           'Preferred Contact',
  address_line1:               'Street Address',
  city:                        'City',
  state:                       'State',
  zip:                         'ZIP',
  has_different_pickup_address: 'Different Pickup',
  pickup_address_line1:        'Pickup Street',
  pickup_city:                 'Pickup City',
  pickup_state:                'Pickup State',
  pickup_zip:                  'Pickup ZIP',
  drivers_license:             "Driver's License",
  location_attribution:        'Location Attribution',
  assigned_csr_id:             'Assigned CSR',
  referred_by:                 'Referred By',
  referred_by_customer_id:     'Referred By Customer',
  referred_by_employee_id:     'Referred By Employee',
  referrer_name:               'Referrer Name',
  notes:                       'Notes',
}

// Show which fields changed on an update entry
function ChangedFields({ oldVals, newVals, teamMembers = [], companies = [], onMemberClick }: {
  oldVals: Record<string, unknown> | null
  newVals: Record<string, unknown> | null
  teamMembers?: import('@/api/team').TeamMember[]
  companies?: import('@/types/company').Company[]
  onMemberClick?: (id: number) => void
}) {
  if (!oldVals || !newVals) return null

  const SKIP = new Set(['updated_at', 'version', 'deleted_at', 'created_at', 'id', 'shop_id', 'company'])
  const MEMBER_ID_KEYS = new Set(['assigned_csr_id', 'referred_by_employee_id'])
  const COMPANY_ID_KEYS = new Set(['company_id'])

  const changed = Object.keys(newVals).filter(k => {
    if (SKIP.has(k)) return false
    const o = JSON.stringify(oldVals[k] ?? null)
    const n = JSON.stringify(newVals[k] ?? null)
    return o !== n
  })

  if (!changed.length) return null

  function renderValue(key: string, val: unknown, strikethrough?: boolean) {
    const color = strikethrough ? 'error.main' : 'success.main'
    const textSx = { fontSize: '0.72rem', color, textDecoration: strikethrough ? 'line-through' : 'none', wordBreak: 'break-all' } as const
    if (val == null) {
      return <Typography component="span" sx={{ ...textSx, color: strikethrough ? 'error.main' : 'success.main' }}>—</Typography>
    }
    if (COMPANY_ID_KEYS.has(key)) {
      const company = companies.find(c => c.id === Number(val))
      const label = company?.name ?? `Company #${val}`
      return <Typography component="span" sx={textSx}>{label}</Typography>
    }
    if (MEMBER_ID_KEYS.has(key) && onMemberClick) {
      const member = teamMembers.find(m => m.id === Number(val))
      const name = member
        ? (member.name || `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()) || `User #${val}`
        : `User #${val}`
      return (
        <Box
          component="span"
          onClick={() => onMemberClick(Number(val))}
          sx={{
            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
            color: strikethrough ? 'error.main' : 'primary.main',
            textDecoration: strikethrough ? 'line-through' : 'underline',
            textDecorationStyle: 'dotted',
            '&:hover': { opacity: 0.75 },
          }}
        >
          {name}
        </Box>
      )
    }
    return <Typography component="span" sx={textSx}>{String(val)}</Typography>
  }

  return (
    <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
      {changed.slice(0, 6).map(k => (
        <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.disabled', minWidth: 0 }}>
            {FIELD_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\bid\b/gi, '').trim()}
          </Typography>
          {renderValue(k, oldVals[k], true)}
          <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>→</Typography>
          {renderValue(k, newVals[k], false)}
        </Box>
      ))}
      {changed.length > 6 && (
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
          +{changed.length - 6} more fields
        </Typography>
      )}
    </Box>
  )
}

const ENTITY_DOT: Record<string, string> = {
  customers:     '#6366F1',
  repair_orders: '#F59E0B',
  payments:      '#22C55E',
  vehicles:      '#0EA5E9',
}

const ACTION_DOT: Record<string, string> = {
  create: '#22C55E',
  update: '#6366F1',
  delete: '#EF4444',
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function CustomerHistoryTab({ customerId, customerName, enabled, teamMembers = [], companies = [], onSelectRO }: {
  customerId: number
  customerName: string
  enabled: boolean
  teamMembers?: import('@/api/team').TeamMember[]
  companies?: import('@/types/company').Company[]
  onSelectRO?: (id: number) => void
}) {
  const [csrDetailId, setCsrDetailId] = useState<number | null>(null)

  const { data: entries = [], isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ['customer_activity', customerId],
    queryFn: () => customersApi.activity(customerId),
    staleTime: 60_000,
    enabled,
  })

  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={24} /></Box>
  }

  if (!sorted.length) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <History size={28} style={{ opacity: 0.18, marginBottom: 8 }} />
        <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>No activity recorded yet.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {sorted.map((entry, idx) => {
        const dot = ACTION_DOT[entry.action_type] ?? ENTITY_DOT[entry.entity_type] ?? '#94A3B8'
        // Prefer first_name + last_name over the `name` field (which may be "system")
        const actor = entry.user
          ? ([entry.user.first_name, entry.user.last_name].filter(Boolean).join(' ') || entry.user.name || entry.user_email || 'System')
          : (entry.user_email ?? 'System')
        const actionText = buildActivityText(entry, customerName)
        const isLast = idx === sorted.length - 1
        const isClickable = Boolean(entry.user?.id)
        const isROEntry = entry.entity_type === 'repair_orders' && entry.entity_id != null && onSelectRO

        return (
          <Box key={entry.id} sx={{ display: 'flex', gap: 2 }}>
            {/* Timeline spine */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: dot, mt: 1.4, flexShrink: 0 }} />
              {!isLast && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', mt: 0.5 }} />}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, minWidth: 0, pb: 2.5 }}>
              {/* Actor line */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 700,
                      cursor: isClickable ? 'pointer' : 'default',
                      borderBottom: isClickable ? '1px dotted' : 'none',
                      borderColor: 'text.secondary',
                      '&:hover': isClickable ? { color: 'primary.main', borderColor: 'primary.main' } : {},
                    }}
                    onClick={isClickable ? () => setCsrDetailId(entry.user!.id) : undefined}
                  >
                    {actor}
                  </Box>
                  {' '}
                  <Box
                    component="span"
                    sx={{
                      color: isROEntry ? 'primary.main' : 'text.secondary',
                      cursor: isROEntry ? 'pointer' : 'default',
                      fontWeight: isROEntry ? 600 : 'inherit',
                      borderBottom: isROEntry ? '1px dotted' : 'none',
                      borderColor: 'primary.main',
                      '&:hover': isROEntry ? { opacity: 0.75 } : {},
                    }}
                    onClick={isROEntry ? () => onSelectRO!(entry.entity_id!) : undefined}
                  >
                    {actionText}
                  </Box>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{formatDateTime(entry.created_at)}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>·</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                    {(() => { try { return formatDistanceToNow(new Date(entry.created_at), { addSuffix: true }) } catch { return '' } })()}
                  </Typography>
                </Box>
              </Box>

              {/* Description if any */}
              {entry.description && (
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.2 }}>
                  {entry.description}
                </Typography>
              )}

              {/* Changed fields diff for updates */}
              {entry.action_type === 'update' && (
                <ChangedFields oldVals={entry.old_values as Record<string, unknown> | null} newVals={entry.new_values as Record<string, unknown> | null} teamMembers={teamMembers} companies={companies} onMemberClick={setCsrDetailId} />
              )}
            </Box>
          </Box>
        )
      })}

      <CSRDetailDialog memberId={csrDetailId} onClose={() => setCsrDetailId(null)} />
    </Box>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  drivers_license: "Driver's License",
  registration:    'Registration',
  insurance_card:  'Insurance Card',
  other:           'Other',
}

function DocumentsTab({ documents, vehicles, customerId }: { documents: CustomerDocument[]; vehicles: Vehicle[]; customerId: number }) {
  const qc = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: (id: number) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer_detail', customerId] }),
  })

  if (!documents.length) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <FolderOpen size={28} style={{ opacity: 0.18, marginBottom: 8 }} />
        <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>No documents on file.</Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={1.5}>
      {documents.map(doc => {
        const fileUrl = doc.file?.url ?? null
        const isImage = doc.file?.type === 'image'
        const displayLabel = doc.label ?? CATEGORY_LABELS[doc.category ?? ''] ?? 'Document'
        const categoryLabel = CATEGORY_LABELS[doc.category ?? ''] ?? 'Other'
        const vehicleLabel = doc.entity_type === 'vehicle'
          ? (() => {
              const v = vehicles.find(v => v.id === doc.entity_id)
              return v ? [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle' : 'Vehicle'
            })()
          : null

        return (
          <Box key={doc.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            {isImage && fileUrl ? (
              <Box
                component="img"
                src={fileUrl}
                alt={displayLabel}
                sx={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 1, flexShrink: 0, border: '1px solid', borderColor: 'divider' }}
              />
            ) : (
              <Box sx={{ width: 72, height: 48, borderRadius: 1, flexShrink: 0, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                <FileText size={22} />
              </Box>
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{displayLabel}</Typography>
              <Typography variant="caption" color="text.secondary">
                {categoryLabel}{vehicleLabel ? ` · ${vehicleLabel}` : ''} · {doc.file?.name ? `${doc.file.name} · ` : ''}{formatDate(doc.created_at)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignItems: 'center' }}>
              {fileUrl && (
                <IconButton
                  size="small"
                  component="a"
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open document"
                  sx={{ color: 'text.secondary' }}
                >
                  <ExternalLink size={15} />
                </IconButton>
              )}
              <IconButton
                size="small"
                color="error"
                title="Delete document"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(doc.id)}
              >
                <X size={15} />
              </IconButton>
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { label: 'Details',        icon: <FileText   size={15} /> },
  { label: 'Vehicles',       icon: <Car        size={15} /> },
  { label: 'Repair Orders',  icon: <FileText   size={15} /> },
  { label: 'Transactions',   icon: <CreditCard size={15} /> },
  { label: 'Documents',      icon: <FolderOpen size={15} /> },
  { label: 'Customer History', icon: <History    size={15} /> },
]

interface Props {
  customer: Customer
  onClose: () => void
  onEdit: (c: Customer) => void
  onNewRO: (c: Customer) => void
}

export default function CustomerDetailDialog({ customer, onClose, onEdit, onNewRO }: Props) {
  const [tab, setTab] = useState(0)
  const [selectedROId, setSelectedROId] = useState<number | null>(null)
  const [csrDetailId, setCsrDetailId] = useState<number | null>(null)

  const { shop } = useAuth()

  // Fetch team members to resolve CSR name from assigned_csr_id (also used in history tab)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members', shop?.id],
    queryFn: () => teamApi.listMembers(shop?.id ? { shop_id: shop.id } : undefined),
    staleTime: 120_000,
    enabled: !!shop?.id,
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', shop?.id],
    queryFn: () => companiesApi.list(shop?.id),
    staleTime: 5 * 60_000,
    enabled: !!shop?.id,
  })

  const { data: detail, isLoading } = useQuery({
    queryKey: ['customer_detail', customer.id],
    queryFn: () => customersApi.get(customer.id),
    staleTime: 30_000,
  })

  const c = detail?.customer ?? customer
  const metadata = detail?.metadata
  const assignedCSRMember = c.assigned_csr_id != null
    ? teamMembers.find(m => m.id === c.assigned_csr_id) ?? null
    : null
  const assignedCSRName = assignedCSRMember
    ? (assignedCSRMember.name || `${assignedCSRMember.first_name ?? ''} ${assignedCSRMember.last_name ?? ''}`.trim())
    : null

  // Use metadata counts from API; fall back to denormalized field while loading
  const openRosCount       = metadata?.open_ros               ?? c.active_ro_count
  const waitingRosCount    = metadata?.waiting_for_payment_ros ?? 0
  const closedRosCount     = metadata?.closed_ros             ?? 0
  const totalVehiclesCount = metadata?.total_vehicles         ?? c.vehicle_count
  const shouldShowOpenRos  = openRosCount > 0

  // Open ROs come directly from the detail response — no separate query needed
  const openRos = detail?.open_ros ?? []
  const openRosLoading = isLoading
  const openRosError   = false

  const { data: paymentsData } = useQuery({
    queryKey: ['customer_payments_summary', customer.id],
    queryFn: () => repairOrdersApi.listAllPayments({ customer_id: customer.id, per_page: 200 }),
    staleTime: 30_000,
    enabled: tab === 0,
  })

  const allPayments = paymentsData?.data ?? []
  const totalPaid = allPayments.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const totalOutstanding = allPayments.filter(p => p.payment_status === 'not_paid').reduce((sum, p) => sum + p.amount, 0)

  return (
    <>
      <Dialog open fullWidth maxWidth="lg" onClose={onClose} PaperProps={{ 'data-tour-id': 'customer-detail-dialog', sx: { height: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 3, borderTop: '3px solid', borderTopColor: 'primary.main' } }}>

        {/* ── Header ── */}
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 52, height: 52, fontSize: '1.1rem', bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0 }}>
              {initials(c.first_name, c.last_name)}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography component="div" variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                {c.first_name} {c.last_name}
                {c.company?.name && <Typography component="span" sx={{ ml: 1.5, fontSize: '0.85rem', fontWeight: 400, color: 'text.secondary' }}>{c.company.name}</Typography>}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 0.75, alignItems: 'center' }}>
                {c.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Phone size={13} style={{ opacity: 0.5 }} />
                    <Typography sx={{ fontSize: '0.85rem' }}>{c.phone}</Typography>
                  </Box>
                )}
                {c.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Mail size={13} style={{ opacity: 0.5 }} />
                    <Typography sx={{ fontSize: '0.85rem' }}>{c.email}</Typography>
                  </Box>
                )}
                {openRosCount > 0 && (
                  <Chip label={`${openRosCount} open RO${openRosCount !== 1 ? 's' : ''}`} size="small" color="primary" />
                )}
                {waitingRosCount > 0 && (
                  <Chip label={`${waitingRosCount} waiting for payment`} size="small" color="warning" />
                )}
                {totalVehiclesCount > 0 && (
                  <Chip label={`${totalVehiclesCount} vehicle${totalVehiclesCount !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                )}
                {totalPaid > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DollarSign size={13} style={{ opacity: 0.5 }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'success.main' }}>
                      {formatCurrency(totalPaid)} paid
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Action buttons */}
            <Box data-tour-id="customer-detail-actions" sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <Button variant="outlined" size="small" startIcon={<Pencil size={14} />} onClick={() => onEdit(c)} sx={{ borderRadius: 2 }}>
                Edit
              </Button>
              <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={() => onNewRO(c)} sx={{ borderRadius: 2 }}>
                New RO
              </Button>
              <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
            </Box>
          </Box>

          {/* ── Tabs ── */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 38 }}
          >
            {TABS.map((t, i) => (
              <Tab
                key={t.label}
                label={t.label}
                icon={t.icon}
                iconPosition="start"
                value={i}
                sx={{ minHeight: 38, fontSize: '0.8rem', textTransform: 'none', fontWeight: 600, gap: 0.5, py: 0.5 }}
              />
            ))}
          </Tabs>
        </DialogTitle>

        {/* ── Tab Content ── */}
        <DialogContent sx={{ flex: 1, overflow: 'auto', pt: 2.5, px: 3, bgcolor: 'rgba(0,0,0,0.018)' }}>

          {/* Details */}
          <TabPanel value={tab} index={0}>
            <Stack spacing={2}>

              {/* ── Stats bar ── */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                {[
                  { label: 'Total Paid',     value: totalPaid > 0 ? formatCurrency(totalPaid) : '—',                hasValue: totalPaid > 0,         accent: '#22C55E' },
                  { label: 'Outstanding',    value: totalOutstanding > 0 ? formatCurrency(totalOutstanding) : '—',  hasValue: totalOutstanding > 0,  accent: '#EF4444' },
                  { label: 'Vehicles',       value: String(totalVehiclesCount), hasValue: totalVehiclesCount > 0 },
                  { label: 'Open ROs',       value: String(openRosCount),       hasValue: openRosCount > 0,        accent: '#6366F1' },
                  { label: 'Waiting for Pmt',value: String(waitingRosCount),    hasValue: waitingRosCount > 0,     accent: '#F59E0B' },
                  { label: 'Closed ROs',     value: String(closedRosCount),     hasValue: closedRosCount > 0,      accent: '#94A3B8' },
                ].map((s, i, arr) => (
                  <Box key={s.label} sx={{ flex: '1 1 16%', minWidth: 80, py: 1.25, px: 1.5, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Typography sx={{ fontSize: s.hasValue ? '1.15rem' : '0.95rem', fontWeight: s.hasValue ? 800 : 400, lineHeight: 1.2, color: s.hasValue ? (s.accent ?? 'text.primary') : 'text.disabled', letterSpacing: s.hasValue ? '-0.02em' : 0 }}>
                      {s.value}
                    </Typography>
                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mt: 0.25 }}>
                      {s.label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* ── Open Repair Orders ── */}
              {shouldShowOpenRos && (
                <SegBlock>
                  <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ClipboardList size={13} style={{ opacity: 0.5 }} />
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'text.secondary', flex: 1 }}>Open Repair Orders</Typography>
                    <Chip label={`${openRosCount} open`} size="small" sx={{ fontSize: '0.6rem', height: 16 }} />
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    {openRosLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}><CircularProgress size={14} /><Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading…</Typography></Box>
                    ) : openRosError ? (
                      <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: '0.82rem' }}>Unable to load repair orders.</Alert>
                    ) : openRos.length === 0 ? (
                      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', py: 0.5 }}>No open repair orders.</Typography>
                    ) : (
                      <Stack spacing={0.75}>
                        {openRos.map((ro) => {
                          const veh = ro.vehicle ?? ro.vehicles
                            ?? (ro.vehicle_id ? (detail?.vehicles ?? []).find(v => v.id === ro.vehicle_id) : null)
                          const vehicleLabel = veh ? [veh.year, veh.make, veh.model].filter(Boolean).join(' ') : null
                          return (
                            <Box
                              key={ro.id}
                              onClick={() => setSelectedROId(ro.id)}
                              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
                                  {ro.job_number ? `Job #${ro.job_number}` : `RO #${ro.ro_number}`}
                                </Typography>
                                {vehicleLabel && <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }} noWrap>{vehicleLabel}</Typography>}
                              </Box>
                              <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                                {ro.job_type && <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', textTransform: 'capitalize' }}>{ro.job_type.replace('_', ' ')}</Typography>}
                                <Chip label={JOB_STATUS_LABELS[ro.job_status ?? 'open']} color={JOB_STATUS_COLORS[ro.job_status ?? 'open']} size="small" sx={{ fontSize: '0.68rem', height: 20 }} />
                              </Stack>
                            </Box>
                          )
                        })}
                      </Stack>
                    )}
                  </Box>
                </SegBlock>
              )}

              {/* ── Personal + Contact ── */}
              <SegBlock>
                <SegRow>
                  <SegCell label="First Name"  value={c.first_name} />
                  <SegCell label="Last Name"   value={c.last_name}  border />
                  <SegCell label="Company"     value={c.company?.name}    border />
                  <SegCell label="Preferred Contact" value={c.preferred_contact} border />
                </SegRow>
                <SegRow border>
                  <SegCell label="Primary Phone"   value={c.phone} />
                  <SegCell label="Secondary Phone" value={c.phone_secondary} border />
                  <SegCell label="Email"           value={c.email} border />
                  <SegCell label="Assigned CSR" border>
                    {c.assigned_csr_id ? (
                      <Box onClick={() => setCsrDetailId(c.assigned_csr_id!)} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', borderRadius: 1.5, px: 1, py: 0.2, bgcolor: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', '&:hover': { bgcolor: 'rgba(99,102,241,0.13)', borderColor: 'rgba(99,102,241,0.4)' } }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'primary.main', lineHeight: 1.4 }}>{assignedCSRName ?? `CSR #${c.assigned_csr_id}`}</Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'primary.main', opacity: 0.6 }}>↗</Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'text.disabled' }}>—</Typography>
                    )}
                  </SegCell>
                </SegRow>
              </SegBlock>

              {/* ── Addresses ── */}
              <SegBlock>
                <SegLabel>Mailing Address</SegLabel>
                <SegRow>
                  <SegCell label="Street" value={c.address_line1} />
                  <SegCell label="City"   value={c.city}          border />
                  <SegCell label="State"  value={c.state}         border />
                  <SegCell label="ZIP"    value={c.zip}           border />
                </SegRow>
                {c.pickup_address_line1 && (
                  <>
                    <SegLabel>Pickup Address</SegLabel>
                    <SegRow>
                      <SegCell label="Street" value={c.pickup_address_line1} />
                      <SegCell label="City"   value={c.pickup_city}           border />
                      <SegCell label="State"  value={c.pickup_state}          border />
                      <SegCell label="ZIP"    value={c.pickup_zip}            border />
                    </SegRow>
                  </>
                )}
              </SegBlock>

              {/* ── Driver's License + Attribution ── */}
              {(() => {
                const licenseDocs = (detail?.documents ?? []).filter(d => d.category === 'drivers_license')
                return (
                  <>
                    <SegBlock>
                      <SegRow>
                        <SegCell label="Driver's License" value={c.drivers_license || licenseDocs.length > 0 ? c.drivers_license : undefined} />
                        <SegCell label="Referred By"           value={c.referred_by}            border />
                        <SegCell label="Referrer Name"         value={c.referrer_name}          border />
                        <SegCell label="Location Attribution"  value={c.location_attribution}   border />
                        <SegCell label="Customer Since"        value={formatDate(c.created_at)} border />
                      </SegRow>
                    </SegBlock>

                    {licenseDocs.length > 0 && (
                      <SegBlock>
                        <SegLabel>Driver's License Photos</SegLabel>
                        <Box sx={{ px: 2, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {licenseDocs.map((doc, i) => {
                            const url = doc.file?.url
                            if (!url) return null
                            return (
                              <Box key={doc.id ?? i} component="a" href={url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-block', borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                                <Box component="img" src={url} alt={`License ${i + 1}`} sx={{ display: 'block', maxWidth: 160, maxHeight: 100, objectFit: 'cover' }} />
                              </Box>
                            )
                          })}
                        </Box>
                      </SegBlock>
                    )}
                  </>
                )
              })()}

              {/* ── Notes ── */}
              {c.notes && (
                <Box sx={{ p: 2, bgcolor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 0.75 }}>Notes</Typography>
                  <Typography sx={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{c.notes}</Typography>
                </Box>
              )}

            </Stack>
          </TabPanel>

          {/* Vehicles */}
          <TabPanel value={tab} index={1}>
            <VehiclesTab customer={customer} onSelectRO={setSelectedROId} />
          </TabPanel>

          {/* Repair Orders */}
          <TabPanel value={tab} index={2}>
            <RepairOrdersTab customerId={customer.id} enabled={tab === 2} onSelectRO={setSelectedROId} />
          </TabPanel>

          {/* Transactions */}
          <TabPanel value={tab} index={3}>
            <TransactionsTab customerId={customer.id} customer={c} enabled={tab === 3} />
          </TabPanel>

          {/* Documents */}
          <TabPanel value={tab} index={4}>
            <DocumentsTab documents={detail?.documents ?? []} vehicles={(detail?.vehicles ?? []) as Vehicle[]} customerId={customer.id} />
          </TabPanel>

          {/* History */}
          <TabPanel value={tab} index={5}>
            <CustomerHistoryTab customerId={customer.id} customerName={`${customer.first_name} ${customer.last_name}`} enabled={tab === 5} teamMembers={teamMembers} companies={companies} onSelectRO={setSelectedROId} />
          </TabPanel>

        </DialogContent>
      </Dialog>

      {/* RO Detail Drawer — opens on top of this dialog */}
      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />

      {/* CSR Detail Dialog — opens when clicking the Assigned CSR field */}
      <CSRDetailDialog memberId={csrDetailId} onClose={() => setCsrDetailId(null)} />
    </>
  )
}

