import { useState, useEffect, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { repairOrdersApi } from '@/api/repairOrders'
import { lotApi } from '@/api/lot'
import { useAuth } from '@/hooks/useAuth'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/types/repairOrder'
import type { ROEvent, StaffMember, JobStatus, JobType, JobClass, DealerClaimType, Payment } from '@/types/repairOrder'
import type { Vehicle } from '@/types/vehicle'
import IntakePanel from './IntakePanel'
import InsurancePanel from './InsurancePanel'
import RentalPanel from './RentalPanel'
import VehiclePanel from './VehiclePanel'
import TransactionsPanel from './TransactionsPanel'
import EventsPanel from './EventsPanel'
import { formatDate, formatCurrency } from '@/lib/utils'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid2'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputAdornment from '@mui/material/InputAdornment'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import {
  X, ClipboardList, Shield, Car, MessageSquare,
  DollarSign, Clock, Edit, Trash2, ChevronRight, User, CalendarDays, ListChecks, MoreHorizontal, FileText, MapPin, History,
} from 'lucide-react'
import RecordHistory from '@/components/RecordHistory'
import TransactionDetailsModal from '@/components/TransactionDetailsModal'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { format as formatDateOnly, isValid as isValidDate } from 'date-fns'
import CSRDetailDialog from '@/components/CSRDetailDialog'
import { LotDetailsModal } from '@/components/LotDetailsModal'
import { LotPickerDialog } from '@/components/LotPickerDialog'
import type { Customer } from '@/types/customer'
const CustomerDetailDialog = lazy(() => import('@/views/customers-view/components/CustomerDetailDialog'))
const CustomerEditDialog   = lazy(() => import('@/views/customers-view/components/CustomerEditDialog'))
const VehicleDetailDialog  = lazy(() => import('@/views/customers-view/components/VehicleDetailDialog'))
const AddVehicleDialog     = lazy(() => import('@/views/customers-view/components/AddVehicleDialog'))

interface Props {
  roId: number | null
  onClose: () => void
  defaultTab?: number
  zIndex?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.3 }}>
        {label}
      </Typography>
      <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600, color: value != null ? 'text.primary' : 'text.disabled' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  )
}

// ─── Tab panel ────────────────────────────────────────────────────────────────

function TabPanel({ value, index, children }: { value: number; index: number; children: ReactNode }) {
  return value === index ? <Box sx={{ pt: 2.5 }}>{children}</Box> : null
}

// ─── Edit section heading (mirrors NewROWizard SectionHeading) ─────────────────

function EditSectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: 2,
        bgcolor: 'rgba(99,102,241,0.12)', color: 'primary.main',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </Box>
      <Typography component="span" sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
        {children}
      </Typography>
    </Box>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ZONE_OPTIONS = ['North', 'South', 'Sublet', 'External']

const JOB_TYPE_LABELS: Record<JobType, string> = {
  insurance:  'Insurance',
  self_pay:   'Self Pay',
  dealer:     'Dealer',
  redo:       'Redo',
  fleet:      'Fleet',
  police_tow: 'Police Tow',
}

const DEALER_CLAIM_TYPES: DealerClaimType[] = ['Lot', 'Transportation', 'Warranty', 'Parts', 'Used']

