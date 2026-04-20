import { useState, useEffect } from 'react'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import { companiesApi } from '@/api/companies'
import { teamApi } from '@/api/team'
import { useAuth } from '@/hooks/useAuth'
import type { Company } from '@/types/company'
import type { Customer, CustomerListResponse, CreateCustomerInput, UpdateCustomerInput, ReferredByType } from '@/types/customer'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { X, Phone, Mail, MessageSquare, Plus } from 'lucide-react'
import AddCompanyDialog from '@/components/AddCompanyDialog'
import LicenseUploadField from '@/components/LicenseUploadField'
import { formatUSPhone, normalizeUSPhone, normalizeEmail, isValidEmail } from '@/lib/validation'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const REFERRED_BY_OPTIONS: { value: ReferredByType; label: string }[] = [
  { value: 'customer',     label: 'Customer Referral' },
  { value: 'employee',     label: 'Employee Referral' },
  { value: 'internet',     label: 'Internet / Search' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'walk_in',      label: 'Walk-in' },
  { value: 'other',        label: 'Other' },
]

type FormState = {
  first_name: string
  last_name: string
  company_id: string
  phone: string
  phone_secondary: string
  email: string
  preferred_contact: string
  // Mailing address
  address_line1: string
  city: string
  state: string
  zip: string
  // Pickup address
  pickup_address_line1: string
  pickup_city: string
  pickup_state: string
  pickup_zip: string
  // Additional
  drivers_license: string
  drivers_license_file: File[]
  location_attribution: string
  assigned_csr_id: string
  // Referral
  referred_by: string
  referred_by_customer_id: string
  referred_by_employee_id: string
  referrer_name: string
  notes: string
}

type ReferralCustomerOption = {
  id: number
  label: string
  phone?: string | null
  email?: string | null
}

const EMPTY: FormState = {
  first_name: '', last_name: '', company_id: '',
  phone: '', phone_secondary: '', email: '', preferred_contact: '',
  address_line1: '', city: '', state: '', zip: '',
  pickup_address_line1: '', pickup_city: '', pickup_state: '', pickup_zip: '',
  drivers_license: '', drivers_license_file: [], location_attribution: '', assigned_csr_id: '',
  referred_by: '', referred_by_customer_id: '', referred_by_employee_id: '', referrer_name: '',
  notes: '',
}

function formatCustomerDisplayName(c: Pick<Customer, 'id' | 'first_name' | 'last_name' | 'company'>) {
  const first = c.first_name?.trim() ?? ''
  const last = c.last_name?.trim() ?? ''
  const fullName = `${first} ${last}`.trim()
  const companyName = c.company?.name
  if (fullName && companyName) return `${fullName} - ${companyName}`
  if (fullName) return fullName
  if (companyName) return companyName
  return `Customer #${c.id}`
}

function fromCustomer(c: Customer): FormState {
  const hasPickup = !!(c.pickup_address_line1 || c.pickup_city || c.pickup_state || c.pickup_zip)
  return {
    first_name:              c.first_name              ?? '',
    last_name:               c.last_name               ?? '',
    company_id:              c.company_id != null ? String(c.company_id) : '',
    phone:                   formatUSPhone(c.phone ?? ''),
    phone_secondary:         formatUSPhone(c.phone_secondary ?? ''),
    email:                   c.email                   ?? '',
    preferred_contact:       c.preferred_contact       ?? '',
    address_line1:           c.address_line1           ?? '',
    city:                    c.city                    ?? '',
    state:                   c.state                   ?? '',
    zip:                     c.zip                     ?? '',
    pickup_address_line1:    c.pickup_address_line1    ?? '',
    pickup_city:             c.pickup_city             ?? '',
    pickup_state:            c.pickup_state            ?? '',
    pickup_zip:              c.pickup_zip              ?? '',
    drivers_license:         c.drivers_license         ?? '',
    drivers_license_file:    [],
    location_attribution:    c.location_attribution    ?? '',
    assigned_csr_id:         c.assigned_csr_id != null ? String(c.assigned_csr_id) : '',
    referred_by:             c.referred_by             ?? '',
    referred_by_customer_id: c.referred_by_customer_id != null ? String(c.referred_by_customer_id) : '',
    referred_by_employee_id: c.referred_by_employee_id != null ? String(c.referred_by_employee_id) : '',
    referrer_name:           c.referrer_name           ?? '',
    notes:                   c.notes                   ?? '',
    _hasPickup: hasPickup,
  } as FormState & { _hasPickup: boolean }
}

