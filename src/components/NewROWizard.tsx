import { useState, useEffect } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import { vehiclesApi, decodeVin } from '@/api/vehicles'
import type { DecodedVin } from '@/api/vehicles'
import { repairOrdersApi } from '@/api/repairOrders'
import { LotPickerDialog } from './LotPickerDialog'
import type { Customer } from '@/types/customer'
import CustomerEditDialog from '@/views/customers-view/components/CustomerEditDialog'
import type { Vehicle, CreateVehicleInput } from '@/types/vehicle'
import type { CreateROInput, JobType, JobClass, DealerClaimType } from '@/types/repairOrder'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import { X, Search, UserPlus, Car, Scan, CheckCircle, ChevronLeft, ChevronRight, ClipboardList, User, MapPin } from 'lucide-react'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { format as formatDateOnly, isValid as isValidDate } from 'date-fns'

interface WizardProps {
  open: boolean
  onClose: () => void
  onSuccess: (roNumber: string, roId: number) => void
  onViewRO?: (roId: number) => void
  preselectedCustomer?: Customer | null
  preselectedVehicle?: Vehicle | null
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

const sectionLabel = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'text.primary',
  display: 'block',
}

const inputSx = {
  '& .MuiInputBase-input': { fontSize: '1rem' },
  '& .MuiInputLabel-root': { fontSize: '1rem' },
}

// ─── Step 1: Customer ─────────────────────────────────────────────────────────

function CustomerStep({ onSelect, preselected }: {
  onSelect: (c: Customer) => void
  preselected?: Customer | null
}) {
  const { shop } = useAuth()
  const [search, setSearch] = useState('')
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search.trim(), 1000)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['customers_wizard', { shop_id: shop?.id, search: debouncedSearch }],
    queryFn: () => customersApi.list({ shop_id: shop?.id, search: debouncedSearch, per_page: 20 }),
    enabled: debouncedSearch.length > 0,
    staleTime: 15_000,
  })

  const customers = data?.data ?? []

  return (
    <Box>
      {/* Action bar */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><Search size={18} style={{ opacity: 0.5 }} /></InputAdornment>
            ),
          }}
          sx={inputSx}
        />
        <Button
          size="large"
          variant="outlined"
          startIcon={<UserPlus size={18} />}
          onClick={() => setAddCustomerOpen(true)}
          sx={{ borderRadius: 3, py: 1.25, fontSize: '0.95rem', whiteSpace: 'nowrap' }}
        >
          Add Customer
        </Button>
      </Box>

      <Box sx={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: '20px', scrollbarGutter: 'stable' }}>
        {(isLoading || isFetching || search.trim() !== debouncedSearch) && search.trim().length > 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : customers.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1rem', color: 'text.secondary' }}>
              {search ? 'No customers found.' : 'Start typing to search customers.'}
            </Typography>
            <Button size="large" sx={{ mt: 2, fontSize: '0.95rem' }} onClick={() => setAddCustomerOpen(true)}>
              Add a new customer instead →
            </Button>
          </Box>
        ) : customers.map((c) => (
          <Box
            key={c.id}
            onClick={() => onSelect(c)}
            sx={{
              borderRadius: 3,
              cursor: 'pointer',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              px: 2.5,
              py: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              transition: 'border-color 0.15s, background-color 0.15s',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, overflow: 'hidden' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.first_name} {c.last_name}
                </Typography>
                {c.company?.name && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
                    {c.company.name}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 180 }}>
              {c.active_ro_count > 0 && (
                <Chip
                  label={`${c.active_ro_count} active`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem', height: 22 }}
                />
              )}
              {(c.waiting_for_payment_count ?? 0) > 0 && (
                <Chip
                  label="Waiting for Payment"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem', height: 22 }}
                />
              )}
              <ChevronRight size={20} style={{ opacity: 0.55 }} />
            </Box>
          </Box>
        ))}
      </Box>

      {addCustomerOpen && (
        <CustomerEditDialog
          customer={null}
          onClose={() => setAddCustomerOpen(false)}
          onSaved={(c) => { setAddCustomerOpen(false); onSelect(c) }}
        />
      )}
    </Box>
  )
}

