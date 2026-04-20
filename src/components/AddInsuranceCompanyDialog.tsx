import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { insuranceCompaniesApi } from '@/api/insuranceCompanies'
import type { InsuranceCompany, CreateInsuranceCompanyInput, UpdateInsuranceCompanyInput } from '@/api/insuranceCompanies'
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
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { X, ShieldCheck } from 'lucide-react'
import { formatUSPhone, normalizeUSPhone, normalizeEmail, isValidEmail } from '@/lib/validation'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const inputSx = {
  '& .MuiInputBase-input': { fontSize: '0.95rem' },
  '& .MuiInputLabel-root': { fontSize: '0.95rem' },
}

interface Props {
  open: boolean
  /** Pass an existing company to edit it; omit (or null) for create mode */
  company?: InsuranceCompany | null
  onClose: () => void
  onCreated: (company: InsuranceCompany) => void
}

const EMPTY = { name: '', phone: '', rep_name: '', rep_phone: '', rep_email: '' }

export default function AddInsuranceCompanyDialog({ open, company, onClose, onCreated }: Props) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const isEdit = company != null

  const [form, setForm] = useState(EMPTY)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(company
        ? {
            name:      company.name         ?? '',
            phone:     formatUSPhone(company.phone     ?? ''),
            rep_name:  company.rep_name     ?? '',
            rep_phone: formatUSPhone(company.rep_phone ?? ''),
            rep_email: company.rep_email    ?? '',
          }
        : EMPTY
      )
      setApiError(null)
    }
  }, [open, company])

  function f(key: keyof typeof EMPTY, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  const normalizedPhone    = normalizeUSPhone(form.phone)
  const normalizedRepPhone = normalizeUSPhone(form.rep_phone)
  const normalizedEmail    = normalizeEmail(form.rep_email)

  const dPhone    = useDebouncedValue(form.phone)
  const dRepPhone = useDebouncedValue(form.rep_phone)
  const dEmail    = useDebouncedValue(form.rep_email)

  const phoneError    = normalizeUSPhone(dPhone).length > 0    && normalizeUSPhone(dPhone).length !== 10
  const repPhoneError = normalizeUSPhone(dRepPhone).length > 0 && normalizeUSPhone(dRepPhone).length !== 10
  const emailError    = normalizeEmail(dEmail).length > 0      && !isValidEmail(normalizeEmail(dEmail))

  const submitHasErrors =
    (normalizedPhone.length > 0    && normalizedPhone.length !== 10)    ||
    (normalizedRepPhone.length > 0 && normalizedRepPhone.length !== 10) ||
    (normalizedEmail.length > 0    && !isValidEmail(normalizedEmail))

  const createMut = useMutation({
    mutationFn: () => insuranceCompaniesApi.create({
      name:      form.name.trim(),
      shop_id:   shop?.id,
      phone:     normalizedPhone     || undefined,
      rep_name:  form.rep_name.trim()  || undefined,
      rep_phone: normalizedRepPhone  || undefined,
      rep_email: normalizedEmail     || undefined,
    } as CreateInsuranceCompanyInput),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['insurance_companies'] }); onCreated(c); handleClose() },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to create insurance company.'),
  })

  const updateMut = useMutation({
    mutationFn: () => insuranceCompaniesApi.update(company!.id, {
      name:      form.name.trim()      || undefined,
      phone:     normalizedPhone       || undefined,
      rep_name:  form.rep_name.trim()  || undefined,
      rep_phone: normalizedRepPhone    || undefined,
      rep_email: normalizedEmail       || undefined,
    } as UpdateInsuranceCompanyInput),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['insurance_companies'] }); onCreated(c); handleClose() },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to update insurance company.'),
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
          <ShieldCheck size={18} />
          {isEdit ? `Edit — ${company.name}` : 'Add Insurance Company'}
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
          {/* ── Company info ── */}
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
              label="Company Phone" fullWidth type="tel" sx={inputSx}
              value={form.phone}
              onChange={e => f('phone', formatUSPhone(e.target.value))}
              error={phoneError}
              helperText={phoneError ? 'Enter a valid 10-digit US phone number' : undefined}
              inputProps={{ inputMode: 'tel' }}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', px: 1 }}>
                Representative Contact
              </Typography>
            </Divider>
          </Grid>

          {/* ── Rep contact ── */}
          <Grid item xs={12}>
            <TextField
              label="Rep Name" fullWidth sx={inputSx}
              value={form.rep_name}
              onChange={e => f('rep_name', e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Rep Phone" fullWidth type="tel" sx={inputSx}
              value={form.rep_phone}
              onChange={e => f('rep_phone', formatUSPhone(e.target.value))}
              error={repPhoneError}
              helperText={repPhoneError ? 'Enter a valid 10-digit US phone number' : undefined}
              inputProps={{ inputMode: 'tel' }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Rep Email" fullWidth type="email" sx={inputSx}
              value={form.rep_email}
              onChange={e => f('rep_email', e.target.value)}
              onBlur={e => f('rep_email', normalizeEmail(e.target.value))}
              error={emailError}
              helperText={emailError ? 'Enter a valid email address' : undefined}
              inputProps={{ inputMode: 'email' }}
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
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <ShieldCheck size={16} />}
          sx={{ borderRadius: 2, minWidth: 160 }}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Company'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