interface Props {
  customer: Customer | null   // null = create mode
  onClose: () => void
  onSaved: (c: Customer) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mb: 1 }}>
      {children}
    </Typography>
  )
}

export default function CustomerEditDialog({ customer, onClose, onSaved }: Props) {
  const { shop } = useAuth()
  const isEdit = customer != null
  const initialForm = customer ? fromCustomer(customer) : EMPTY
  const [form, setForm] = useState<FormState>(initialForm)
  const [differentPickup, setDifferentPickup] = useState(
    customer ? !!(customer.pickup_address_line1 || customer.pickup_city || customer.pickup_state || customer.pickup_zip) : false
  )
  const [addCompanyOpen, setAddCompanyOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [customerReferralSearch, setCustomerReferralSearch] = useState(
    initialForm.referred_by === 'customer' ? initialForm.referrer_name : ''
  )

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff', shop?.id],
    queryFn: () => teamApi.listMembers(shop?.id ? { shop_id: shop.id } : undefined),
    staleTime: 5 * 60 * 1000,
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', shop?.id],
    queryFn: () => companiesApi.list(shop?.id),
    enabled: !!shop?.id,
    staleTime: 2 * 60 * 1000,
  })

  useEffect(() => {
    const next = customer ? fromCustomer(customer) : EMPTY
    setForm(next)
    setDifferentPickup(customer ? !!(customer.pickup_address_line1 || customer.pickup_city || customer.pickup_state || customer.pickup_zip) : false)
    setApiError(null)
    setCustomerReferralSearch(next.referred_by === 'customer' ? next.referrer_name : '')
  }, [customer])

  function f(key: keyof FormState, value: string | File[]) {
    setForm(p => ({ ...p, [key]: value }))
  }

  const createMut = useMutation({
    mutationFn: (data: CreateCustomerInput) => customersApi.create(data),
    onSuccess: (c) => onSaved(c),
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save customer'),
  })

  const updateMut = useMutation({
    mutationFn: (data: UpdateCustomerInput) => customersApi.update(customer!.id, data),
    onSuccess: (c) => onSaved(c),
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save customer'),
  })

  const isPending = createMut.isPending || updateMut.isPending

  function buildPayload() {
    const referredBy = form.referred_by as ReferredByType | ''
    const normalizedPrimaryPhone = normalizeUSPhone(form.phone)
    const normalizedSecondaryPhone = normalizeUSPhone(form.phone_secondary)
    const normalizedEmail = normalizeEmail(form.email)
    // In edit mode, only include phone fields if the user actually changed them.
    // Without this, the payload always normalizes the stored formatted phone
    // (e.g. "(407) 555-0524") to raw digits ("4075550524"), causing a spurious
    // change in the audit log every time any other field is saved.
    const originalNormalizedPhone = isEdit ? normalizeUSPhone(customer?.phone ?? '') : null
    const originalNormalizedSecondaryPhone = isEdit ? normalizeUSPhone(customer?.phone_secondary ?? '') : null
    return {
      first_name:           form.first_name.trim()           || undefined,
      last_name:            form.last_name.trim()            || undefined,
      company_id:           form.company_id ? Number(form.company_id) : undefined,
      phone:                (!isEdit || normalizedPrimaryPhone !== originalNormalizedPhone)
        ? (normalizedPrimaryPhone || undefined) : undefined,
      phone_secondary:      (!isEdit || normalizedSecondaryPhone !== originalNormalizedSecondaryPhone)
        ? (normalizedSecondaryPhone || undefined) : undefined,
      email:                normalizedEmail                  || undefined,
      preferred_contact:    (form.preferred_contact as 'phone' | 'email' | 'text') || undefined,
      address_line1:        form.address_line1.trim()        || undefined,
      city:                 form.city.trim()                 || undefined,
      state:                form.state.trim()                || undefined,
      zip:                  form.zip.trim()                  || undefined,
      has_different_pickup_address: differentPickup,
      pickup_address_line1: differentPickup ? (form.pickup_address_line1.trim() || undefined) : null,
      pickup_city:          differentPickup ? (form.pickup_city.trim() || undefined) : null,
      pickup_state:         differentPickup ? (form.pickup_state.trim() || undefined) : null,
      pickup_zip:           differentPickup ? (form.pickup_zip.trim() || undefined) : null,
      drivers_license:      form.drivers_license.trim()      || undefined,
      drivers_license_file: form.drivers_license_file.length ? form.drivers_license_file : undefined,
      location_attribution: form.location_attribution.trim() || undefined,
      assigned_csr_id:      form.assigned_csr_id ? Number(form.assigned_csr_id) : undefined,
      referred_by:          referredBy || undefined,
      referred_by_customer_id: referredBy === 'customer' && form.referred_by_customer_id
        ? Number(form.referred_by_customer_id) : undefined,
      referred_by_employee_id: referredBy === 'employee' && form.referred_by_employee_id
        ? Number(form.referred_by_employee_id) : undefined,
      referrer_name:        form.referrer_name.trim()        || undefined,
      notes:                form.notes.trim()                || undefined,
    }
  }

  function handleSave() {
    setApiError(null)
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setApiError('First name and last name are required.')
      return
    }
    if (submitPrimaryInvalid) {
      setApiError('Primary phone number must be 10 digits.')
      return
    }
    if (submitSecondaryInvalid) {
      setApiError('Secondary phone number must be 10 digits.')
      return
    }
    if (submitEmailInvalid) {
      setApiError('Enter a valid email address.')
      return
    }
    const payload = buildPayload()
    if (isEdit) {
      updateMut.mutate(payload)
    } else {
      createMut.mutate({ ...payload, first_name: form.first_name.trim(), last_name: form.last_name.trim(), shop_id: shop?.id })
    }
  }

  const inputSx = { '& .MuiInputBase-input': { fontSize: '0.9rem' }, '& .MuiInputLabel-root': { fontSize: '0.9rem' } }
  const referredBy = form.referred_by as ReferredByType | ''
  const debouncedPrimaryPhone = useDebouncedValue(form.phone)
  const debouncedSecondaryPhone = useDebouncedValue(form.phone_secondary)
  const debouncedEmail = useDebouncedValue(form.email)
  const debouncedReferralSearch = useDebouncedValue(customerReferralSearch.trim())

  const {
    data: referralCustomersResponse,
    isFetching: referralCustomersLoading,
  } = useQuery<CustomerListResponse>({
    queryKey: ['customers_referral_lookup', { shop_id: shop?.id, search: debouncedReferralSearch }],
    queryFn: () => customersApi.list({
      shop_id: shop?.id,
      search: debouncedReferralSearch || undefined,
      per_page: 20,
    }),
    enabled: referredBy === 'customer',
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })

  const referralCustomerOptions: ReferralCustomerOption[] = (referralCustomersResponse?.data ?? []).map(c => ({
    id: c.id,
    label: formatCustomerDisplayName(c),
    phone: c.phone,
    email: c.email,
  }))

  const selectedReferralCustomerId = Number(form.referred_by_customer_id)
  const fallbackReferralCustomer: ReferralCustomerOption | null =
    referredBy === 'customer' && form.referred_by_customer_id && !Number.isNaN(selectedReferralCustomerId)
      ? {
          id: selectedReferralCustomerId,
          label: form.referrer_name || `Customer #${selectedReferralCustomerId}`,
          phone: undefined,
          email: undefined,
        }
      : null
  const selectedReferralCustomer: ReferralCustomerOption | null = referredBy === 'customer' && !Number.isNaN(selectedReferralCustomerId)
    ? referralCustomerOptions.find(opt => opt.id === selectedReferralCustomerId) ?? fallbackReferralCustomer
    : null
  const normalizedPrimaryPhone = normalizeUSPhone(form.phone)
  const normalizedSecondaryPhone = normalizeUSPhone(form.phone_secondary)
  const normalizedEmail = normalizeEmail(form.email)
  const debouncedNormalizedPrimaryPhone = normalizeUSPhone(debouncedPrimaryPhone)
  const debouncedNormalizedSecondaryPhone = normalizeUSPhone(debouncedSecondaryPhone)
  const debouncedNormalizedEmail = normalizeEmail(debouncedEmail)
  const primaryPhoneError =
    debouncedNormalizedPrimaryPhone.length > 0 && debouncedNormalizedPrimaryPhone.length !== 10
  const secondaryPhoneError =
    debouncedNormalizedSecondaryPhone.length > 0 && debouncedNormalizedSecondaryPhone.length !== 10
  const emailError =
    debouncedNormalizedEmail.length > 0 && !isValidEmail(debouncedNormalizedEmail)
  const submitPrimaryInvalid =
    normalizedPrimaryPhone.length > 0 && normalizedPrimaryPhone.length !== 10
  const submitSecondaryInvalid =
    normalizedSecondaryPhone.length > 0 && normalizedSecondaryPhone.length !== 10
  const submitEmailInvalid = normalizedEmail.length > 0 && !isValidEmail(normalizedEmail)

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose} PaperProps={{ 'data-tour-id': 'add-customer-dialog', sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={800} fontSize="1.1rem">
          {isEdit ? `Edit — ${customer.first_name} ${customer.last_name}` : 'Add New Customer'}
        </Typography>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>
        )}

        <Grid container spacing={2}>
          {/* ── Personal Info ──────────────────────────────────────────── */}
          <Grid item xs={12}><SectionLabel>Personal Info</SectionLabel></Grid>
          <Grid item xs={6}>
            <TextField label="First Name *" fullWidth sx={inputSx} value={form.first_name} onChange={e => f('first_name', e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Last Name *" fullWidth sx={inputSx} value={form.last_name} onChange={e => f('last_name', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField
              select label="Company" fullWidth sx={inputSx}
              value={form.company_id}
              onChange={e => {
                f('company_id', e.target.value)
              }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {companies.map(c => (
                <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => setAddCompanyOpen(true)}
              sx={{ mt: 0.75, color: 'primary.main', fontWeight: 600, fontSize: '0.8rem', px: 0.5, py: 0.25, minHeight: 'unset' }}
            >
              Add New Company
            </Button>
          </Grid>

          <Grid item xs={12}><Divider /></Grid>

          {/* ── Contact ────────────────────────────────────────────────── */}
          <Grid item xs={12}><SectionLabel>Contact</SectionLabel></Grid>
          <Grid item xs={6}>
            <TextField
              label="Phone"
              fullWidth
              type="tel"
              sx={inputSx}
              value={form.phone}
              onChange={e => f('phone', formatUSPhone(e.target.value))}
              error={primaryPhoneError}
              helperText={primaryPhoneError ? 'Enter a valid 10-digit US phone number' : undefined}
              inputProps={{ inputMode: 'tel', 'aria-label': 'Primary phone number' }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Secondary Phone"
              fullWidth
              type="tel"
              sx={inputSx}
              value={form.phone_secondary}
              onChange={e => f('phone_secondary', formatUSPhone(e.target.value))}
              error={secondaryPhoneError}
              helperText={secondaryPhoneError ? 'Enter a valid 10-digit US phone number' : undefined}
              inputProps={{ inputMode: 'tel', 'aria-label': 'Secondary phone number' }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Email"
              fullWidth
              type="email"
              sx={inputSx}
              value={form.email}
              onChange={e => f('email', e.target.value)}
              onBlur={e => f('email', normalizeEmail(e.target.value))}
              error={emailError}
              helperText={emailError ? 'Enter a valid email address' : undefined}
              inputProps={{ inputMode: 'email', 'aria-label': 'Customer email address' }}
            />
          </Grid>
          <Grid item xs={6}>
            {/* empty spacer */}
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Preferred Contact Method
            </Typography>
            <ToggleButtonGroup
              exclusive fullWidth
              value={form.preferred_contact || null}
              onChange={(_, v) => f('preferred_contact', v ?? '')}
            >
              <ToggleButton value="phone" sx={{ py: 1, fontSize: '0.85rem', fontWeight: 600, gap: 0.75 }}>
                <Phone size={14} /> Call
              </ToggleButton>
              <ToggleButton value="text" sx={{ py: 1, fontSize: '0.85rem', fontWeight: 600, gap: 0.75 }}>
                <MessageSquare size={14} /> Text
              </ToggleButton>
              <ToggleButton value="email" sx={{ py: 1, fontSize: '0.85rem', fontWeight: 600, gap: 0.75 }}>
                <Mail size={14} /> Email
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid item xs={12}><Divider /></Grid>

          {/* ── Mailing Address ────────────────────────────────────────── */}
          <Grid item xs={12}><SectionLabel>Mailing Address</SectionLabel></Grid>
          <Grid item xs={12}>
            <TextField label="Street Address" fullWidth sx={inputSx} value={form.address_line1} onChange={e => f('address_line1', e.target.value)} />
          </Grid>
          <Grid item xs={5}>
            <TextField label="City" fullWidth sx={inputSx} value={form.city} onChange={e => f('city', e.target.value)} />
          </Grid>
          <Grid item xs={3}>
            <TextField
              select label="State" fullWidth sx={inputSx}
              value={form.state}
              onChange={e => f('state', e.target.value)}
            >
              <MenuItem value=""><em>—</em></MenuItem>
              {US_STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={4}>
            <TextField label="ZIP" fullWidth sx={inputSx} value={form.zip} onChange={e => f('zip', e.target.value)} />
          </Grid>

          {/* Different Pickup toggle */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox checked={differentPickup} onChange={e => setDifferentPickup(e.target.checked)} size="small" />
              }
              label={<Typography variant="body2" fontWeight={600}>Different Pickup Address</Typography>}
            />
          </Grid>

          {/* Conditional pickup address */}
          {differentPickup && (
            <>
              <Grid item xs={12}>
                <TextField label="Pickup Street Address" fullWidth sx={inputSx} value={form.pickup_address_line1} onChange={e => f('pickup_address_line1', e.target.value)} />
              </Grid>
              <Grid item xs={5}>
                <TextField label="City" fullWidth sx={inputSx} value={form.pickup_city} onChange={e => f('pickup_city', e.target.value)} />
              </Grid>
              <Grid item xs={3}>
                <TextField
                  select label="State" fullWidth sx={inputSx}
                  value={form.pickup_state}
                  onChange={e => f('pickup_state', e.target.value)}
                >
                  <MenuItem value=""><em>—</em></MenuItem>
                  {US_STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={4}>
                <TextField label="ZIP" fullWidth sx={inputSx} value={form.pickup_zip} onChange={e => f('pickup_zip', e.target.value)} />
              </Grid>
            </>
          )}

          <Grid item xs={12}><Divider /></Grid>

          {/* ── Additional Details ─────────────────────────────────────── */}
          <Grid item xs={12}><SectionLabel>Additional Details</SectionLabel></Grid>
          <Grid item xs={12}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Driver's License Photo
            </Typography>
            <LicenseUploadField
              value={form.drivers_license_file}
              onChange={(files) => f('drivers_license_file', files)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              select label="Location Attribution" fullWidth sx={inputSx}
              value={form.location_attribution}
              onChange={e => f('location_attribution', e.target.value)}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              <MenuItem value="North">North</MenuItem>
              <MenuItem value="South">South</MenuItem>
              <MenuItem value="Southampton">Southampton</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontSize: '0.9rem' }}>Assigned CSR</InputLabel>
              <Select
                label="Assigned CSR"
                value={form.assigned_csr_id}
                onChange={e => f('assigned_csr_id', e.target.value)}
                sx={{ fontSize: '0.9rem' }}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {staffList.filter(s => s.role_id === 5).map(s => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()}
                    {s.job_title ? ` — ${s.job_title}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}><Divider /></Grid>

          {/* ── Referral ───────────────────────────────────────────────── */}
          <Grid item xs={12}><SectionLabel>Referral</SectionLabel></Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontSize: '0.9rem' }}>Referred By</InputLabel>
              <Select
                label="Referred By"
                value={form.referred_by}
              onChange={e => {
                f('referred_by', e.target.value)
                // Reset sub-fields when type changes
                f('referred_by_customer_id', '')
                f('referred_by_employee_id', '')
                f('referrer_name', '')
                setCustomerReferralSearch('')
              }}
              sx={{ fontSize: '0.9rem' }}
            >
                <MenuItem value=""><em>None</em></MenuItem>
                {REFERRED_BY_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Referred By Customer → search + select existing customer */}
          {referredBy === 'customer' && (
            <Grid item xs={12}>
              <Autocomplete
                fullWidth
                options={referralCustomerOptions}
                value={selectedReferralCustomer}
                onChange={(_, option) => {
                  f('referred_by_customer_id', option ? String(option.id) : '')
                  f('referrer_name', option?.label ?? '')
                  setCustomerReferralSearch(option?.label ?? '')
                }}
                inputValue={customerReferralSearch}
                onInputChange={(_, value) => setCustomerReferralSearch(value)}
                filterOptions={(opts) => opts}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                loading={referralCustomersLoading}
                loadingText="Searching customers..."
                noOptionsText={customerReferralSearch.trim().length > 0 ? 'No matching customers' : 'No customers found'}
                renderOption={(props, option) => {
                  const details = [
                    option.phone ? formatUSPhone(option.phone) : null,
                    option.email?.trim() || null,
                  ].filter(Boolean).join(' | ')
                  return (
                    <li {...props} key={option.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2" fontWeight={600}>{option.label}</Typography>
                        {details && (
                          <Typography variant="caption" color="text.secondary">
                            {details}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Referred By Customer"
                    placeholder="Search by name, phone, or email..."
                    sx={inputSx}
                  />
                )}
              />
            </Grid>
          )}

          {/* Referred By Employee → employee dropdown */}
          {referredBy === 'employee' && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel sx={{ fontSize: '0.9rem' }}>Referred By Employee</InputLabel>
                <Select
                  label="Referred By Employee"
                  value={form.referred_by_employee_id}
                  onChange={e => {
                    f('referred_by_employee_id', e.target.value)
                    // Auto-fill referrer_name
                    const emp = staffList.find(s => String(s.id) === e.target.value)
                    if (emp) f('referrer_name', emp.name || `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim())
                  }}
                  sx={{ fontSize: '0.9rem' }}
                >
                  <MenuItem value=""><em>Select employee…</em></MenuItem>
                  {staffList.map(s => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()}
                      {s.job_title ? ` — ${s.job_title}` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Name of referrer — internet / social / walk_in / other */}
          {referredBy && referredBy !== 'customer' && referredBy !== 'employee' && (
            <Grid item xs={12}>
              <TextField
                label="Name of the Referrer"
                fullWidth sx={inputSx}
                value={form.referrer_name}
                onChange={e => f('referrer_name', e.target.value)}
              />
            </Grid>
          )}

          <Grid item xs={12}><Divider /></Grid>

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <Grid item xs={12}>
            <TextField
              label="Notes" fullWidth multiline rows={3} sx={inputSx}
              value={form.notes} onChange={e => f('notes', e.target.value)}
              placeholder="Internal notes about this customer…"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained" onClick={handleSave} disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ borderRadius: 2, minWidth: 140 }}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
        </Button>
      </DialogActions>

      <AddCompanyDialog
        open={addCompanyOpen}
        onClose={() => setAddCompanyOpen(false)}
        onCreated={(company) => {
          f('company_id', String(company.id))
          setAddCompanyOpen(false)
        }}
      />
    </Dialog>
  )
}