// ─── Step 2: Vehicle ──────────────────────────────────────────────────────────

function VehicleStep({ customer, onSelect, preselected, onBack }: {
  customer: Customer
  onSelect: (v: Vehicle | null) => void
  preselected?: Vehicle | null
  onBack: () => void
}) {
  useEffect(() => {
    if (preselected) onSelect(preselected)
  }, []) // eslint-disable-line
  const qc = useQueryClient()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [vin, setVin] = useState('')
  const [decoding, setDecoding] = useState(false)
  const [decoded, setDecoded] = useState<DecodedVin | null>(null)
  const [vinError, setVinError] = useState<string | null>(null)
  const [vForm, setVForm] = useState<Partial<CreateVehicleInput>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  const { data: vehiclesData, isLoading: vehiclesLoading, isError: vehiclesError } = useQuery({
    queryKey: ['vehicles', customer.id],
    queryFn: () => vehiclesApi.listByCustomer(customer.id),
    staleTime: 30_000,
    retry: false,
  })

  const vehicles = vehiclesData ?? []

  useEffect(() => {
    if (!vehiclesLoading && (vehiclesError || vehicles.length === 0)) setMode('new')
  }, [vehiclesLoading, vehiclesError, vehicles.length])

  const createMut = useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: (v) => { qc.invalidateQueries({ queryKey: ['vehicles', customer.id] }); onSelect(v) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to add vehicle'),
  })

  async function handleVinDecode() {
    if (vin.length < 10) { setVinError('Please enter at least 10 characters'); return }
    setDecoding(true)
    setVinError(null)
    setDecoded(null)
    const result = await decodeVin(vin)
    setDecoding(false)
    if (!result) {
      setVinError('Could not read that VIN — please check the number and try again, or fill in the details below.')
    } else {
      setDecoded(result)
      setVForm(prev => ({
        ...prev,
        vin: vin.toUpperCase(),
        year:  result.year  ?? prev.year,
        make:  result.make  ?? prev.make,
        model: result.model ?? prev.model,
        trim:  result.trim  ?? prev.trim,
      }))
    }
  }

  function vf<K extends keyof CreateVehicleInput>(key: K, val: CreateVehicleInput[K]) {
    setVForm(p => ({ ...p, [key]: val }))
  }

  return (
    <Box>
      <Button
        variant="text"
        size="small"
        startIcon={<ChevronLeft size={16} />}
        onClick={onBack}
        sx={{ mb: 2, px: 0, minWidth: 0, fontWeight: 600, color: 'text.secondary' }}
      >
        Back to customer
      </Button>
      {/* Customer reminder */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, px: 2, py: 1.5, bgcolor: 'action.hover', borderRadius: 3 }}>
        <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>Customer:</Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{customer.first_name} {customer.last_name}</Typography>
        {customer.phone && (
          <Typography sx={{ fontSize: '0.9rem', color: 'text.disabled' }}>· {customer.phone}</Typography>
        )}
      </Box>

      {/* Mode switcher */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        {vehicles.length > 0 && !vehiclesError && (
          <Button
            size="large"
            variant={mode === 'existing' ? 'contained' : 'outlined'}
            startIcon={<Car size={18} />}
            onClick={() => setMode('existing')}
            sx={{ borderRadius: 3, flex: 1, py: 1.25, fontSize: '0.95rem' }}
          >
            Existing Vehicle
          </Button>
        )}
        <Button
          size="large"
          variant={mode === 'new' ? 'contained' : 'outlined'}
          startIcon={<Scan size={18} />}
          onClick={() => setMode('new')}
          sx={{ borderRadius: 3, flex: 1, py: 1.25, fontSize: '0.95rem' }}
        >
          Add New Vehicle
        </Button>
      </Box>

      {mode === 'existing' && !vehiclesError ? (
        vehiclesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {vehicles.map((v) => (
              <Card key={v.id}
                sx={{
                  borderRadius: 3,
                  cursor: 'pointer',
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}>
                <CardActionArea onClick={() => onSelect(v)} sx={{ p: 0 }}>
                  <CardContent sx={{ py: '14px !important', px: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                          {v.year} {v.make} {v.model}{v.trim ? ` · ${v.trim}` : ''}
                        </Typography>
                        <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                          {[v.color, v.license_plate, v.vin].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      <ChevronRight size={22} style={{ opacity: 0.5 }} />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )
      ) : (
        <>
          {apiError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.95rem' }}>{apiError}</Alert>}

          {/* VIN Decoder */}
          <Box sx={{ mb: 3 }}>
            <SectionHeading icon={<Scan size={18} />}>Vehicle Identification Number (VIN)</SectionHeading>
            <TextField
              fullWidth
              label="Enter VIN — fills in make, model, year automatically"
              value={vin}
              onChange={(e) => { setVin(e.target.value.toUpperCase()); setDecoded(null); setVinError(null) }}
              autoFocus
              inputProps={{ maxLength: 17, style: { fontFamily: 'monospace', letterSpacing: '0.08em', fontSize: '1.05rem' } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="large"
                      variant="contained"
                      disabled={vin.length < 10 || decoding}
                      onClick={handleVinDecode}
                      sx={{ borderRadius: 2, minWidth: 90, fontSize: '0.9rem' }}
                    >
                      {decoding ? <CircularProgress size={16} color="inherit" /> : 'Decode'}
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
              {vinError ? (
                <Typography sx={{ fontSize: '0.9rem', color: 'error.main' }}>{vinError}</Typography>
              ) : (
                <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
                  {vin.length > 0
                    ? `${vin.length} of 17 characters entered`
                    : 'Enter the VIN then press Decode, or fill in the fields below manually'}
                </Typography>
              )}
            </Box>

            {decoded && (
              <Box sx={{ mt: 1.5, px: 2, py: 1.5, bgcolor: 'rgba(102,187,106,0.08)', borderRadius: 2.5, border: '1px solid rgba(102,187,106,0.3)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CheckCircle size={16} color="#66BB6A" />
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'success.main' }}>
                    VIN decoded — fields filled in below
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                  {[decoded.year, decoded.make, decoded.model, decoded.trim].filter(Boolean).join(' ')}
                </Typography>
                {decoded.engine && (
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled' }}>{decoded.engine}</Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Manual fields */}
          <SectionHeading icon={<Car size={18} />}>Vehicle Details</SectionHeading>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <TextField label="Year" fullWidth type="number" sx={inputSx}
                value={vForm.year ?? ''}
                onChange={(e) => vf('year', parseInt(e.target.value) || undefined)} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Make" fullWidth sx={inputSx}
                value={vForm.make ?? ''} onChange={(e) => vf('make', e.target.value)} />
            </Grid>
            <Grid item xs={5}>
              <TextField label="Model" fullWidth sx={inputSx}
                value={vForm.model ?? ''} onChange={(e) => vf('model', e.target.value)} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Trim" fullWidth sx={inputSx}
                value={vForm.trim ?? ''} onChange={(e) => vf('trim', e.target.value)} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Color" fullWidth sx={inputSx}
                value={vForm.color ?? ''} onChange={(e) => vf('color', e.target.value)} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="License Plate" fullWidth sx={inputSx}
                value={vForm.license_plate ?? ''} onChange={(e) => vf('license_plate', e.target.value)} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Mileage In" fullWidth type="number" sx={inputSx}
                value={vForm.mileage_in ?? ''}
                onChange={(e) => vf('mileage_in', parseInt(e.target.value) || undefined)} />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3, borderRadius: 3, py: 1.5, fontSize: '1rem' }}
            disabled={createMut.isPending || (!vForm.make && !vForm.model && !vin)}
            onClick={() => createMut.mutate({ ...vForm, vin: vin || undefined, customer_id: customer.id } as CreateVehicleInput)}
            startIcon={createMut.isPending ? <CircularProgress size={18} color="inherit" /> : <Car size={18} />}
          >
            Add Vehicle & Continue
          </Button>
        </>
      )}
    </Box>
  )
}

// ─── Step 3: RO Details ───────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<JobType, string> = {
  insurance:  'Insurance',
  self_pay:   'Self Pay',
  dealer:     'Dealer',
  redo:       'Redo',
  fleet:      'Fleet',
  police_tow: 'Police Tow',
}

const JOB_CLASS_LABELS: Record<JobClass, string> = {
  collision:  'Collision',
  mechanical: 'Mechanical',
  paint:      'Paint',
  custom:     'Custom',
}

const DEALER_CLAIM_TYPES: DealerClaimType[] = ['Lot', 'Transportation', 'Warranty', 'Parts', 'Used']

// Fields cleared when job type changes to avoid stale data being submitted
const JOB_TYPE_SPECIFIC_FIELDS: Partial<CreateROInput> = {
  insurance_claim_type: undefined,
  dealer_claim_type: undefined,
  dealer_ro_number: undefined,
  is_total_loss: undefined,
  is_maxed: undefined,
  has_room_left_in_vehicle: undefined,
  amount_left_in_vehicle: undefined,
}

function RODetailsStep({ customer, vehicle, onSuccess, onBack }: {
  customer: Customer; vehicle: Vehicle | null
  onSuccess: (roNumber: string, roId: number) => void; onBack: () => void
}) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<CreateROInput>({
    customer_id: customer.id,
    vehicle_id: vehicle?.id,
    shop_id: shop?.id,
    job_type: 'insurance',
    job_class: 'collision',
    priority: 'normal',
    rental_needed: false,
    arrived_at: today,
    csr_id: customer.assigned_csr_id ?? undefined,
  })
  const [apiError, setApiError] = useState<string | null>(null)
  const [lotPickerOpen, setLotPickerOpen] = useState(false)
  const [lotLabel, setLotLabel] = useState<string | undefined>()
  const [amountLeftDisplay, setAmountLeftDisplay] = useState<string>('')
  const [jobNumStatus, setJobNumStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [jobNumError, setJobNumError]   = useState<string | null>(null)
  const [jobNumTouched, setJobNumTouched] = useState(false)

  // Debounced duplicate-check for Job #
  useEffect(() => {
    if (!form.job_number) { setJobNumStatus('idle'); setJobNumError(null); return }
    setJobNumStatus('checking')
    const t = setTimeout(async () => {
      try {
        const res = await repairOrdersApi.checkJobNumber(form.job_number!)
        if (res.available) {
          setJobNumStatus('available')
          setJobNumError(null)
        } else {
          setJobNumStatus('taken')
          setJobNumError(`Job #${form.job_number} is already in use (RO ${res.existing_ro?.ro_number ?? ''})`)
        }
      } catch {
        setJobNumStatus('idle')
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [form.job_number])

  const showJobNumberRequired = jobNumTouched && !form.job_number
  const scheduledInDraft = form.arrived_at ? new Date(form.arrived_at) : null
  const scheduledInPickerValue = scheduledInDraft && isValidDate(scheduledInDraft) ? scheduledInDraft : null

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff_list', shop?.id],
    queryFn: () => repairOrdersApi.staffList(shop?.id),
    enabled: !!shop?.id,
    staleTime: 60_000,
  })

  const estimators = staffList.filter(s => s.role_id === 6)
  const csrs       = staffList.filter(s => s.role_id === 5)

  const mutation = useMutation({
    mutationFn: repairOrdersApi.create,
    onSuccess: (ro) => {
      qc.invalidateQueries({ queryKey: ['repair_orders'] })
      qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customers_table'] })
      qc.invalidateQueries({ queryKey: ['customer_ros', customer.id] })
      qc.invalidateQueries({ queryKey: ['customer_ros_tx', customer.id] })
      qc.invalidateQueries({ queryKey: ['customer_detail', customer.id] })
      if (vehicle) qc.invalidateQueries({ queryKey: ['vehicle_ros', vehicle.id] })
      if (shop?.id) {
        qc.invalidateQueries({ queryKey: ['lot_layouts_active', shop.id] })
        qc.invalidateQueries({ queryKey: ['lot_zones_spots'] })
        qc.invalidateQueries({ queryKey: ['lot_canvas', shop.id] })
        qc.invalidateQueries({ queryKey: ['lot_spot_detail'] })
        qc.invalidateQueries({ queryKey: ['lot_locations'] })
      }
      showToast(`Repair order ${ro.ro_number} created`)
      onSuccess(ro.ro_number, ro.id)
    },
    onError: (err: { message?: string }) => {
      const msg = err.message ?? 'Failed to create repair order'
      setApiError(msg)
      showToast(msg, 'error')
    },
  })

  function f<K extends keyof CreateROInput>(key: K, val: CreateROInput[K]) {
    setForm(p => ({ ...p, [key]: val }))
  }

  function handleJobTypeChange(type: JobType) {
    setForm(p => ({ ...p, ...JOB_TYPE_SPECIFIC_FIELDS, job_type: type }))
  }

  return (
    <Box>
      {/* Customer / Vehicle summary — grouped card */}
      <Box sx={{
        display: 'flex', mb: 3,
        border: '1px solid', borderColor: 'divider',
        borderRadius: 2.5, overflow: 'hidden',
        bgcolor: 'background.paper',
      }}>
        {/* Customer */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: 1.5, flexShrink: 0,
            bgcolor: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={16} color="white" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
              Customer
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3 }} noWrap>
              {customer.first_name} {customer.last_name}
            </Typography>
            {customer.phone && (
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1 }} noWrap>
                {customer.phone}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Vehicle */}
        {vehicle ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
            <Box sx={{
              width: 34, height: 34, borderRadius: 1.5, flexShrink: 0,
              bgcolor: '#0EA5E9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Car size={16} color="white" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                Vehicle
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3 }} noWrap>
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
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
            <Box sx={{
              width: 34, height: 34, borderRadius: 1.5, flexShrink: 0,
              bgcolor: 'action.hover',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Car size={16} style={{ opacity: 0.3 }} />
            </Box>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled', fontStyle: 'italic' }}>
              No vehicle selected
            </Typography>
          </Box>
        )}
      </Box>

      {apiError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.95rem' }}>{apiError}</Alert>}

      {/* Job # — required + duplicate check */}
      <TextField
        label="Job #"
        type="number"
        fullWidth
        required
        error={showJobNumberRequired || jobNumStatus === 'taken'}
        helperText={
          jobNumStatus === 'checking' ? 'Checking...' :
          jobNumStatus === 'taken'    ? jobNumError :
          jobNumStatus === 'available'? 'Available' :
          (showJobNumberRequired ? 'Required' : '')
        }
        FormHelperTextProps={{
          sx: {
            color: jobNumStatus === 'available' ? 'success.main' :
                   jobNumStatus === 'taken' || showJobNumberRequired ? 'error.main' :
                   undefined,
          },
        }}
        inputProps={{ step: 'any', min: 1 }}
        InputLabelProps={{
          shrink: true,
          sx: { fontSize: '1rem', fontWeight: 600, mb: 0.25 },
        }}
        sx={{ mb: 3, ...inputSx, '& .MuiInputBase-root': { mt: 0.5 } }}
        value={form.job_number ?? ''}
        onChange={(e) => {
          if (!jobNumTouched) setJobNumTouched(true)
          f('job_number', e.target.value ? parseFloat(e.target.value) : undefined)
        }}
        onBlur={() => setJobNumTouched(true)}
      />

      {/* Job Type */}
      <SectionHeading icon={<ClipboardList size={18} />}>What type of job is this?</SectionHeading>
      <ToggleButtonGroup
        exclusive
        value={form.job_type}
        onChange={(_, v) => v && handleJobTypeChange(v)}
        fullWidth
        sx={{ mb: 3 }}
      >
        {(Object.entries(JOB_TYPE_LABELS) as [JobType, string][]).map(([value, label]) => (
          <ToggleButton
            key={value}
            value={value}
            sx={{ flex: 1, fontSize: '0.9rem', py: 1.25, fontWeight: 600 }}
          >
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* ── Insurance ─────────────────────────────────────────────────────── */}
      {form.job_type === 'insurance' && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontSize: '1rem' }}>Insurance Claim Type</InputLabel>
              <Select
                label="Insurance Claim Type"
                value={form.insurance_claim_type ?? ''}
                onChange={(e) => f('insurance_claim_type', e.target.value as '1st Party' | '3rd Party' | 'Both' || undefined)}
                sx={{ fontSize: '1rem' }}
              >
                <MenuItem value=""><em>Not set</em></MenuItem>
                <MenuItem value="1st Party">1st Party</MenuItem>
                <MenuItem value="3rd Party">3rd Party</MenuItem>
                <MenuItem value="Both">Both (1st &amp; 3rd Party)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontSize: '1rem' }}>Estimator</InputLabel>
              <Select label="Estimator" value={form.estimator_id ?? ''}
                onChange={(e) => f('estimator_id', e.target.value as number || undefined)}
                sx={{ fontSize: '1rem' }}>
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {estimators.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontSize: '1rem' }}>CSR</InputLabel>
              <Select label="CSR" value={form.csr_id ?? ''}
                onChange={(e) => f('csr_id', e.target.value as number || undefined)}
                sx={{ fontSize: '1rem' }}>
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {csrs.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      )}

      {/* ── Dealer ────────────────────────────────────────────────────────── */}
      {form.job_type === 'dealer' && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ fontSize: '1rem' }}>Dealer Claim Type</InputLabel>
                <Select label="Dealer Claim Type" value={form.dealer_claim_type ?? ''}
                  onChange={(e) => f('dealer_claim_type', e.target.value as DealerClaimType || undefined)}
                  sx={{ fontSize: '1rem' }}>
                  <MenuItem value=""><em>Not set</em></MenuItem>
                  {DEALER_CLAIM_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Dealer RO Number" fullWidth sx={inputSx}
                value={form.dealer_ro_number ?? ''}
                onChange={(e) => f('dealer_ro_number', e.target.value)} />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ fontSize: '1rem' }}>Estimator</InputLabel>
                <Select label="Estimator" value={form.estimator_id ?? ''}
                  onChange={(e) => f('estimator_id', e.target.value as number || undefined)}
                  sx={{ fontSize: '1rem' }}>
                  <MenuItem value=""><em>Unassigned</em></MenuItem>
                  {estimators.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ fontSize: '1rem' }}>CSR</InputLabel>
                <Select label="CSR" value={form.csr_id ?? ''}
                  onChange={(e) => f('csr_id', e.target.value as number || undefined)}
                  sx={{ fontSize: '1rem' }}>
                  <MenuItem value=""><em>Unassigned</em></MenuItem>
                  {csrs.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </>
      )}

      {/* ── Self Pay / Fleet — estimator + CSR ───────────────────────────── */}
      {(form.job_type === 'self_pay' || form.job_type === 'fleet') && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontSize: '1rem' }}>Estimator</InputLabel>
              <Select label="Estimator" value={form.estimator_id ?? ''}
                onChange={(e) => f('estimator_id', e.target.value as number || undefined)}
                sx={{ fontSize: '1rem' }}>
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {estimators.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontSize: '1rem' }}>CSR</InputLabel>
              <Select label="CSR" value={form.csr_id ?? ''}
                onChange={(e) => f('csr_id', e.target.value as number || undefined)}
                sx={{ fontSize: '1rem' }}>
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {csrs.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '1rem' }}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      )}
      {/* Redo — no extra dropdowns: previous estimate already exists */}

      {/* ── Parking Spot — all types ──────────────────────────────────────── */}
      {shop?.id && (
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
            Vehicle Location
          </Typography>
          {form.lot_location_id && lotLabel ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={lotLabel}
                color="primary"
                onDelete={() => { f('lot_location_id', undefined); setLotLabel(undefined) }}
              />
              <Button size="small" onClick={() => setLotPickerOpen(true)}>Change</Button>
            </Box>
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<MapPin size={15} />}
              onClick={() => setLotPickerOpen(true)}
              sx={{ fontSize: '0.85rem' }}
            >
              Choose Location
            </Button>
          )}
          <LotPickerDialog
            open={lotPickerOpen}
            onClose={() => setLotPickerOpen(false)}
            shopId={shop.id}
            value={form.lot_location_id}
            onConfirm={(spotId, label) => {
              f('lot_location_id', spotId)
              setLotLabel(label)
            }}
          />
        </Box>
      )}

      {/* Arrived - all job types */}
      <DatePicker
        label="Arrived"
        value={scheduledInPickerValue}
        onChange={(value) => {
          if (value && isValidDate(value)) {
            f('arrived_at', formatDateOnly(value, 'yyyy-MM-dd'))
          } else {
            f('arrived_at', undefined)
          }
        }}
        slotProps={{
          textField: {
            fullWidth: true,
            sx: { mb: 2.5, ...inputSx },
          },
        }}
      />

      {/* ── Insurance-only checkboxes ─────────────────────────────────────── */}
      {form.job_type === 'insurance' && (
        <Box sx={{ mb: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={form.is_total_loss ?? false} onChange={(e) => f('is_total_loss', e.target.checked)} color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />}
            label={<Typography sx={{ fontSize: '1rem' }}>Total Loss</Typography>}
            sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
          />
          <FormControlLabel
            control={<Checkbox checked={form.is_maxed ?? false} onChange={(e) => f('is_maxed', e.target.checked)} color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />}
            label={<Typography sx={{ fontSize: '1rem' }}>Maxed</Typography>}
            sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
          />
          <FormControlLabel
            control={<Checkbox checked={form.has_room_left_in_vehicle ?? false}
              onChange={(e) => { f('has_room_left_in_vehicle', e.target.checked); if (!e.target.checked) { f('amount_left_in_vehicle', undefined); setAmountLeftDisplay('') } }}
              color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />}
            label={<Typography sx={{ fontSize: '1rem' }}>Room Left In Vehicle</Typography>}
            sx={{ display: 'flex', alignItems: 'center', mb: form.has_room_left_in_vehicle ? 1 : 0 }}
          />
          {form.has_room_left_in_vehicle && (
            <TextField
              label="Amount Left in Vehicle ($)"
              type="number"
              fullWidth
              sx={{ mt: 1, mb: 1, ...inputSx }}
              inputProps={{ min: 0, step: '0.01' }}
              value={amountLeftDisplay}
              onChange={(e) => setAmountLeftDisplay(e.target.value)}
              onBlur={(e) => {
                const val = parseFloat(e.target.value)
                if (isNaN(val)) {
                  f('amount_left_in_vehicle', undefined)
                  setAmountLeftDisplay('')
                } else {
                  f('amount_left_in_vehicle', Math.round(val * 100))
                  setAmountLeftDisplay(val.toFixed(2))
                }
              }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          )}
        </Box>
      )}

      {/* ── Rental Needed — all types ─────────────────────────────────────── */}
      <FormControlLabel
        control={
          <Checkbox checked={form.rental_needed ?? false}
            onChange={(e) => f('rental_needed', e.target.checked)}
            color="primary" sx={{ transform: 'scale(1.3)', mr: 0.5 }} />
        }
        label={<Typography sx={{ fontSize: '1rem' }}>Customer needs a rental car</Typography>}
        sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 2 }}
      />

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
        <Button variant="outlined" size="large" onClick={onBack}
          startIcon={<ChevronLeft size={18} />}
          sx={{ px: 3, fontSize: '0.95rem', borderRadius: 3 }}>
          Back
        </Button>
        <Button variant="contained" size="large" fullWidth
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !form.job_number || jobNumStatus === 'taken' || jobNumStatus === 'checking'}
          startIcon={mutation.isPending ? <CircularProgress size={18} color="inherit" /> : <CheckCircle size={18} />}
          sx={{ borderRadius: 3, py: 1.5, fontSize: '1rem' }}>
          Create Repair Order
        </Button>
      </Box>
    </Box>
  )
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessScreen({ roNumber, onClose, onViewRO }: {
  roNumber: string
  onClose: () => void
  onViewRO?: () => void
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 5 }}>
      <Box sx={{
        width: 80, height: 80, borderRadius: '50%',
        bgcolor: 'rgba(102,187,106,0.15)', border: '2px solid rgba(102,187,106,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        mx: 'auto', mb: 2.5,
      }}>
        <CheckCircle size={44} color="#66BB6A" />
      </Box>
      <Typography variant="h5" fontWeight={900} mb={1}>
        Repair Order Created!
      </Typography>
      <Typography sx={{ fontSize: '1rem', color: 'text.secondary', mb: 1 }}>
        Your new repair order is ready to go.
      </Typography>
      <Box sx={{
        display: 'inline-block', px: 3.5, py: 1.5, mt: 1.5, mb: 4,
        bgcolor: 'rgba(251,191,36,0.12)', borderRadius: 3, border: '1px solid rgba(251,191,36,0.3)',
      }}>
        <Typography variant="h4" fontWeight={900} sx={{ color: 'primary.main', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          {roNumber}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
        <Button
          variant="outlined"
          size="large"
          onClick={onClose}
          sx={{ borderRadius: 3, minWidth: 120, py: 1.5, fontSize: '1rem' }}
        >
          Done
        </Button>
        {onViewRO && (
          <Button
            variant="contained"
            size="large"
            onClick={onViewRO}
            startIcon={<ChevronRight size={18} />}
            sx={{ borderRadius: 3, minWidth: 160, py: 1.5, fontSize: '1rem' }}
          >
            View RO
          </Button>
        )}
      </Box>
    </Box>
  )
}

