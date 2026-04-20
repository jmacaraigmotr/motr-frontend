import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '@/api/companies'
import { useAuth } from '@/hooks/useAuth'
import type { Company } from '@/types/company'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { X, Building2 } from 'lucide-react'
import { formatUSPhone, normalizeUSPhone, normalizeEmail, isValidEmail } from '@/lib/validation'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const inputSx = {
  '& .MuiInputBase-input': { fontSize: '0.95rem' },
  '& .MuiInputLabel-root': { fontSize: '0.95rem' },
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (company: Company) => void
}

export default function AddCompanyDialog({ open, onClose, onCreated }: Props) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [notes, setNotes] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const normalizedPhone = normalizeUSPhone(phone)
  const normalizedEmail = normalizeEmail(email)
  const debouncedPhone = useDebouncedValue(phone)
  const debouncedEmail = useDebouncedValue(email)
  const debouncedNormalizedPhone = normalizeUSPhone(debouncedPhone)
  const debouncedNormalizedEmail = normalizeEmail(debouncedEmail)
  const phoneError = debouncedNormalizedPhone.length > 0 && debouncedNormalizedPhone.length !== 10
  const emailError =
    debouncedNormalizedEmail.length > 0 && !isValidEmail(debouncedNormalizedEmail)
  const submitHasErrors =
    (normalizedPhone.length > 0 && normalizedPhone.length !== 10) ||
    (normalizedEmail.length > 0 && !isValidEmail(normalizedEmail))

  const mutation = useMutation({
    mutationFn: () => companiesApi.create({
      name: name.trim(),
      shop_id: shop?.id,
      phone: normalizedPhone || undefined,
      email: normalizedEmail || undefined,
      address_line1: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state || undefined,
      zip: zip.trim() || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: (company) => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      onCreated(company)
      handleClose()
    },
    onError: (err: { message?: string }) => {
      setApiError(err.message ?? 'Failed to create company.')
    },
  })

  function handleClose() {
    setName(''); setPhone(''); setEmail(''); setAddress('')
    setCity(''); setState(''); setZip(''); setNotes('')
    setApiError(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pt: 3, pb: 1.5, px: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Building2 size={20} />
          Add New Company
        </Typography>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: '16px !important', pb: 1 }}>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Company Name" required fullWidth autoFocus sx={inputSx}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Phone"
              fullWidth
              type="tel"
              sx={inputSx}
              value={phone}
              onChange={e => setPhone(formatUSPhone(e.target.value))}
              error={phoneError}
              helperText={phoneError ? 'Enter a valid 10-digit US phone number' : undefined}
              inputProps={{ inputMode: 'tel', 'aria-label': 'Company phone number' }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Email"
              fullWidth
              type="email"
              sx={inputSx}
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={e => setEmail(normalizeEmail(e.target.value))}
              error={emailError}
              helperText={emailError ? 'Enter a valid email address' : undefined}
              inputProps={{ inputMode: 'email', 'aria-label': 'Company email address' }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Street Address" fullWidth sx={inputSx}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </Grid>
          <Grid item xs={5}>
            <TextField
              label="City" fullWidth sx={inputSx}
              value={city}
              onChange={e => setCity(e.target.value)}
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              select label="State" fullWidth sx={inputSx}
              value={state}
              onChange={e => setState(e.target.value)}
            >
              <MenuItem value=""><em>—</em></MenuItem>
              {US_STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="ZIP" fullWidth sx={inputSx}
              value={zip}
              onChange={e => setZip(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes" fullWidth multiline rows={2} sx={inputSx}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={handleClose} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!name.trim() || submitHasErrors || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Building2 size={16} />}
          sx={{ borderRadius: 2, minWidth: 140 }}
        >
          {mutation.isPending ? 'Creating…' : 'Create Company'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
