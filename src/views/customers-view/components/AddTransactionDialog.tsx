import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { repairOrdersApi } from '@/api/repairOrders'
import { useAuth } from '@/hooks/useAuth'
import type { Customer } from '@/types/customer'
import type { RepairOrderListItem, TransactionType, PaymentStatus } from '@/types/repairOrder'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/types/repairOrder'
import { TRANSACTION_TYPES, PAYMENT_STATUSES } from '@/lib/transactionConstants'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import { X, DollarSign, Search, ChevronRight, ArrowLeft, Phone, Mail } from 'lucide-react'

const fieldSx = { '& .MuiInputBase-input': { fontSize: '0.9rem' }, '& .MuiInputLabel-root': { fontSize: '0.9rem' } }

interface Props {
  /** Pre-selected customer. When omitted, an RO search list is shown first. */
  customer?: Customer
  /** Pre-selected RO. When provided with customer, skips the RO selector entirely. */
  preselectedRo?: RepairOrderListItem
  onClose: () => void
  onSaved: () => void
}

// ─── RO picker (used when no customer prop) ───────────────────────────────────

function ROPicker({
  onSelect,
}: {
  onSelect: (ro: RepairOrderListItem) => void
}) {
  const { shop } = useAuth()
  const [search, setSearch] = useState('')

  // Load all ROs once; filter client-side (backend list has no text search param)
  const { data, isLoading } = useQuery({
    queryKey: ['ros_tx_picker', shop?.id],
    queryFn: () => repairOrdersApi.list({ shop_id: shop?.id, per_page: 200 }),
    staleTime: 30_000,
  })

  const allRos = data?.data ?? []

  const filtered = search.trim()
    ? allRos.filter(ro => {
        const q = search.toLowerCase()
        const c = ro.customer ?? ro.customers
        const v = ro.vehicle  ?? ro.vehicles
        const customerName = c ? `${c.first_name} ${c.last_name}`.toLowerCase() : ''
        const vehicleStr   = v ? `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.toLowerCase() : ''
        const jobNum = ro.job_number != null ? `job #${ro.job_number}` : ''
        return (
          customerName.includes(q) ||
          vehicleStr.includes(q) ||
          ro.ro_number.toLowerCase().includes(q) ||
          jobNum.includes(q)
        )
      })
    : allRos

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Search by customer, job #, vehicle…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 1.5, ...fieldSx }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={15} style={{ opacity: 0.5 }} />
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ maxHeight: 320, overflowY: 'auto', mx: -0.5 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 3, textAlign: 'center' }}>
            {search ? 'No repair orders match your search.' : 'No repair orders found.'}
          </Typography>
        ) : (
          filtered.map(ro => {
            const customer    = ro.customer ?? ro.customers
            const vehicle     = ro.vehicle  ?? ro.vehicles
            const vehicleLabel = vehicle
              ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || null
              : null

            return (
              <Box
                key={ro.id}
                onClick={() => onSelect(ro)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 1.5, py: 1.25, mx: 0.5, borderRadius: 2, cursor: 'pointer',
                  border: '1px solid transparent',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
                  transition: 'all 0.12s',
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  {/* Job # — most prominent */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <Typography fontWeight={800} fontSize="0.95rem">
                      {ro.job_number != null ? `Job #${ro.job_number}` : ro.ro_number}
                    </Typography>
                    <Chip
                      label={JOB_STATUS_LABELS[ro.job_status ?? 'open']}
                      size="small"
                      color={JOB_STATUS_COLORS[ro.job_status ?? 'open']}
                      sx={{ fontSize: '0.68rem', height: 18 }}
                    />
                  </Box>
                  {/* Customer name — always shown, placeholder when unassigned */}
                  <Typography fontSize="0.82rem" color={customer ? 'text.secondary' : 'text.disabled'} noWrap>
                    {customer ? `${customer.first_name} ${customer.last_name}` : 'No customer assigned'}
                  </Typography>
                  {/* Vehicle — always shown, placeholder when unassigned */}
                  <Typography fontSize="0.75rem" color={vehicleLabel ? 'text.disabled' : 'text.disabled'} noWrap>
                    {vehicleLabel ?? 'No vehicle assigned'}
                  </Typography>
                </Box>
                <ChevronRight size={15} style={{ opacity: 0.35, flexShrink: 0, marginLeft: 8 }} />
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}

// ─── Transaction form fields ──────────────────────────────────────────────────

function TransactionFields({
  transactionType, setTransactionType,
  amountDollars,   setAmountDollars,
  paymentStatus,   setPaymentStatus,
  dateAdded,       setDateAdded,
}: {
  transactionType: TransactionType | ''
  setTransactionType: (v: TransactionType) => void
  amountDollars: string
  setAmountDollars: (v: string) => void
  paymentStatus: PaymentStatus | ''
  setPaymentStatus: (v: PaymentStatus) => void
  dateAdded: string
  setDateAdded: (v: string) => void
}) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth sx={fieldSx}>
          <InputLabel>Transaction Type *</InputLabel>
          <Select
            label="Transaction Type *"
            value={transactionType}
            onChange={e => setTransactionType(e.target.value as TransactionType)}
          >
            {TRANSACTION_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          label="Amount *"
          fullWidth
          type="number"
          sx={fieldSx}
          value={amountDollars}
          onChange={e => setAmountDollars(e.target.value)}
          inputProps={{ min: 0, step: '0.01' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <DollarSign size={15} style={{ opacity: 0.5 }} />
              </InputAdornment>
            ),
          }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth sx={fieldSx}>
          <InputLabel>Payment Status *</InputLabel>
          <Select
            label="Payment Status *"
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
            renderValue={(val) => {
              const s = PAYMENT_STATUSES.find(p => p.value === val)
              return s ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                  {s.label}
                </Box>
              ) : val
            }}
          >
            {PAYMENT_STATUSES.map(s => (
              <MenuItem key={s.value} value={s.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                  {s.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          label="Date Added *"
          fullWidth
          type="date"
          sx={fieldSx}
          value={dateAdded}
          onChange={e => setDateAdded(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
    </Grid>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export default function AddTransactionDialog({ customer: customerProp, preselectedRo, onClose, onSaved }: Props) {
  const qc = useQueryClient()

  // "no customer" mode — step 1: pick an RO, step 2: fill form
  const [selectedRo, setSelectedRo] = useState<RepairOrderListItem | null>(null)

  // "customer" mode — cascading vehicle → RO selects
  const [roId, setRoId] = useState<number | ''>(preselectedRo?.id ?? '')

  const [transactionType, setTransactionType] = useState<TransactionType | ''>('')
  const [amountDollars,   setAmountDollars]   = useState('')
  const [paymentStatus,   setPaymentStatus]   = useState<PaymentStatus | ''>('')
  const [dateAdded,       setDateAdded]       = useState(new Date().toISOString().slice(0, 10))
  const [apiError,        setApiError]        = useState<string | null>(null)

  const { data: rosData, isLoading: rosLoading } = useQuery({
    queryKey: ['customer_ros_tx', customerProp?.id],
    queryFn: () => repairOrdersApi.list({ customer_id: customerProp!.id, per_page: 100 }),
    enabled: !!customerProp,
    staleTime: 30_000,
  })
  const customerRos = (rosData?.data ?? []) as RepairOrderListItem[]

  const effectiveRoId = preselectedRo ? preselectedRo.id : customerProp ? (roId as number) : selectedRo?.id

  const mutation = useMutation({
    mutationFn: () => repairOrdersApi.createPayment({
      repair_order_id:  effectiveRoId!,
      amount:           Math.round(parseFloat(amountDollars) * 100),
      transaction_type: transactionType || undefined,
      payment_status:   paymentStatus   || undefined,
      date_added:       dateAdded       || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', effectiveRoId] })
      qc.invalidateQueries({ queryKey: ['transactions_all'] })
      qc.invalidateQueries({ queryKey: ['customer_ros'] })
      qc.invalidateQueries({ queryKey: ['repair_orders'] })
      onSaved()
    },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to record transaction'),
  })

  function handleSave() {
    setApiError(null)
    if (!effectiveRoId)   { setApiError('Please select a repair order.'); return }
    if (!transactionType) { setApiError('Please select a transaction type.'); return }
    if (!amountDollars || isNaN(parseFloat(amountDollars)) || parseFloat(amountDollars) <= 0) {
      setApiError('Please enter a valid amount.'); return
    }
    if (!paymentStatus)   { setApiError('Please select a payment status.'); return }
    mutation.mutate()
  }

  // Subtitle text in the dialog header
  const subtitle = preselectedRo
    ? (() => {
        const v = preselectedRo.vehicle ?? preselectedRo.vehicles
        const vehicleStr = v ? [v.year, v.make, v.model].filter(Boolean).join(' ') : null
        const label = preselectedRo.job_number != null ? `Job #${preselectedRo.job_number}` : `RO #${preselectedRo.ro_number}`
        return vehicleStr ? `${label} · ${vehicleStr}` : label
      })()
    : customerProp
    ? `${customerProp.first_name} ${customerProp.last_name}`
    : selectedRo
    ? (() => {
        const c = selectedRo.customers
        return c ? `${c.first_name} ${c.last_name}` : selectedRo.ro_number
      })()
    : 'Select a repair order to begin'

  // Are we in the RO-picker phase (no-customer mode, no RO selected yet)?
  const showROPicker = !customerProp && !preselectedRo && !selectedRo

  // Resolve customer info for the banner — shown whenever we have a known customer
  const customerDisplay = (() => {
    if (customerProp) {
      return {
        name:    `${customerProp.first_name} ${customerProp.last_name}`,
        initials: `${customerProp.first_name[0] ?? ''}${customerProp.last_name[0] ?? ''}`.toUpperCase(),
        phone:   customerProp.phone ?? null,
        email:   customerProp.email ?? null,
      }
    }
    const ro = preselectedRo ?? selectedRo
    const c = ro ? (ro.customer ?? ro.customers) : null
    if (c) {
      return {
        name:    `${c.first_name} ${c.last_name}`,
        initials: `${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`.toUpperCase(),
        phone:   c.phone ?? null,
        email:   null,
      }
    }
    return null
  })()

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose} PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {!customerProp && selectedRo && (
            <IconButton size="small" onClick={() => setSelectedRo(null)} sx={{ mr: -0.5 }}>
              <ArrowLeft size={17} />
            </IconButton>
          )}
          <Box sx={{ p: 0.875, bgcolor: 'success.main', borderRadius: 1.5, display: 'flex', color: '#fff' }}>
            <DollarSign size={17} />
          </Box>
          <Box>
            <Typography fontWeight={800} fontSize="1.05rem">Add Transaction</Typography>
            <Typography fontSize="0.82rem" color="text.secondary">{subtitle}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}

        {/* ── Customer banner ── shown whenever we know who the customer is */}
        {!showROPicker && customerDisplay && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 1.75, py: 1.25, mb: 2, borderRadius: 2,
            bgcolor: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.15)',
          }}>
            <Avatar sx={{ width: 36, height: 36, fontSize: '0.85rem', fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0 }}>
              {customerDisplay.initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                {customerDisplay.name}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.35 }}>
                {customerDisplay.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    <Phone size={12} style={{ opacity: 0.5 }} />
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{customerDisplay.phone}</Typography>
                  </Box>
                )}
                {customerDisplay.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    <Mail size={12} style={{ opacity: 0.5 }} />
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{customerDisplay.email}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* ── No-customer mode: RO picker ── */}
        {showROPicker && <ROPicker onSelect={setSelectedRo} />}

        {/* ── No-customer mode: selected RO summary + form ── */}
        {!customerProp && selectedRo && (
          <Box>
            {/* Selected RO pill */}
            <Box sx={{
              px: 1.5, py: 1, mb: 2.5, borderRadius: 2,
              bgcolor: 'action.selected', border: '1px solid', borderColor: 'divider',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Typography fontWeight={800} fontSize="0.95rem">
                  {selectedRo.job_number != null ? `Job #${selectedRo.job_number}` : selectedRo.ro_number}
                </Typography>
                <Chip
                  label={JOB_STATUS_LABELS[selectedRo.job_status ?? 'open']}
                  size="small"
                  color={JOB_STATUS_COLORS[selectedRo.job_status ?? 'open']}
                  sx={{ fontSize: '0.68rem', height: 18 }}
                />
              </Box>
              {(selectedRo.customer ?? selectedRo.customers) && (
                <Typography fontSize="0.82rem" color="text.secondary">
                  {(selectedRo.customer ?? selectedRo.customers)!.first_name}{' '}
                  {(selectedRo.customer ?? selectedRo.customers)!.last_name}
                </Typography>
              )}
              {(selectedRo.vehicle ?? selectedRo.vehicles) && (
                <Typography fontSize="0.75rem" color="text.disabled">
                  {[(selectedRo.vehicle ?? selectedRo.vehicles)!.year,
                    (selectedRo.vehicle ?? selectedRo.vehicles)!.make,
                    (selectedRo.vehicle ?? selectedRo.vehicles)!.model]
                    .filter(Boolean).join(' ')}
                </Typography>
              )}
            </Box>
            <TransactionFields
              transactionType={transactionType} setTransactionType={setTransactionType}
              amountDollars={amountDollars}     setAmountDollars={setAmountDollars}
              paymentStatus={paymentStatus}     setPaymentStatus={setPaymentStatus}
              dateAdded={dateAdded}             setDateAdded={setDateAdded}
            />
          </Box>
        )}

        {/* ── Pre-selected RO mode: skip selector, show RO pill + form ── */}
        {preselectedRo && (
          <Box>
            <Box sx={{ px: 1.5, py: 1, mb: 2.5, borderRadius: 2, bgcolor: 'action.selected', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Typography fontWeight={800} fontSize="0.95rem">
                  {preselectedRo.job_number != null ? `Job #${preselectedRo.job_number}` : preselectedRo.ro_number}
                </Typography>
                <Chip label={JOB_STATUS_LABELS[preselectedRo.job_status ?? 'open']} size="small" color={JOB_STATUS_COLORS[preselectedRo.job_status ?? 'open']} sx={{ fontSize: '0.68rem', height: 18 }} />
              </Box>
              {(preselectedRo.vehicle ?? preselectedRo.vehicles) && (
                <Typography fontSize="0.75rem" color="text.disabled">
                  {[(preselectedRo.vehicle ?? preselectedRo.vehicles)!.year,
                    (preselectedRo.vehicle ?? preselectedRo.vehicles)!.make,
                    (preselectedRo.vehicle ?? preselectedRo.vehicles)!.model].filter(Boolean).join(' ')}
                </Typography>
              )}
            </Box>
            <TransactionFields
              transactionType={transactionType} setTransactionType={setTransactionType}
              amountDollars={amountDollars}     setAmountDollars={setAmountDollars}
              paymentStatus={paymentStatus}     setPaymentStatus={setPaymentStatus}
              dateAdded={dateAdded}             setDateAdded={setDateAdded}
            />
          </Box>
        )}

        {/* ── Customer-prop mode: RO dropdown + form ── */}
        {!preselectedRo && customerProp && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth sx={fieldSx} disabled={rosLoading}>
                <InputLabel>Repair Order *</InputLabel>
                <Select
                  label="Repair Order *"
                  value={roId}
                  onChange={e => setRoId(e.target.value as number)}
                >
                  {rosLoading
                    ? <MenuItem disabled><CircularProgress size={16} /></MenuItem>
                    : customerRos.length === 0
                    ? <MenuItem disabled>No repair orders for this customer</MenuItem>
                    : customerRos.map(ro => {
                        const vehicle = ro.vehicle ?? ro.vehicles
                        const vehicleLabel = vehicle
                          ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
                          : null
                        return (
                          <MenuItem key={ro.id} value={ro.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, width: '100%' }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                  {`RO ${ro.ro_number}`}
                                </Typography>
                                {ro.job_number != null && (
                                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                    {`Job #${ro.job_number}`}
                                  </Typography>
                                )}
                                {vehicleLabel && (
                                  <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                                    {vehicleLabel}
                                  </Typography>
                                )}
                              </Box>
                              <Chip
                                label={JOB_STATUS_LABELS[ro.job_status ?? 'open']}
                                size="small"
                                color={JOB_STATUS_COLORS[ro.job_status ?? 'open']}
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            </Box>
                          </MenuItem>
                        )
                      })
                  }
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TransactionFields
                transactionType={transactionType} setTransactionType={setTransactionType}
                amountDollars={amountDollars}     setAmountDollars={setAmountDollars}
                paymentStatus={paymentStatus}     setPaymentStatus={setPaymentStatus}
                dateAdded={dateAdded}             setDateAdded={setDateAdded}
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>

      {/* Actions only shown when there's a form to submit */}
      {(!showROPicker || preselectedRo) && (
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSave}
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={15} color="inherit" /> : <DollarSign size={15} />}
            sx={{ borderRadius: 2, minWidth: 160 }}
          >
            {mutation.isPending ? 'Saving…' : 'Add Transaction'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