// ─── Wizard Shell ─────────────────────────────────────────────────────────────

const STEP_LABELS = ['Customer', 'Vehicle', 'RO Details']

export default function NewROWizard({ open, onClose, onSuccess, onViewRO, preselectedCustomer, preselectedVehicle }: WizardProps) {
  const initialStep = preselectedCustomer && preselectedVehicle ? 2 : preselectedCustomer ? 1 : 0
  const [activeStep, setActiveStep] = useState<0 | 1 | 2>(initialStep as 0 | 1 | 2)
  const [customer, setCustomer] = useState<Customer | null>(preselectedCustomer ?? null)
  const [vehicle, setVehicle] = useState<Vehicle | null>(preselectedVehicle ?? null)
  const [createdRONumber, setCreatedRONumber] = useState<string | null>(null)
  const [createdROId, setCreatedROId] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      const step = preselectedCustomer && preselectedVehicle ? 2 : preselectedCustomer ? 1 : 0
      setActiveStep(step as 0 | 1 | 2)
      setCustomer(preselectedCustomer ?? null)
      setVehicle(preselectedVehicle ?? null)
      setCreatedRONumber(null)
      setCreatedROId(null)
    }
  }, [open]) // eslint-disable-line

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { maxHeight: '92vh', borderRadius: 3 } }}
    >
      <DialogTitle
        sx={{ pb: 1.5, pt: 2.5, px: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Box component="span" sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary' }}>
          {createdRONumber ? 'Repair Order Created' : 'New Repair Order'}
        </Box>
        <IconButton size="medium" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <X size={22} />
        </IconButton>
      </DialogTitle>

      {!createdRONumber && (
        <Box sx={{ px: 3, pb: 1.5 }}>
          <Stepper
            activeStep={activeStep}
            sx={{
              '& .MuiStepLabel-label': { fontSize: '0.9rem', fontWeight: 600 },
              '& .MuiStepIcon-root': { fontSize: '1.5rem' },
              '& .MuiStepConnector-line': { borderColor: 'divider' },
            }}
          >
            {STEP_LABELS.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>
        </Box>
      )}

      <DialogContent sx={{ pt: 2, px: 3 }}>
        {createdRONumber ? (
          <SuccessScreen
            roNumber={createdRONumber}
            onClose={onClose}
            onViewRO={onViewRO && createdROId != null ? () => { onClose(); onViewRO(createdROId) } : undefined}
          />
        ) : activeStep === 0 ? (
          <CustomerStep
            onSelect={(c) => { setCustomer(c); setActiveStep(1) }}
            preselected={preselectedCustomer}
          />
        ) : activeStep === 1 && customer ? (
          <VehicleStep
            customer={customer}
            onSelect={(v) => { setVehicle(v); setActiveStep(2) }}
            preselected={preselectedVehicle}
            onBack={() => { setActiveStep(0); setVehicle(null) }}
          />
        ) : activeStep === 2 && customer ? (
          <RODetailsStep
            customer={customer}
            vehicle={vehicle}
            onSuccess={(rn, rid) => { setCreatedRONumber(rn); setCreatedROId(rid); onSuccess(rn, rid) }}
            onBack={() => setActiveStep(1)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{
        width: 34,
        height: 34,
        borderRadius: 2,
        bgcolor: 'rgba(99,102,241,0.12)',
        color: 'primary.main',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      >
        {icon}
      </Box>
      <Typography component="span" sx={sectionLabel}>{children}</Typography>
    </Box>
  )
}
