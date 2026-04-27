import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { vehiclesApi, decodeVin } from '@/api/vehicles'
import type { CreateVehicleInput, Vehicle } from '@/types/vehicle'
import { repairOrdersApi } from '@/api/repairOrders'
import AddVehicleDialog from '@/views/customers-view/components/AddVehicleDialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import { Save, Edit, ExternalLink, Plus, Search } from 'lucide-react'

interface Props {
  roId: number
  customerId: number
  vehicle: Vehicle | null
  onViewDetails?: () => void
}

type Mode = 'view' | 'add'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

function emptyVehicle(customerId: number): CreateVehicleInput {
  return { customer_id: customerId }
}

function SegCell({ label, value, border, mono }: { label: string; value: string | number | null | undefined; border?: boolean; mono?: boolean }) {
  return (
    <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: border ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: value ? 'text.primary' : 'text.disabled', fontFamily: mono ? 'monospace' : undefined }}>
        {value ?? '—'}
      </Typography>
    </Box>
  )
}

export default function VehiclePanel({ roId, customerId, vehicle, onViewDetails }: Props) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>('view')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [form, setForm] = useState<CreateVehicleInput | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [vinInput, setVinInput] = useState('')
  const [vinDecoding, setVinDecoding] = useState(false)
  const [vinMessage, setVinMessage] = useState<string | null>(null)
  function invalidate() {
    qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
  }

  function setField<K extends keyof CreateVehicleInput>(key: K, val: CreateVehicleInput[K]) {
    setForm((prev) => prev ? { ...prev, [key]: val } : prev)
  }

  // ── Create new vehicle + link to RO ─────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async (data: CreateVehicleInput) => {
      const newVehicle = await vehiclesApi.create(data)
      await repairOrdersApi.updateVehicle(roId, newVehicle.id)
      return newVehicle
    },
    onSuccess: () => { invalidate(); setMode('view'); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save'),
  })

  async function handleDecodeVin() {
    if (!vinInput.trim()) return
    setVinDecoding(true)
    setVinMessage(null)
    try {
      const decoded = await decodeVin(vinInput)
      if (decoded) {
        setForm((prev) => ({
          ...(prev ?? emptyVehicle(customerId)),
          vin:   vinInput.trim().toUpperCase(),
          year:  decoded.year ?? undefined,
          make:  decoded.make ?? undefined,
          model: decoded.model ?? undefined,
          trim:  decoded.trim ?? undefined,
        }))
        setVinMessage(`Decoded: ${decoded.year} ${decoded.make} ${decoded.model}`)
      } else {
        setVinMessage('Could not decode VIN — fill in details manually.')
      }
    } finally {
      setVinDecoding(false)
    }
  }

  function startAdd() {
    setForm(emptyVehicle(customerId))
    setVinInput('')
    setVinMessage(null)
    setApiError(null)
    setMode('add')
  }

  function handleSave() {
    if (!form) return
    createMut.mutate(form)
  }

  const isPending = createMut.isPending
  const f = form as CreateVehicleInput

  // ── VIEW ─────────────────────────────────────────────────────────────────────
  if (mode === 'view') {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
            {vehicle ? 'Vehicle Record' : 'No Vehicle Assigned'}
          </Typography>
          <Stack direction="row" spacing={1}>
            {vehicle ? (
              <>
                <Button size="small" startIcon={<ExternalLink size={14} />} onClick={onViewDetails}>
                  View Details
                </Button>
                <Button size="small" startIcon={<Edit size={14} />} onClick={() => setShowEditDialog(true)}>
                  Edit
                </Button>
              </>
            ) : (
              <Button size="small" startIcon={<Plus size={14} />} onClick={startAdd}>
                Add Vehicle
              </Button>
            )}
          </Stack>
        </Box>

        {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}

        {vehicle ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {/* Row 1: Year · Make · Model · Trim */}
            <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
              <SegCell label="Year"  value={vehicle.year} />
              <SegCell label="Make"  value={vehicle.make} border />
              <SegCell label="Model" value={vehicle.model} border />
              <SegCell label="Trim"  value={vehicle.trim}  border />
            </Box>
            {/* Row 2: Color · Mileage In · License Plate · State */}
            <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
              <SegCell label="Color"       value={vehicle.color} />
              <SegCell label="Mileage In"  value={vehicle.mileage_in?.toLocaleString()} border />
              <SegCell label="Plate"       value={vehicle.license_plate} border />
              <SegCell label="State"       value={vehicle.license_state} border />
            </Box>
            {/* Row 3: VIN (full width) */}
            <Box sx={{ display: 'flex' }}>
              <SegCell label="VIN" value={vehicle.vin} mono />
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled">
            No vehicle linked to this repair order. Add one to capture VIN, plate, and mileage details.
          </Typography>
        )}

      {/* Edit Vehicle dialog */}
      {showEditDialog && vehicle && (
        <AddVehicleDialog
          vehicle={vehicle}
          onClose={() => setShowEditDialog(false)}
          onSaved={() => { setShowEditDialog(false); invalidate() }}
        />
      )}

      </Box>
    )
  }

  // ── ADD FORM ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={2}>
        Add Vehicle
      </Typography>

      {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}

      {/* VIN decoder */}
      <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            VIN Decoder (optional — fills in year, make, model automatically)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Enter VIN…"
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDecodeVin() }}
              inputProps={{ maxLength: 17 }}
              sx={{ flex: 1 }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={handleDecodeVin}
              disabled={vinDecoding || !vinInput.trim()}
              startIcon={vinDecoding ? <CircularProgress size={14} /> : <Search size={14} />}
            >
              Decode
            </Button>
          </Box>
          {vinMessage && (
            <Typography variant="caption" color={vinMessage.startsWith('Decoded') ? 'success.main' : 'text.secondary'} mt={0.5} display="block">
              {vinMessage}
            </Typography>
          )}
      </Box>

      <Grid container spacing={1.5}>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Year" size="small" fullWidth type="number"
            value={f?.year ?? ''}
            onChange={(e) => setField('year', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Make" size="small" fullWidth
            value={f?.make ?? ''}
            onChange={(e) => setField('make', e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Model" size="small" fullWidth
            value={f?.model ?? ''}
            onChange={(e) => setField('model', e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Trim" size="small" fullWidth
            value={f?.trim ?? ''}
            onChange={(e) => setField('trim', e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField
            label="Color" size="small" fullWidth
            value={f?.color ?? ''}
            onChange={(e) => setField('color', e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField
            label="Mileage In" size="small" fullWidth type="number"
            value={f?.mileage_in ?? ''}
            onChange={(e) => setField('mileage_in', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="VIN" size="small" fullWidth
            value={f?.vin ?? ''}
            inputProps={{ maxLength: 17 }}
            onChange={(e) => setField('vin', e.target.value.toUpperCase())}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField
            label="License Plate" size="small" fullWidth
            value={f?.license_plate ?? ''}
            onChange={(e) => setField('license_plate', e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField
            select size="small" fullWidth label="State"
            value={f?.license_state ?? ''}
            onChange={(e) => setField('license_state', e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="" />
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </TextField>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
        <Button
          variant="outlined" size="small" onClick={() => setMode('view')}
          disabled={isPending} sx={{ flex: 1 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained" size="small" onClick={handleSave} disabled={isPending}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
          sx={{ flex: 1 }}
        >
          Add Vehicle
        </Button>
      </Stack>
    </Box>
  )
}
