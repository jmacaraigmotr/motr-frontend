import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rentalsApi } from '@/api/rentals'
import type { CreateRentalInput, UpdateRentalInput } from '@/api/rentals'
import { rentalCompaniesApi } from '@/api/rentalCompanies'
import type { RentalCompany } from '@/api/rentalCompanies'
import { useAuth } from '@/hooks/useAuth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { Save, Edit, Car, Trash2, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { format as formatDateOnly, isValid as isValidDate } from 'date-fns'
import AddRentalCompanyDialog from '@/components/AddRentalCompanyDialog'

interface Props { roId: number }

const labelSx = {
  fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled',
  textTransform: 'uppercase' as const, letterSpacing: '0.08em', mb: 0.25,
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  return isValidDate(d) ? formatDateOnly(d, 'MMM d, yyyy') : s
}

function CompanySelect({
  value,
  onChange,
}: {
  value: string | null | undefined
  onChange: (name: string) => void
}) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: companies = [] } = useQuery({
    queryKey: ['rental_companies', shop?.id],
    queryFn: () => rentalCompaniesApi.list({ shop_id: shop?.id }),
    staleTime: 30_000,
    enabled: !!shop?.id,
  })

  function handleCreated(company: RentalCompany) {
    qc.invalidateQueries({ queryKey: ['rental_companies'] })
    onChange(company.name)
  }

  return (
    <>
      <TextField
        label="Rental Company"
        select
        size="small"
        fullWidth
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end" sx={{ mr: 2 }}>
              <IconButton size="small" onClick={() => setAddOpen(true)} title="Add new rental company">
                <Plus size={14} />
              </IconButton>
            </InputAdornment>
          ),
        }}
      >
        <MenuItem value=""><em>— None —</em></MenuItem>
        {companies.map(c => (
          <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
        ))}
      </TextField>
      <AddRentalCompanyDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value}</Typography>
    </Box>
  )
}