export default function RODetailDrawer({ roId, onClose, defaultTab = 0, zIndex }: Props) {
  const { shop } = useAuth()
  const [tab, setTab] = useState(defaultTab)
  const [jobStatusAnchor, setJobStatusAnchor] = useState<HTMLElement | null>(null)
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<HTMLElement | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [csrDetailId, setCsrDetailId] = useState<number | null>(null)
  const [lotPickerOpen, setLotPickerOpen] = useState(false)
  const [lotPickerForEditOpen, setLotPickerForEditOpen] = useState(false)
  const [editLotLabel, setEditLotLabel] = useState<string | undefined>()
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false)
  const [editCustomer, setEditCustomer]             = useState<Customer | null>(null)
  const [vehicleDetailOpen, setVehicleDetailOpen]   = useState(false)
  const [editVehicle, setEditVehicle]               = useState<Vehicle | null>(null)
  const [dueDateOpen, setDueDateOpen]               = useState(false)
  const [dueDateValue, setDueDateValue]             = useState<string>('')
  const [editForm, setEditForm] = useState<{
    notes: string
    zone: string
    csr_id: string
    estimator_id: string
    lot_location_id: string
    scheduled_out_date: string
    arrived_at: string
    job_number: string
    job_type: JobType | ''
    job_class: JobClass | ''
    insurance_claim_type: string
    dealer_ro_number: string
    is_total_loss: boolean
    is_maxed: boolean
    has_room_left_in_vehicle: boolean
    amount_left_in_vehicle: string
    rental_needed: boolean
  }>({
    notes: '', zone: '', csr_id: '', estimator_id: '', lot_location_id: '',
    scheduled_out_date: '', arrived_at: '', job_number: '', job_type: '',
    job_class: '', insurance_claim_type: '', dealer_ro_number: '',
    is_total_loss: false, is_maxed: false, has_room_left_in_vehicle: false,
    amount_left_in_vehicle: '', rental_needed: false,
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [jobStatusError, setJobStatusError] = useState<string | null>(null)
  const qc = useQueryClient()

  // Reset tab when a new RO is opened
  useEffect(() => {
    if (roId) setTab(defaultTab)
  }, [roId, defaultTab])

  const { data, isLoading } = useQuery({
    queryKey: ['repair_order_detail', roId],
    queryFn: () => repairOrdersApi.get(roId as number),
    enabled: !!roId,
  })

  const ro       = data?.ro
  const customer = data?.customer as { id?: number; first_name?: string; last_name?: string; phone?: string | null; email?: string | null } | null
  const csr      = (data?.csr ?? null) as StaffMember | null
  const vehicle  = (data?.vehicle ?? null) as Vehicle | null
  const events   = (data?.events ?? []) as ROEvent[]

  const customerName = customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : null
  const vehicleLabel = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : null

  const { data: activityEntries = [], isLoading: activityLoading } = useQuery({
    queryKey: ['repair_order_activity', roId],
    queryFn: () => repairOrdersApi.activity(roId as number),
    enabled: !!roId,
    staleTime: 60_000,
  })

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff_list', shop?.id],
    queryFn: () => repairOrdersApi.staffList(shop?.id),
    enabled: !!shop?.id,
    staleTime: 60_000,
  })

  const { data: lotLocations = [] } = useQuery({
    queryKey: ['lot_locations'],
    queryFn: () => repairOrdersApi.lotLocationsList(),
    staleTime: 60_000,
    enabled: !!roId,
  })

  const { data: lotLayouts = [] } = useQuery({
    queryKey: ['lot_layouts_active', shop?.id],
    queryFn: async () => {
      const all = await lotApi.listLayouts(shop!.id)
      return all.filter(l => l.is_active)
    },
    staleTime: 30_000,
    enabled: !!shop?.id,
  })

  function openEdit() {
    setEditForm({
      notes: ro?.notes ?? '',
      zone: ro?.zone ?? '',
      csr_id: ro?.csr_id ? String(ro.csr_id) : '',
      estimator_id: ro?.estimator_id ? String(ro.estimator_id) : '',
      lot_location_id: ro?.lot_location_id ? String(ro.lot_location_id) : '',
      scheduled_out_date: ro?.scheduled_out_date ? formatDateOnly(new Date(ro.scheduled_out_date), 'yyyy-MM-dd') : '',
      arrived_at: ro?.arrived_at ? formatDateOnly(new Date(ro.arrived_at), 'yyyy-MM-dd') : '',
      job_number: ro?.job_number ? String(ro.job_number) : '',
      job_type: (ro?.job_type as JobType) ?? '',
      job_class: (ro?.job_class as JobClass) ?? '',
      insurance_claim_type: ro?.insurance_claim_type ?? '',
      dealer_ro_number: ro?.dealer_ro_number ?? '',
      is_total_loss: ro?.is_total_loss ?? false,
      is_maxed: ro?.is_maxed ?? false,
      has_room_left_in_vehicle: ro?.has_room_left_in_vehicle ?? false,
      amount_left_in_vehicle: ro?.amount_left_in_vehicle ? String(ro.amount_left_in_vehicle / 100) : '',
      rental_needed: ro?.rental_needed ?? false,
    })
    setEditLotLabel(vehicleLocationLabel ?? undefined)
    setEditError(null)
    setEditOpen(true)
  }

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof repairOrdersApi.update>[1]) =>
      repairOrdersApi.update(roId as number, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
      qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
      qc.invalidateQueries({ queryKey: ['dashboard_repair_orders'] })
      qc.invalidateQueries({ queryKey: ['lot_canvas'] })
      qc.invalidateQueries({ queryKey: ['lot_locations'] })
      qc.invalidateQueries({ queryKey: ['lot_spot_detail'] })
      setEditOpen(false)
    },
    onError: (err: { message?: string }) => setEditError(err.message ?? 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: () => repairOrdersApi.delete(roId as number),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
      qc.invalidateQueries({ queryKey: ['dashboard_repair_orders'] })
      setDeleteConfirm(false)
      onClose()
    },
    onError: (err: { message?: string }) => setEditError(err.message ?? 'Failed to delete'),
  })

  async function handleSaveEdit() {
    const amountCents = editForm.amount_left_in_vehicle
      ? Math.round(parseFloat(editForm.amount_left_in_vehicle) * 100)
      : null
    const newSpotId = editForm.lot_location_id ? Number(editForm.lot_location_id) : null
    const clearingLot = newSpotId === null && (ro?.lot_location_id ?? null) !== null

    const payload: Parameters<typeof repairOrdersApi.update>[1] = {
      notes: editForm.notes || null,
      zone: editForm.zone || null,
      csr_id: editForm.csr_id ? Number(editForm.csr_id) : null,
      estimator_id: editForm.estimator_id ? Number(editForm.estimator_id) : null,
      lot_location_id: newSpotId,
      clear_lot_location: clearingLot || undefined,
      scheduled_out_date: editForm.scheduled_out_date || null,
      arrived_at: editForm.arrived_at || null,
      job_number: editForm.job_number ? Number(editForm.job_number) : null,
      job_type: editForm.job_type || null,
      job_class: editForm.job_class || null,
      insurance_claim_type: editForm.insurance_claim_type || null,
      dealer_ro_number: editForm.dealer_ro_number || null,
      is_total_loss: editForm.is_total_loss,
      is_maxed: editForm.is_maxed,
      has_room_left_in_vehicle: editForm.has_room_left_in_vehicle,
      amount_left_in_vehicle: editForm.has_room_left_in_vehicle ? amountCents : null,
      rental_needed: editForm.rental_needed,
    }

    try {
      await updateMut.mutateAsync(payload)
    } catch {
      // errors handled by updateMut.onError
    }
  }

  const { data: paymentsRaw = [] } = useQuery({
    queryKey: ['payments', roId],
    queryFn: () => repairOrdersApi.listPayments(roId as number),
    enabled: !!roId,
  })
  const payments: Payment[] = Array.isArray(paymentsRaw)
    ? paymentsRaw
    : ((paymentsRaw as { data?: Payment[]; items?: Payment[] }).data
        ?? (paymentsRaw as { data?: Payment[]; items?: Payment[] }).items
        ?? [])

  const hasUnpaidTransactions = payments.some(p => p.payment_status === 'not_paid')
  const assignedCsr = staffList.find(member => member.id === ro?.csr_id) ?? csr ?? null
  const assignedEstimator = staffList.find(member => member.id === ro?.estimator_id) ?? null
  const lotLocation = lotLocations.find(location => location.id === ro?.lot_location_id) ?? null

  const vehicleLocationLabel = (() => {
    if (!ro?.lot_location_id) return null
    for (const layout of lotLayouts) {
      for (const zone of layout.zones ?? []) {
        const spot = zone.spots?.find(s => s.id === ro.lot_location_id)
        if (spot) return [layout.label, zone.name, spot.name].filter(Boolean).join(' — ')
      }
    }
    // fallback to lotLocations data if layouts not loaded yet
    return lotLocation ? [lotLocation.zone, lotLocation.name].filter(Boolean).join(' — ') : null
  })()
  const totalPaid = payments.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const totalOutstanding = payments.filter(p => p.payment_status === 'not_paid').reduce((sum, p) => sum + p.amount, 0)
  const totalBilled = ro?.actual_total ?? ro?.estimated_total ?? null

  const jobStatusMut = useMutation({
    mutationFn: (job_status: JobStatus) =>
      repairOrdersApi.updateJobStatus({ id: roId as number, job_status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
      qc.invalidateQueries({ queryKey: ['repair_orders'] })
      qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
      setJobStatusAnchor(null)
      setJobStatusError(null)
    },
    onError: (err: { message?: string }) => {
      setJobStatusError(err.message ?? 'Failed to update job status')
      setJobStatusAnchor(null)
    },
  })

  const quickUpdateMut = useMutation({
    mutationFn: (payload: Parameters<typeof repairOrdersApi.update>[1]) =>
      repairOrdersApi.update(roId as number, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
      qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
      setDueDateOpen(false)
    },
  })



  return (
    <>
    <Dialog
      open={roId !== null}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      sx={zIndex != null ? { zIndex } : undefined}
      PaperProps={{
        sx: {
          borderRadius: 0,
          height: '100vh',
          maxHeight: '100vh',
          ml: 'auto',
          mr: 0,
        },
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
              Repair Order
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                {ro ? `Job #${ro.job_number ?? '—'}` : 'Loading…'}
              </Typography>
              {ro && (
                <>
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {jobStatusMut.isPending ? '…' : JOB_STATUS_LABELS[ro.job_status ?? 'open']}
                        <ChevronRight size={12} />
                      </Box>
                    }
                    color={JOB_STATUS_COLORS[ro.job_status ?? 'open']}
                    size="small"
                    onClick={e => setJobStatusAnchor(e.currentTarget)}
                    sx={{ fontWeight: 700, cursor: 'pointer', '&:hover': { filter: 'brightness(0.92)' } }}
                  />
                  <Menu
                    anchorEl={jobStatusAnchor}
                    open={Boolean(jobStatusAnchor)}
                    onClose={() => setJobStatusAnchor(null)}
                    PaperProps={{ sx: { borderRadius: 2, minWidth: 190 } }}
                  >
                    <MenuItem disabled sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: '1 !important' }}>
                      Job Status
                    </MenuItem>
                    {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map(s => {
                      const isClosedBlocked = s === 'closed' && hasUnpaidTransactions
                      return (
                        <Tooltip
                          key={s}
                          title={isClosedBlocked ? 'Cannot close while there are unpaid transactions' : ''}
                          placement="right"
                        >
                          <span>
                            <MenuItem
                              selected={s === (ro.job_status ?? 'open')}
                              onClick={() => !isClosedBlocked && jobStatusMut.mutate(s)}
                              disabled={isClosedBlocked}
                              sx={{ fontSize: '0.875rem', fontWeight: s === (ro.job_status ?? 'open') ? 700 : 400 }}
                            >
                              {JOB_STATUS_LABELS[s]}
                            </MenuItem>
                          </span>
                        </Tooltip>
                      )
                    })}
                  </Menu>
                </>
              )}
              {ro?.job_type && (
                <Chip
                  label={ro.job_type.replace('_', ' ')}
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                />
              )}
            </Box>
            {ro && (
              <Typography sx={{ fontSize: '0.82rem', color: 'text.disabled', mt: 0.4 }}>
                RO #{ro.ro_number}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, mt: 0.5 }}>
            {ro && (
              <>
                <Button
                  size="small"
                  onClick={e => setHeaderMenuAnchor(e.currentTarget)}
                  sx={{ minWidth: 36, borderRadius: 1.5, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  <MoreHorizontal size={16} />
                </Button>
                <Menu
                  anchorEl={headerMenuAnchor}
                  open={Boolean(headerMenuAnchor)}
                  onClose={() => setHeaderMenuAnchor(null)}
                  PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
                >
                  <MenuItem onClick={() => { setHeaderMenuAnchor(null); openEdit() }} sx={{ fontSize: '0.875rem', gap: 1 }}>
                    <Edit size={14} /> Edit
                  </MenuItem>
                  <MenuItem onClick={() => { setHeaderMenuAnchor(null); window.print() }} sx={{ fontSize: '0.875rem', gap: 1 }}>
                    <FileText size={14} /> Print
                  </MenuItem>
                  <MenuItem onClick={() => { setHeaderMenuAnchor(null); setDeleteConfirm(true) }} sx={{ fontSize: '0.875rem', gap: 1, color: 'error.main' }}>
                    <Trash2 size={14} /> Delete
                  </MenuItem>
                </Menu>
              </>
            )}
            <IconButton size="small" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <DialogContent sx={{ p: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {jobStatusError && (
          <Alert severity="error" sx={{ mx: 3, mt: 2 }} onClose={() => setJobStatusError(null)}>
            {jobStatusError}
          </Alert>
        )}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!isLoading && !ro && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">Could not load this repair order.</Typography>
          </Box>
        )}

        {ro && (
          <>
            {/* ── Customer / Vehicle summary ───────────────────────────────── */}
            <Box sx={{ mx: 3, mt: 2.5, mb: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden', bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex' }}>
                {/* Customer — clickable */}
                <Box
                  onClick={() => customer && setCustomerDetailOpen(true)}
                  sx={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                    cursor: customer ? 'pointer' : 'default',
                    transition: 'background-color 0.15s',
                    '&:hover': customer ? { bgcolor: 'action.hover' } : {},
                  }}
                >
                  <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} color="white" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                      Customer
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3 }} noWrap>
                      {customerName ?? '—'}
                    </Typography>
                    {customer?.phone && (
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1 }} noWrap>
                        {customer.phone}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Divider orientation="vertical" flexItem />
                {/* Vehicle — clickable */}
                {vehicle ? (
                  <Box
                    onClick={() => setVehicleDetailOpen(true)}
                    sx={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Car size={16} color="white" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                        Vehicle
                      </Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3 }} noWrap>
                        {vehicleLabel ?? '—'}
                      </Typography>
                      {(vehicle.color || vehicle.license_plate) && (
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1, textTransform: 'capitalize' }} noWrap>
                          {[vehicle.color, vehicle.license_plate].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Car size={16} style={{ opacity: 0.3 }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled', fontStyle: 'italic' }}>
                      No vehicle
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* ── Quick actions + flag chips ───────────────────────────────── */}
            <Box sx={{ px: 3, pt: 2, pb: 0, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* Flag chips — left */}
              {(ro.is_total_loss || ro.is_maxed || ro.rental_needed || ro.has_room_left_in_vehicle) && (
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ flex: 1 }}>
                  {ro.is_total_loss            && <Chip label="Total Loss"   size="small" color="error"   variant="outlined" sx={{ fontWeight: 700 }} />}
                  {ro.is_maxed                 && <Chip label="Maxed"        size="small" color="warning" variant="outlined" sx={{ fontWeight: 700 }} />}
                  {ro.rental_needed            && <Chip label="Rental"       size="small" color="info"    variant="outlined" sx={{ fontWeight: 700 }} />}
                  {ro.has_room_left_in_vehicle && (
                    <Chip
                      label={ro.amount_left_in_vehicle ? `Room: ${formatCurrency(ro.amount_left_in_vehicle)}` : 'Room Left'}
                      size="small" color="success" variant="outlined" sx={{ fontWeight: 700 }}
                    />
                  )}
                </Stack>
              )}
              <Box sx={{ flex: !(ro.is_total_loss || ro.is_maxed || ro.rental_needed || ro.has_room_left_in_vehicle) ? 1 : 'unset' }} />
              {/* Action buttons — right */}
              <Button
                size="small"
                startIcon={<ListChecks size={14} />}
                onClick={e => setJobStatusAnchor(e.currentTarget)}
                sx={{
                  borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
                  bgcolor: 'primary.main', color: 'primary.contrastText',
                  px: 1.5,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                Change Job Status
              </Button>
              <Button
                size="small"
                startIcon={<CalendarDays size={14} />}
                onClick={() => {
                  setDueDateValue(ro.scheduled_out_date ? formatDateOnly(new Date(ro.scheduled_out_date), 'yyyy-MM-dd') : '')
                  setDueDateOpen(true)
                }}
                sx={{
                  borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
                  bgcolor: 'secondary.main', color: 'secondary.contrastText',
                  px: 1.5,
                  '&:hover': { bgcolor: 'secondary.dark' },
                }}
              >
                Assign Due Out
              </Button>
              <Button
                size="small"
                startIcon={<Edit size={14} />}
                onClick={openEdit}
                sx={{
                  borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
                  border: '1px solid', borderColor: 'divider',
                  color: 'text.primary',
                  px: 1.5,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                Edit
              </Button>
            </Box>

            {/* ── Key details + voice + notes ─────────────────────────────── */}
            <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2.5,
                  bgcolor: 'background.paper',
                }}
              >
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <InfoItem label="Due Out" value={formatDate(ro.scheduled_out_date)} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <InfoItem label="Arrived" value={formatDate(ro.arrived_at)} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.3 }}>
                        Vehicle Location
                      </Typography>
                      {vehicleLocationLabel ? (
                        <Typography
                          noWrap
                          onClick={() => setLotPickerOpen(true)}
                          sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'primary.main', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3, '&:hover': { color: 'primary.dark' } }}
                        >
                          {vehicleLocationLabel}
                        </Typography>
                      ) : (
                        <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'text.disabled' }}>
                          —
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <InfoItem label="CSR" value={assignedCsr?.name ?? undefined} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <InfoItem label="Estimator" value={assignedEstimator?.name ?? undefined} />
                  </Grid>
                  {ro.insurance_claim_type && (
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <InfoItem label="Claim Type" value={ro.insurance_claim_type} />
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Voice note */}
              {ro.latest_voice_text && (
                <Box sx={{ mt: 2, p: 1.75, borderRadius: 2.5, bgcolor: 'action.hover', borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <MessageSquare size={14} style={{ opacity: 0.6 }} />
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      Voice note · {formatDate(ro.latest_voice_timestamp)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontStyle="italic">"{ro.latest_voice_text}"</Typography>
                </Box>
              )}

              {/* Notes */}
              {ro.notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.75 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ro.notes}</Typography>
                </Box>
              )}
            </Box>

            <Divider />

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <Box sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, fontSize: '0.85rem', fontWeight: 600, px: 2 } }}
              >
                <Tab icon={<DollarSign size={15} />}    iconPosition="start" label="Transactions" />
                <Tab icon={<Car size={15} />}           iconPosition="start" label="Vehicle" />
                <Tab icon={<ClipboardList size={15} />} iconPosition="start" label="Intake" />
                <Tab icon={<Shield size={15} />}        iconPosition="start" label="Insurance" />
                <Tab icon={<Car size={15} />}           iconPosition="start" label="Rental" />
                <Tab
                  icon={<Clock size={15} />}
                  iconPosition="start"
                  label="History"
                />
              </Tabs>
            </Box>

            <Box sx={{ px: 3, pb: 3, flex: 1, overflowY: 'auto' }}>
              <TabPanel value={tab} index={0}>
                {roId && <TransactionsPanel roId={roId} />}
              </TabPanel>
              <TabPanel value={tab} index={1}>
                {roId && <VehiclePanel roId={roId} customerId={ro.customer_id} vehicle={vehicle} onViewDetails={() => setVehicleDetailOpen(true)} />}
              </TabPanel>
              <TabPanel value={tab} index={2}>
                {roId && (
                  <IntakePanel
                    roId={roId}
                    jobType={ro.job_type}
                    dealerClaimType={ro.insurance_claim_type ?? null}
                    roSummary={{
                      jobNumber: ro.job_number,
                      roNumber: ro.ro_number,
                      customerName,
                      vehicleLabel,
                      jobType: ro.job_type,
                    }}
                  />
                )}
              </TabPanel>
              <TabPanel value={tab} index={3}>
                {roId && <InsurancePanel roId={roId} />}
              </TabPanel>
              <TabPanel value={tab} index={4}>
                {roId && <RentalPanel roId={roId} />}
              </TabPanel>
              <TabPanel value={tab} index={5}>
                {activityLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : activityEntries.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Clock size={28} style={{ opacity: 0.18, marginBottom: 8 }} />
                    <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>No history yet.</Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                      <Button
                        size="small"
                        startIcon={<History size={14} />}
                        onClick={() => setHistoryModalOpen(true)}
                        sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                      >
                        View Full History
                      </Button>
                    </Box>
                    <RecordHistory
                      entries={activityEntries}
                      ro={{ job_number: ro?.job_number, ro_number: ro?.ro_number }}
                      onPaymentClick={setSelectedPaymentId}
                    />
                  </>
                )}
              </TabPanel>
            </Box>
          </>
        )}
      </DialogContent>

      {/* ── Full History Modal ─────────────────────────────────────────── */}
      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        fullWidth
        maxWidth="md"
        sx={{ zIndex: theme => (zIndex ?? theme.zIndex.modal) + 2 }}
        PaperProps={{ sx: { maxHeight: '90vh', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
              Full History{ro?.job_number != null ? ` — Job #${ro.job_number}` : ''}
            </Typography>
            {ro?.ro_number && (
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{ro.ro_number}</Typography>
            )}
          </Box>
          <IconButton size="small" onClick={() => setHistoryModalOpen(false)}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {activityEntries.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Clock size={28} style={{ opacity: 0.18, marginBottom: 8 }} />
              <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>No history yet.</Typography>
            </Box>
          ) : (
            <RecordHistory
              entries={activityEntries}
              ro={{ job_number: ro?.job_number, ro_number: ro?.ro_number }}
              onPaymentClick={setSelectedPaymentId}
            />
          )}
        </DialogContent>
      </Dialog>

      <TransactionDetailsModal
        payment={payments.find(p => p.id === selectedPaymentId) ?? null}
        onClose={() => setSelectedPaymentId(null)}
      />

      {/* ── Edit RO Dialog ─────────────────────────────────────────────── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { maxHeight: '92vh', borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1.5, pt: 2.5, px: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box component="span" sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary' }}>
            Edit Repair Order
          </Box>
          <IconButton size="medium" onClick={() => setEditOpen(false)} sx={{ color: 'text.secondary' }}>
            <X size={22} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: 3 }}>
          {editError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.95rem' }}>{editError}</Alert>}

          {/* Customer / Vehicle summary */}
          <Box sx={{ display: 'flex', mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden', bgcolor: 'background.paper' }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} color="white" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                  Customer
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3 }} noWrap>
                  {customerName ?? '—'}
                </Typography>
                {customer?.phone && (
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1 }} noWrap>
                    {customer.phone}
                  </Typography>
                )}
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem />
            {vehicle ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={16} color="white" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                    Vehicle
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3 }} noWrap>
                    {vehicleLabel ?? '—'}
                  </Typography>
                  {(vehicle.color || vehicle.license_plate) && (
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1, textTransform: 'capitalize' }} noWrap>
                      {[vehicle.color, vehicle.license_plate].filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={16} style={{ opacity: 0.3 }} />
                </Box>
                <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled', fontStyle: 'italic' }}>
                  No vehicle
                </Typography>
              </Box>
            )}
          </Box>

          {/* Job # */}
          <TextField
            label="Job #"
            type="number"
            fullWidth
            inputProps={{ step: 'any', min: 1 }}
            sx={{ mb: 2.5, '& .MuiInputBase-input': { fontSize: '1rem' }, '& .MuiInputLabel-root': { fontSize: '1rem' } }}
            value={editForm.job_number}
            onChange={e => setEditForm(p => ({ ...p, job_number: e.target.value }))}
          />

          {/* Job Type */}
          <EditSectionHeading icon={<ClipboardList size={18} />}>What type of job is this?</EditSectionHeading>
          <ToggleButtonGroup
            exclusive
            value={editForm.job_type}
            onChange={(_, v) => v && setEditForm(p => ({ ...p, job_type: v as JobType, insurance_claim_type: '', dealer_ro_number: '' }))}
            fullWidth
            sx={{ mb: 2.5 }}
          >
            {(Object.entries(JOB_TYPE_LABELS) as [JobType, string][]).map(([value, label]) => (
              <ToggleButton key={value} value={value} sx={{ flex: 1, fontSize: '0.9rem', py: 1.25, fontWeight: 600 }}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* Insurance-specific fields */}
          {editForm.job_type === 'insurance' && (
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid size={12}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '1rem' }}>Insurance Claim Type</InputLabel>
                  <Select label="Insurance Claim Type" value={editForm.insurance_claim_type} sx={{ fontSize: '1rem' }}
                    onChange={e => setEditForm(p => ({ ...p, insurance_claim_type: e.target.value as string }))}>
                    <MenuItem value=""><em>Not set</em></MenuItem>
                    <MenuItem value="1st Party" sx={{ fontSize: '1rem' }}>1st Party</MenuItem>
                    <MenuItem value="3rd Party" sx={{ fontSize: '1rem' }}>3rd Party</MenuItem>
                    <MenuItem value="Both" sx={{ fontSize: '1rem' }}>Both (1st &amp; 3rd Party)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '1rem' }}>Estimator</InputLabel>
                  <Select label="Estimator" value={editForm.estimator_id} sx={{ fontSize: '1rem' }}
                    onChange={e => setEditForm(p => ({ ...p, estimator_id: e.target.value as string }))}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {staffList.filter(s => s.role_id === 6).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '1rem' }}>CSR</InputLabel>
                  <Select label="CSR" value={editForm.csr_id} sx={{ fontSize: '1rem' }}
                    onChange={e => setEditForm(p => ({ ...p, csr_id: e.target.value as string }))}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {staffList.filter(s => s.role_id === 5).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {/* Dealer-specific fields */}
          {editForm.job_type === 'dealer' && (
            <>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ fontSize: '1rem' }}>Dealer Claim Type</InputLabel>
                    <Select label="Dealer Claim Type" value={editForm.insurance_claim_type} sx={{ fontSize: '1rem' }}
                      onChange={e => setEditForm(p => ({ ...p, insurance_claim_type: e.target.value as string }))}>
                      <MenuItem value=""><em>Not set</em></MenuItem>
                      {DEALER_CLAIM_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '1rem' }}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Dealer RO Number" fullWidth
                    sx={{ '& .MuiInputBase-input': { fontSize: '1rem' }, '& .MuiInputLabel-root': { fontSize: '1rem' } }}
                    value={editForm.dealer_ro_number}
                    onChange={e => setEditForm(p => ({ ...p, dealer_ro_number: e.target.value }))} />
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ fontSize: '1rem' }}>Estimator</InputLabel>
                    <Select label="Estimator" value={editForm.estimator_id} sx={{ fontSize: '1rem' }}
                      onChange={e => setEditForm(p => ({ ...p, estimator_id: e.target.value as string }))}>
                      <MenuItem value=""><em>Unassigned</em></MenuItem>
                      {staffList.filter(s => s.role_id === 6).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ fontSize: '1rem' }}>CSR</InputLabel>
                    <Select label="CSR" value={editForm.csr_id} sx={{ fontSize: '1rem' }}
                      onChange={e => setEditForm(p => ({ ...p, csr_id: e.target.value as string }))}>
                      <MenuItem value=""><em>Unassigned</em></MenuItem>
                      {staffList.filter(s => s.role_id === 5).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </>
          )}

          {/* Self Pay / Fleet / Redo — estimator + CSR */}
          {(editForm.job_type === 'self_pay' || editForm.job_type === 'fleet' || editForm.job_type === 'redo') && (
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '1rem' }}>Estimator</InputLabel>
                  <Select label="Estimator" value={editForm.estimator_id} sx={{ fontSize: '1rem' }}
                    onChange={e => setEditForm(p => ({ ...p, estimator_id: e.target.value as string }))}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {staffList.filter(s => s.role_id === 6).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '1rem' }}>CSR</InputLabel>
                  <Select label="CSR" value={editForm.csr_id} sx={{ fontSize: '1rem' }}
                    onChange={e => setEditForm(p => ({ ...p, csr_id: e.target.value as string }))}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {staffList.filter(s => s.role_id === 5).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {/* No job type selected — still show CSR + Estimator */}
          {!editForm.job_type && (
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '1rem' }}>Estimator</InputLabel>
                  <Select label="Estimator" value={editForm.estimator_id} sx={{ fontSize: '1rem' }}
                    onChange={e => setEditForm(p => ({ ...p, estimator_id: e.target.value as string }))}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {staffList.filter(s => s.role_id === 6).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '1rem' }}>CSR</InputLabel>
                  <Select label="CSR" value={editForm.csr_id} sx={{ fontSize: '1rem' }}
                    onChange={e => setEditForm(p => ({ ...p, csr_id: e.target.value as string }))}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {staffList.filter(s => s.role_id === 5).map(s => <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {shop?.id && (
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
                Vehicle Location
              </Typography>
              {editForm.lot_location_id && editLotLabel ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={editLotLabel}
                    color="primary"
                    onDelete={() => { setEditForm(p => ({ ...p, lot_location_id: '' })); setEditLotLabel(undefined) }}
                  />
                  <Button size="small" onClick={() => setLotPickerForEditOpen(true)}>Change</Button>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<MapPin size={15} />}
                  onClick={() => setLotPickerForEditOpen(true)}
                  sx={{ fontSize: '0.85rem' }}
                >
                  Choose Location
                </Button>
              )}
            </Box>
          )}

          {/* Dates */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label="Arrived"
                value={editForm.arrived_at ? new Date(editForm.arrived_at + 'T12:00:00') : null}
                onChange={(value) => {
                  if (value && isValidDate(value)) setEditForm(p => ({ ...p, arrived_at: formatDateOnly(value, 'yyyy-MM-dd') }))
                  else setEditForm(p => ({ ...p, arrived_at: '' }))
                }}
                slotProps={{ textField: { fullWidth: true, sx: { '& .MuiInputBase-input': { fontSize: '1rem' }, '& .MuiInputLabel-root': { fontSize: '1rem' } } } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label="Due Out Date"
                value={editForm.scheduled_out_date ? new Date(editForm.scheduled_out_date + 'T12:00:00') : null}
                onChange={(value) => {
                  if (value && isValidDate(value)) setEditForm(p => ({ ...p, scheduled_out_date: formatDateOnly(value, 'yyyy-MM-dd') }))
                  else setEditForm(p => ({ ...p, scheduled_out_date: '' }))
                }}
                slotProps={{ textField: { fullWidth: true, sx: { '& .MuiInputBase-input': { fontSize: '1rem' }, '& .MuiInputLabel-root': { fontSize: '1rem' } } } }}
              />
            </Grid>
          </Grid>

          {/* Insurance flags */}
          {editForm.job_type === 'insurance' && (
            <Box sx={{ mb: 1 }}>
              <FormControlLabel
                control={<Checkbox checked={editForm.is_total_loss} onChange={e => setEditForm(p => ({ ...p, is_total_loss: e.target.checked }))} color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />}
                label={<Typography sx={{ fontSize: '1rem' }}>Total Loss</Typography>}
                sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
              />
              <FormControlLabel
                control={<Checkbox checked={editForm.is_maxed} onChange={e => setEditForm(p => ({ ...p, is_maxed: e.target.checked }))} color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />}
                label={<Typography sx={{ fontSize: '1rem' }}>Maxed</Typography>}
                sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
              />
              <FormControlLabel
                control={<Checkbox checked={editForm.has_room_left_in_vehicle}
                  onChange={e => { setEditForm(p => ({ ...p, has_room_left_in_vehicle: e.target.checked, amount_left_in_vehicle: e.target.checked ? p.amount_left_in_vehicle : '' })) }}
                  color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />}
                label={<Typography sx={{ fontSize: '1rem' }}>Room Left In Vehicle</Typography>}
                sx={{ display: 'flex', alignItems: 'center', mb: editForm.has_room_left_in_vehicle ? 1 : 0 }}
              />
              {editForm.has_room_left_in_vehicle && (
                <TextField
                  label="Amount Left in Vehicle ($)" type="number" fullWidth
                  sx={{ mt: 1, mb: 1, '& .MuiInputBase-input': { fontSize: '1rem' }, '& .MuiInputLabel-root': { fontSize: '1rem' } }}
                  inputProps={{ min: 0, step: '0.01' }}
                  value={editForm.amount_left_in_vehicle}
                  onChange={e => setEditForm(p => ({ ...p, amount_left_in_vehicle: e.target.value }))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                />
              )}
            </Box>
          )}

          {/* Rental */}
          <FormControlLabel
            control={<Checkbox checked={editForm.rental_needed} onChange={e => setEditForm(p => ({ ...p, rental_needed: e.target.checked }))} color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />}
            label={<Typography sx={{ fontSize: '1rem' }}>Customer needs a rental car</Typography>}
            sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 2 }}
          />

          {/* Notes */}
          <TextField
            label="Notes" fullWidth multiline minRows={3}
            sx={{ '& .MuiInputBase-input': { fontSize: '1rem' }, '& .MuiInputLabel-root': { fontSize: '1rem' } }}
            value={editForm.notes}
            onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" size="large" onClick={() => setEditOpen(false)} disabled={updateMut.isPending}
            sx={{ borderRadius: 3, minWidth: 100, fontSize: '0.95rem' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleSaveEdit}
            disabled={updateMut.isPending}
            startIcon={updateMut.isPending ? <CircularProgress size={18} color="inherit" /> : <Edit size={18} />}
            sx={{ borderRadius: 3, py: 1.5, fontSize: '1rem' }}
          >
            {updateMut.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete RO Confirm ──────────────────────────────────────────── */}
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography component="div" variant="subtitle2" fontWeight={700}>Delete Repair Order?</Typography>
          <IconButton size="small" onClick={() => setDeleteConfirm(false)}><X size={16} /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete <strong>Job #{ro?.job_number ?? ro?.ro_number}</strong> and all associated data. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="text" onClick={() => setDeleteConfirm(false)} disabled={deleteMut.isPending}>Cancel</Button>
          <Button
            variant="contained" color="error"
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
            startIcon={deleteMut.isPending ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={14} />}
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete RO'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── CSR Detail Dialog ──────────────────────────────────────────── */}
      <CSRDetailDialog memberId={csrDetailId} onClose={() => setCsrDetailId(null)} />

    </Dialog>

    {/* ── Assign Due Out Dialog ─────────────────────────────────────── */}
    <Dialog open={dueDateOpen} onClose={() => setDueDateOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1, pt: 2.5, px: 3, fontWeight: 800 }}>Assign Due Out</DialogTitle>
      <DialogContent sx={{ px: 3, pt: 1 }}>
        <DatePicker
          label="Due Out Date"
          value={dueDateValue ? new Date(dueDateValue + 'T12:00:00') : null}
          onChange={value => {
            if (value && isValidDate(value)) setDueDateValue(formatDateOnly(value, 'yyyy-MM-dd'))
            else setDueDateValue('')
          }}
          slotProps={{ textField: { fullWidth: true, sx: { mt: 1 } } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={() => setDueDateOpen(false)} disabled={quickUpdateMut.isPending}>Cancel</Button>
        <Button
          variant="contained"
          disabled={quickUpdateMut.isPending}
          onClick={() => quickUpdateMut.mutate({ scheduled_out_date: dueDateValue || null })}
        >
          {quickUpdateMut.isPending ? <CircularProgress size={16} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* ── Customer Detail Dialog ─────────────────────────────────────── */}
    {customerDetailOpen && customer && (
      <Suspense fallback={null}>
        <CustomerDetailDialog
          customer={data?.customer as Customer}
          onClose={() => setCustomerDetailOpen(false)}
          onEdit={c => { setCustomerDetailOpen(false); setEditCustomer(c) }}
          onNewRO={() => setCustomerDetailOpen(false)}
        />
      </Suspense>
    )}

    {/* ── Customer Edit Dialog ───────────────────────────────────────── */}
    {editCustomer && (
      <Suspense fallback={null}>
        <CustomerEditDialog
          customer={editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={() => {
            setEditCustomer(null)
            qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
          }}
        />
      </Suspense>
    )}

    {/* ── Vehicle Detail Dialog ──────────────────────────────────────── */}
    {vehicleDetailOpen && vehicle && (
      <Suspense fallback={null}>
        <VehicleDetailDialog
          vehicle={vehicle}
          onClose={() => setVehicleDetailOpen(false)}
          onEdit={() => { setEditVehicle(vehicle); setVehicleDetailOpen(false) }}
          onDelete={() => setVehicleDetailOpen(false)}
          onNewRO={() => setVehicleDetailOpen(false)}
        />
      </Suspense>
    )}

    {/* ── Edit Vehicle Dialog ────────────────────────────────────────── */}
    {editVehicle && (
      <Suspense fallback={null}>
        <AddVehicleDialog
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSaved={() => setEditVehicle(null)}
        />
      </Suspense>
    )}
    {shop?.id && (
      <LotPickerDialog
        open={lotPickerForEditOpen}
        onClose={() => setLotPickerForEditOpen(false)}
        shopId={shop.id}
        value={editForm.lot_location_id ? Number(editForm.lot_location_id) : undefined}
        onConfirm={(spotId, label) => {
          setEditForm(p => ({ ...p, lot_location_id: spotId ? String(spotId) : '' }))
          setEditLotLabel(label)
          setLotPickerForEditOpen(false)
        }}
      />
    )}

    {shop?.id && (
      <LotDetailsModal
        open={lotPickerOpen}
        onClose={() => setLotPickerOpen(false)}
        shopId={shop.id}
        initialSpotId={ro?.lot_location_id ?? undefined}
        roId={ro?.id ?? undefined}
        currentSpotId={ro?.lot_location_id ?? undefined}
        onSpotChanged={() => {
          qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
          qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
          qc.invalidateQueries({ queryKey: ['lot_locations'] })
        }}
      />
    )}
    </>
  )
}
