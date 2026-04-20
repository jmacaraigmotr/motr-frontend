import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rentalCompaniesApi } from '@/api/rentalCompanies'
import type { RentalCompany, CreateRentalCompanyInput, UpdateRentalCompanyInput } from '@/api/rentalCompanies'
import { useAuth } from '@/hooks/useAuth'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { X, Car } from 'lucide-react'
import { formatUSPhone, normalizeUSPhone } from '@/lib/validation'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const inputSx = {
  '& .MuiInputBase-input': { fontSize: '0.95rem' },
  '& .MuiInputLabel-root': { fontSize: '0.95rem' },
}

interface Props {
  open: boolean
  /** Pass an existing company to edit it; omit (or null) for create mode */
  company?: RentalCompany | null
  onClose: () => void
  onCreated: (company: RentalCompany) => void
}

const EMPTY = { name: '', phone: '', website: '', notes: '' }

export default function AddRentalCompanyDialog({ open, company, onClose, onCreated }: Props) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const isEdit = company != null

  const [form, setForm] = useState(EMPTY)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(company
        ? {
            name:    company.name         ?? '',
            phone:   formatUSPhone(company.phone    ?? ''),
            website: company.website      ?? '',
            notes:   company.notes        ?? '',
          }
        : EMPTY
      )
      setApiError(null)
    }
  }, [open, company])

  function f(key: keyof typeof EMPTY, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  const normalizedPhone = normalizeUSPhone(form.phone)
  const dPhone = useDebouncedValue(form.phone)
  const phoneError = normalizeUSPhone(dPhone).length > 0 && normalizeUSPhone(dPhone).length !== 10
  const submitHasErrors = normalizedPhone.length > 0 && normalizedPhone.length !== 10

  const createMut = useMutation({
    mutationFn: () => rentalCompaniesApi.create({
      name:    form.name.trim(),
      shop_id: shop?.id,
      phone:   normalizedPhone || undefined,
      website: form.website.trim() || undefined,
      notes:   form.notes.trim()   || undefined,
    } as CreateRentalCompanyInput),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['rental_companies'] }); onCreated(c); handleClose() },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to create rental company.'),
  })

  const updateMut = useMutation({
    mutationFn: () => rentalCompaniesApi.update(company!.id, {
      name:    form.name.trim()    || undefined,
      phone:   normalizedPhone     || undefined,
      website: form.website.trim() || undefined,
      notes:   form.notes.trim()   || undefined,
    } as UpdateRentalCompanyInput),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['rental_companies'] }); onCreated(c); handleClose() },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to update rental company.'),
  })

  const isPending = createMut.isPending || updateMut.isPending

  function handleClose() {
    setForm(EMPTY)
    setApiError(null)
    onClose()
  }

  function handleSubmit() {
    if (isEdit) updateMut.mutate()
    else createMut.mutate()
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
        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Car size={18} />
          {isEdit ? `Edit — ${company.name}` : 'Add Rental Company'}
        </Typography>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: '12px !important', pb: 1 }}>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Company Name" required fullWidth autoFocus sx={inputSx}
              value={form.name}
              onChange={e => f('name', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && form.name.trim() && !submitHasErrors) handleSubmit() }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Phone" fullWidth type="tel" sx={inputSx}
              value={form.phone}
              onChange={e => f('phone', formatUSPhone(e.target.value))}
              error={phoneError}
              helperText={phoneError ? 'Enter a valid 10-digit US phone number' : undefined}
              inputProps={{ inputMode: 'tel' }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Website" fullWidth sx={inputSx}
              value={form.website}
              onChange={e => f('website', e.target.value)}
              inputProps={{ inputMode: 'url' }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes" fullWidth multiline rows={2} sx={inputSx}
              value={form.notes}
              onChange={e => f('notes', e.target.value)}
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
          disabled={!form.name.trim() || submitHasErrors || isPending}
          onClick={handleSubmit}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <Car size={16} />}
          sx={{ borderRadius: 2, minWidth: 160 }}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Company'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