export default function RentalPanel({ roId }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<CreateRentalInput | UpdateRentalInput | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  // tracks which side of the date triangle was last set by the user
  const [dateMode, setDateMode] = useState<'days' | 'due' | null>(null)

  const { data: rental, isLoading } = useQuery({
    queryKey: ['rental', roId],
    queryFn: () => rentalsApi.getByRO(roId),
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['rental', roId] })
    qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
  }

  const createMut = useMutation({
    mutationFn: rentalsApi.create,
    onSuccess: () => { invalidateAll(); setEditing(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRentalInput }) => rentalsApi.update(id, data),
    onSuccess: () => { invalidateAll(); setEditing(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => rentalsApi.delete(id),
    onSuccess: () => { invalidateAll(); setConfirmDelete(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to delete'),
  })

  function startEdit() {
    setForm(rental ? { ...rental } as unknown as UpdateRentalInput : { repair_order_id: roId })
    setDateMode(rental?.rental_due_date && rental?.days_on_policy ? 'days' : null)
    setEditing(true)
  }
  function setField<K extends keyof CreateRentalInput>(key: K, val: CreateRentalInput[K]) {
    if (key === 'days_on_policy' || key === 'rental_start_date') setDateMode('days')
    if (key === 'rental_due_date') setDateMode('due')

    setForm((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: val }

      // Auto-compute Due Date when Start Date or Days on Policy changes
      if (key === 'rental_start_date' || key === 'days_on_policy') {
        const start = key === 'rental_start_date' ? (val as string | undefined) : prev.rental_start_date
        const days  = key === 'days_on_policy'    ? (val as number | undefined) : prev.days_on_policy
        if (start && days != null && days > 0) {
          const d = new Date(start + 'T12:00:00')
          d.setDate(d.getDate() + days)
          next.rental_due_date = formatDateOnly(d, 'yyyy-MM-dd')
        }
      }

      // Auto-compute Days on Policy when Due Date changes (and Start Date is set)
      if (key === 'rental_due_date' && val && prev.rental_start_date) {
        const start = new Date(prev.rental_start_date + 'T12:00:00')
        const end   = new Date((val as string) + 'T12:00:00')
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays > 0) next.days_on_policy = diffDays
      }

      return next
    })
  }
  function handleSave() {
    if (!form) return
    if (rental) updateMut.mutate({ id: rental.id, data: form as UpdateRentalInput })
    else createMut.mutate(form as CreateRentalInput)
  }

  const isPending = createMut.isPending || updateMut.isPending || deleteMut.isPending
  const dialogForm = form as CreateRentalInput | null

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Car size={16} style={{ opacity: 0.5 }} />
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">Rental</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {rental && (
            <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button size="small" startIcon={<Edit size={14} />} onClick={startEdit}>
            {rental ? 'Edit' : 'Add Rental'}
          </Button>
        </Box>
      </Box>

      <Dialog open={confirmDelete} onClose={() => !isPending && setConfirmDelete(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ p: 0.75, bgcolor: 'error.light', borderRadius: 1.5, display: 'flex', color: 'error.main' }}>
              <Trash2 size={16} />
            </Box>
            Delete Rental Record?
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete the rental record. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button fullWidth variant="outlined" onClick={() => setConfirmDelete(false)} disabled={isPending}>Cancel</Button>
          <Button
            fullWidth variant="contained" color="error"
            onClick={() => rental && deleteMut.mutate(rental.id)}
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={12} color="inherit" /> : <Trash2 size={14} />}
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      {rental ? (
        <Box>
          {/* ── Detail card ─────────────────────────────────── */}
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: rental.notes ? 2 : 0 }}>

            {/* Row 1: Company · Daily Rate */}
            <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 2, px: 2, py: 1.25 }}>
                <Typography sx={labelSx}>Rental Company</Typography>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: rental.rental_company ? 'text.primary' : 'text.disabled' }}>
                  {rental.rental_company ?? '—'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                <Typography sx={labelSx}>Daily Rate</Typography>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: rental.approved_daily_amount != null ? 'text.primary' : 'text.disabled' }}>
                  {rental.approved_daily_amount != null ? `${formatCurrency(rental.approved_daily_amount)} / day` : '—'}
                </Typography>
              </Box>
            </Box>

            {/* Row 2: Rental period timeline */}
            <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 1.5, gap: 1 }}>
              {/* Start */}
              <Box>
                <Typography sx={labelSx}>Start Date</Typography>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: rental.rental_start_date ? 'text.primary' : 'text.disabled' }}>
                  {fmtDate(rental.rental_start_date)}
                </Typography>
              </Box>

              {/* Arrow + days badge */}
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, mx: 1 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                {rental.days_on_policy != null && (
                  <Box sx={{ px: 1.25, py: 0.25, bgcolor: 'action.hover', borderRadius: 10, border: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary' }}>
                      {rental.days_on_policy} days
                    </Typography>
                  </Box>
                )}
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Box>

              {/* Due */}
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={labelSx}>Due Date</Typography>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: rental.rental_due_date ? 'text.primary' : 'text.disabled' }}>
                  {fmtDate(rental.rental_due_date)}
                </Typography>
              </Box>
            </Box>

            {/* Row 3: Reservation # · Contract # — only if either exists */}
            {(rental.reservation_number || rental.contract_number) && (
              <Box sx={{ display: 'flex' }}>
                <Box sx={{ flex: 1, px: 2, py: 1.25 }}>
                  <Typography sx={labelSx}>Reservation #</Typography>
                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: rental.reservation_number ? 'text.primary' : 'text.disabled' }}>
                    {rental.reservation_number ?? '—'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={labelSx}>Contract #</Typography>
                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: rental.contract_number ? 'text.primary' : 'text.disabled' }}>
                    {rental.contract_number ?? '—'}
                  </Typography>
                </Box>
              </Box>
            )}
            {/* Notes row — inside card */}
            {rental.notes && (
              <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography sx={labelSx}>Notes</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{rental.notes}</Typography>
              </Box>
            )}

          </Box>
        </Box>
      ) : (
        <Typography variant="body2" color="text.disabled">No rental record. Add rental details when a rental car is approved.</Typography>
      )}

      <Dialog
        open={editing}
        onClose={() => { if (!isPending) { setEditing(false); setApiError(null) } }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>{rental ? 'Edit Rental' : 'Add Rental'}</DialogTitle>
        {dialogForm && (
          <>
            <DialogContent dividers sx={{ pt: 2 }}>
              {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}
              <Grid container spacing={2}>

                {/* Company */}
                <Grid item xs={12}>
                  <CompanySelect
                    value={dialogForm.rental_company}
                    onChange={(name) => setField('rental_company', name || undefined)}
                  />
                </Grid>

                {/* Daily Rate */}
                <Grid item xs={12}>
                  <TextField label="Daily Rate ($)" size="small" fullWidth type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={dialogForm.approved_daily_amount != null ? (dialogForm.approved_daily_amount / 100).toFixed(0) : ''}
                    onChange={(e) => setField('approved_daily_amount', e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)} />
                </Grid>

                {/* Date triangle — Start Date · Days on Policy · Due Date */}
                <Grid item xs={4}>
                  <DatePicker
                    label="Start Date"
                    value={dialogForm.rental_start_date ? new Date(dialogForm.rental_start_date + 'T12:00:00') : null}
                    onChange={(value) => {
                      if (value && isValidDate(value)) setField('rental_start_date', formatDateOnly(value, 'yyyy-MM-dd'))
                      else setField('rental_start_date', undefined)
                    }}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField label="Days on Policy" size="small" fullWidth type="number"
                    inputProps={{ min: 1, step: 1 }}
                    value={dialogForm.days_on_policy ?? ''}
                    helperText={dateMode === 'due' && dialogForm.days_on_policy ? 'Computed from due date' : undefined}
                    onChange={(e) => setField('days_on_policy', e.target.value ? parseInt(e.target.value) : undefined)} />
                </Grid>
                <Grid item xs={4}>
                  <DatePicker
                    label="Due Date"
                    value={dialogForm.rental_due_date ? new Date(dialogForm.rental_due_date + 'T12:00:00') : null}
                    onChange={(value) => {
                      if (value && isValidDate(value)) setField('rental_due_date', formatDateOnly(value, 'yyyy-MM-dd'))
                      else setField('rental_due_date', undefined)
                    }}
                    slotProps={{ textField: {
                      size: 'small', fullWidth: true,
                      helperText: dateMode === 'days' && dialogForm.days_on_policy
                        ? `${dialogForm.days_on_policy} days on policy`
                        : undefined,
                    }}}
                  />
                </Grid>

                {/* Reference numbers */}
                <Grid item xs={6}>
                  <TextField label="Reservation #" size="small" fullWidth
                    value={dialogForm.reservation_number ?? ''}
                    onChange={(e) => setField('reservation_number', e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Contract #" size="small" fullWidth
                    value={dialogForm.contract_number ?? ''}
                    onChange={(e) => setField('contract_number', e.target.value)} />
                </Grid>

                {/* Notes */}
                <Grid item xs={12}>
                  <TextField label="Notes" size="small" fullWidth multiline rows={2}
                    value={dialogForm.notes ?? ''}
                    onChange={(e) => setField('notes', e.target.value)} />
                </Grid>

              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setEditing(false)} disabled={isPending}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isPending}
                startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
              >
                Save Rental
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
