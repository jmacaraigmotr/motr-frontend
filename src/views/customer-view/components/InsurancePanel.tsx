import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insuranceApi } from '@/api/insurance'
import type { CreateInsuranceInput, UpdateInsuranceInput } from '@/api/insurance'
import type { ROInsurance } from '@/types/repairOrder'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import { Edit, Trash2, X } from 'lucide-react'
import InsuranceForm from './InsuranceForm'

interface Props { roId: number }

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value}</Typography>
    </Box>
  )
}

function buildFormState(existing: ROInsurance | null | undefined, roId: number): CreateInsuranceInput {
  if (!existing) {
    return {
      repair_order_id: roId,
      has_first_party : false,
      has_third_party : false,
    }
  }

  return {
    repair_order_id        : roId,
    has_first_party        : existing.has_first_party ?? false,
    has_third_party        : existing.has_third_party ?? false,
    first_party_company    : existing.first_party_company ?? undefined,
    first_party_claim_number: existing.first_party_claim_number ?? undefined,
    first_party_rep_name   : existing.first_party_rep_name ?? undefined,
    first_party_rep_phone  : existing.first_party_rep_phone ?? undefined,
    third_party_company    : existing.third_party_company ?? undefined,
    third_party_claim_number: existing.third_party_claim_number ?? undefined,
    third_party_rep_name   : existing.third_party_rep_name ?? undefined,
    third_party_rep_phone  : existing.third_party_rep_phone ?? undefined,
    liability_percentage   : normalizeLiabilityValue(existing.liability_percentage),
    pd_limit               : existing.pd_limit ?? undefined,
    notes                  : existing.notes ?? undefined,
  }
}

function normalizeLiabilityValue(value?: string | null) {
  if (!value) return undefined
  const stripped = value.replace(/%/g, '').trim()
  return stripped || undefined
}

function formatLiability(value?: string | null) {
  if (!value) return null
  const stripped = value.replace(/%/g, '').trim()
  return stripped ? `${stripped}%` : value
}

export default function InsurancePanel({ roId }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<CreateInsuranceInput | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const { data: ins, isLoading } = useQuery({
    queryKey: ['insurance', roId],
    queryFn: () => insuranceApi.getByRO(roId),
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['insurance', roId] })
    qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
  }

  const createMut = useMutation({
    mutationFn: insuranceApi.create,
    onSuccess: () => { invalidateAll(); setEditing(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateInsuranceInput }) => insuranceApi.update(id, data),
    onSuccess: () => { invalidateAll(); setEditing(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => insuranceApi.delete(id),
    onSuccess: () => { invalidateAll(); setConfirmDelete(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to delete'),
  })

  function startEdit() {
    setConfirmDelete(false)
    setApiError(null)
    setForm(buildFormState(ins, roId))
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setApiError(null)
    setForm(null)
  }

  function updateForm(updates: Partial<CreateInsuranceInput>) {
    setForm((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  function handleSave() {
    if (!form) return
    if (ins) {
      const { repair_order_id: _omit, ...payload } = form
      updateMut.mutate({ id: ins.id, data: payload as UpdateInsuranceInput })
    } else {
      createMut.mutate(form)
    }
  }

  const isPending = createMut.isPending || updateMut.isPending || deleteMut.isPending
  const f = form as CreateInsuranceInput

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>

  const liabilityLabel = formatLiability(ins?.liability_percentage)

  return (
    <>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">Insurance</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {ins && (
              <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            <Button size="small" startIcon={<Edit size={14} />} onClick={startEdit}>
              {ins ? 'Edit' : 'Add Insurance'}
            </Button>
          </Box>
        </Box>
        <Dialog open={confirmDelete} onClose={() => !isPending && setConfirmDelete(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ p: 0.75, bgcolor: 'error.light', borderRadius: 1.5, display: 'flex', color: 'error.main' }}>
                <Trash2 size={16} />
              </Box>
              Delete Insurance Record?
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will permanently delete the insurance record. This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button fullWidth variant="outlined" onClick={() => setConfirmDelete(false)} disabled={isPending}>Cancel</Button>
            <Button
              fullWidth variant="contained" color="error"
              onClick={() => ins && deleteMut.mutate(ins.id)}
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={12} color="inherit" /> : <Trash2 size={14} />}
            >
              Yes, Delete
            </Button>
          </DialogActions>
        </Dialog>
        {ins ? (
          <Box>
            {ins.has_first_party && (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>1st Party</Typography>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ flex: 1, px: 2, py: 1.25 }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Company</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.first_party_company ? 'text.primary' : 'text.disabled' }}>{ins.first_party_company ?? '—'}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Claim #</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.first_party_claim_number ? 'text.primary' : 'text.disabled' }}>{ins.first_party_claim_number ?? '—'}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex' }}>
                    <Box sx={{ flex: 1, px: 2, py: 1.25 }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Rep Name</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.first_party_rep_name ? 'text.primary' : 'text.disabled' }}>{ins.first_party_rep_name ?? '—'}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Rep Phone</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.first_party_rep_phone ? 'text.primary' : 'text.disabled' }}>{ins.first_party_rep_phone ?? '—'}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
            {ins.has_first_party && ins.has_third_party && <Divider sx={{ mb: 2 }} />}
            {ins.has_third_party && (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'secondary.main', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>3rd Party</Typography>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ flex: 1, px: 2, py: 1.25 }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Company</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.third_party_company ? 'text.primary' : 'text.disabled' }}>{ins.third_party_company ?? '—'}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Claim #</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.third_party_claim_number ? 'text.primary' : 'text.disabled' }}>{ins.third_party_claim_number ?? '—'}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex' }}>
                    <Box sx={{ flex: 1, px: 2, py: 1.25 }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Rep Name</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.third_party_rep_name ? 'text.primary' : 'text.disabled' }}>{ins.third_party_rep_name ?? '—'}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Rep Phone</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.third_party_rep_phone ? 'text.primary' : 'text.disabled' }}>{ins.third_party_rep_phone ?? '—'}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
            {(ins.pd_limit != null || liabilityLabel) && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: ins.notes ? 2 : 0 }}>
                <Box sx={{ display: 'flex' }}>
                  <Box sx={{ flex: 1, px: 2, py: 1.25 }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>PD Limit</Typography>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: ins.pd_limit != null ? 'text.primary' : 'text.disabled' }}>
                      {ins.pd_limit != null ? `$${(ins.pd_limit / 100).toFixed(2)}` : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Liability %</Typography>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: liabilityLabel ? 'text.primary' : 'text.disabled' }}>{liabilityLabel ?? '—'}</Typography>
                  </Box>
                </Box>
              </Box>
            )}
            {ins.notes && (
              <Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4 }}>Notes</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ins.notes}</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled">No insurance record. Add 1st or 3rd party claim details here.</Typography>
        )}
      </Box>

      <Dialog open={editing} onClose={closeEditor} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Typography component="div" variant="subtitle1" fontWeight={700}>
            {ins ? 'Edit Insurance' : 'Add Insurance'}
          </Typography>
          <IconButton size="small" onClick={closeEditor}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {f && (
            <InsuranceForm
              mode={ins ? 'edit' : 'create'}
              value={f}
              onChange={updateForm}
              onCancel={closeEditor}
              onSubmit={handleSave}
              isSubmitting={isPending}
              error={apiError}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
