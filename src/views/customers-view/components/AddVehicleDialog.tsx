import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { vehiclesApi, decodeVin } from '@/api/vehicles'
import type { UpdateVehicleInput } from '@/api/vehicles'
import type { Customer } from '@/types/customer'
import type { Vehicle } from '@/types/vehicle'
import type { CreateVehicleInput } from '@/types/vehicle'
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
import InputAdornment from '@mui/material/InputAdornment'
import { X, CheckCircle, Scan } from 'lucide-react'
import DocumentUploadField from '@/components/DocumentUploadField'
import { useToast } from '@/context/ToastContext'
import { documentsApi } from '@/api/documents'

interface Props {
  /** Provide to open in Edit mode — pre-fills all fields */
  vehicle?: Vehicle
  /** Required for Add mode */
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}

export default function AddVehicleDialog({ vehicle, customer, onClose, onSaved }: Props) {
  const isEdit = Boolean(vehicle)
  const customerId = vehicle?.customer_id ?? customer!.id

  const qc = useQueryClient()
  const { showToast } = useToast()

  const [vin, setVin]           = useState(vehicle?.vin ?? '')
  const [decoding, setDecoding] = useState(false)
  const [decoded, setDecoded]   = useState(false)
  const [vinError, setVinError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const [form, setForm] = useState<Partial<UpdateVehicleInput>>(() =>
    isEdit
      ? {
          year:          vehicle!.year          ?? undefined,
          make:          vehicle!.make          ?? undefined,
          model:         vehicle!.model         ?? undefined,
          trim:          vehicle!.trim          ?? undefined,
          color:         vehicle!.color         ?? undefined,
          license_plate: vehicle!.license_plate ?? undefined,
          license_state: vehicle!.license_state ?? undefined,
          mileage_in:    vehicle!.mileage_in    ?? undefined,
        }
      : {}
  )

  const [registrationFiles,  setRegistrationFiles]  = useState<File[]>([])
  const [insuranceCardFiles, setInsuranceCardFiles] = useState<File[]>([])

  function f<K extends keyof UpdateVehicleInput>(key: K, val: UpdateVehicleInput[K]) {
    setForm(p => ({ ...p, [key]: val }))
  }

  async function handleDecode() {
    if (vin.length < 10) { setVinError('Enter at least 10 characters'); return }
    setDecoding(true); setVinError(null); setDecoded(false)
    const result = await decodeVin(vin)
    setDecoding(false)
    if (!result) {
      setVinError('Could not decode VIN — fill in the fields below manually.')
    } else {
      setForm(p => ({
        ...p,
        vin:   vin.toUpperCase(),
        year:  result.year  ?? p.year,
        make:  result.make  ?? p.make,
        model: result.model ?? p.model,
        trim:  result.trim  ?? p.trim,
      }))
      setDecoded(true)
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const saved = isEdit
        ? await vehiclesApi.update(vehicle!.id, { ...form, vin: vin || undefined })
        : await vehiclesApi.create({ ...form, vin: vin || undefined, customer_id: customerId } as CreateVehicleInput)

      const uploads: Promise<unknown>[] = [
        ...registrationFiles.map(file =>
          documentsApi.upload({ entityType: 'vehicle', entityId: saved.id, file, category: 'registration' })
        ),
        ...insuranceCardFiles.map(file =>
          documentsApi.upload({ entityType: 'vehicle', entityId: saved.id, file, category: 'insurance_card' })
        ),
      ]
      if (uploads.length > 0) await Promise.all(uploads)

      return saved
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles', customerId] })
      qc.invalidateQueries({ queryKey: ['customers_table'] })
      showToast(isEdit ? 'Vehicle updated' : 'Vehicle added')
      onSaved()
    },
    onError: (err: { message?: string }) => {
      const msg = err.message ?? (isEdit ? 'Failed to update vehicle' : 'Failed to add vehicle')
      setApiError(msg)
      showToast(msg, 'error')
    },
  })

  const sx = { '& .MuiInputBase-input': { fontSize: '0.9rem' }, '& .MuiInputLabel-root': { fontSize: '0.9rem' } }
  const canSave = !mutation.isPending && (!!form.make || !!form.model || !!vin)

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography fontWeight={800} fontSize="1.05rem">
            {isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
          </Typography>
          {!isEdit && customer && (
            <Typography fontSize="0.82rem" color="text.secondary">
              For {customer.first_name} {customer.last_name}
            </Typography>
          )}
          {isEdit && vehicle && (
            <Typography fontSize="0.82rem" color="text.secondary">
              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}

        {/* VIN Decoder */}
        <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1 }}>
          VIN Lookup
        </Typography>
        <TextField
          fullWidth
          placeholder="Enter VIN to auto-fill fields…"
          value={vin}
          onChange={e => { setVin(e.target.value.toUpperCase()); setDecoded(false); setVinError(null) }}
          inputProps={{ maxLength: 17, style: { fontFamily: 'monospace', letterSpacing: '0.1em' } }}
          sx={{ mb: 1, ...sx }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  size="small" variant="contained"
                  disabled={vin.length < 10 || decoding}
                  onClick={handleDecode}
                  startIcon={decoding ? <CircularProgress size={14} color="inherit" /> : <Scan size={14} />}
                  sx={{ borderRadius: 1.5, fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                >
                  {decoding ? 'Decoding…' : 'Decode VIN'}
                </Button>
              </InputAdornment>
            ),
          }}
        />
        {vinError && <Typography sx={{ fontSize: '0.82rem', color: 'error.main', mb: 1.5 }}>{vinError}</Typography>}
        {decoded && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.25, bgcolor: 'rgba(102,187,106,0.08)', borderRadius: 2, border: '1px solid rgba(102,187,106,0.3)' }}>
            <CheckCircle size={15} color="#66BB6A" />
            <Typography sx={{ fontSize: '0.85rem', color: 'success.main', fontWeight: 600 }}>
              VIN decoded — fields filled in below
            </Typography>
          </Box>
        )}

        {/* Vehicle Fields */}
        <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1.5, mt: 1 }}>
          Vehicle Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={3}>
            <TextField label="Year" fullWidth type="number" sx={sx}
              value={form.year ?? ''}
              onChange={e => f('year', parseInt(e.target.value) || undefined)} />
          </Grid>
          <Grid item xs={4}>
            <TextField label="Make" fullWidth sx={sx}
              value={form.make ?? ''} onChange={e => f('make', e.target.value)} />
          </Grid>
          <Grid item xs={5}>
            <TextField label="Model" fullWidth sx={sx}
              value={form.model ?? ''} onChange={e => f('model', e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Trim" fullWidth sx={sx}
              value={form.trim ?? ''} onChange={e => f('trim', e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Color" fullWidth sx={sx}
              value={form.color ?? ''} onChange={e => f('color', e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="License Plate" fullWidth sx={sx}
              value={form.license_plate ?? ''} onChange={e => f('license_plate', e.target.value)} />
          </Grid>
          <Grid item xs={3}>
            <TextField label="State" fullWidth sx={sx} inputProps={{ maxLength: 2 }}
              value={form.license_state ?? ''} onChange={e => f('license_state', e.target.value.toUpperCase())} />
          </Grid>
          <Grid item xs={3}>
            <TextField label="Mileage In" fullWidth type="number" sx={sx}
              value={form.mileage_in ?? ''}
              onChange={e => f('mileage_in', parseInt(e.target.value) || undefined)} />
          </Grid>
        </Grid>

        {/* Document Uploads — add mode only */}
        {!isEdit && (
          <>
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1.5, mt: 2.5 }}>
              Documents
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                  Vehicle Registration
                </Typography>
                <DocumentUploadField
                  value={registrationFiles}
                  label="Registration"
                  onChange={setRegistrationFiles}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                  Insurance Card
                </Typography>
                <DocumentUploadField
                  value={insuranceCardFiles}
                  label="Insurance Card"
                  onChange={setInsuranceCardFiles}
                />
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!canSave}
          startIcon={mutation.isPending ? <CircularProgress size={15} color="inherit" /> : null}
          sx={{ borderRadius: 2, minWidth: 130 }}
        >
          {mutation.isPending
            ? (isEdit ? 'Saving…' : 'Adding…')
            : (isEdit ? 'Save Vehicle' : 'Add Vehicle')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
