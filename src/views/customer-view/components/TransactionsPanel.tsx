import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { repairOrdersApi } from '@/api/repairOrders'
import { useAuth } from '@/hooks/useAuth'
import type {
  CreatePaymentInput,
  Payment,
  TransactionType,
  PaymentStatus,
} from '@/types/repairOrder'
import { TRANSACTION_TYPES, PAYMENT_STATUSES } from '@/lib/transactionConstants'
import { formatCurrency, formatDate } from '@/lib/utils'
import TransactionDetailsModal from '@/components/TransactionDetailsModal'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { Plus, Trash2, DollarSign, X, Edit } from 'lucide-react'

interface Props { roId: number }


type FormState = {
  repair_order_id: number
  amount: number
  insurance_total: number
  transaction_type: TransactionType | ''
  payment_status: PaymentStatus | ''
  date_added: string
  received_by: string
  notes: string
}

function emptyForm(roId: number): FormState {
  return {
    repair_order_id: roId,
    amount: 0,
    insurance_total: 0,
    transaction_type: '',
    payment_status: '',
    date_added: new Date().toISOString().slice(0, 10),
    received_by: '',
    notes: '',
  }
}

export default function TransactionsPanel({ roId }: Props) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm(roId))
  const [dollarAmount, setDollarAmount] = useState('')
  const [insuranceTotalAmount, setInsuranceTotalAmount] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null)
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null)

  function resetForm() {
    setForm(emptyForm(roId))
    setDollarAmount('')
    setInsuranceTotalAmount('')
    setEditingPayment(null)
    setApiError(null)
  }

  function closeForm() {
    setFormOpen(false)
    resetForm()
  }

  function openCreateForm() {
    resetForm()
    setFormOpen(true)
  }

  function openEditForm(payment: Payment) {
    setEditingPayment(payment)
    const insTotal = payment.insurance_total ?? 0
    setForm({
      repair_order_id : payment.repair_order_id,
      amount          : payment.amount,
      insurance_total : insTotal,
      transaction_type: payment.transaction_type ?? '',
      payment_status  : payment.payment_status ?? '',
      date_added      : (payment.date_added ?? payment.created_at)?.slice(0, 10),
      received_by     : payment.received_by ? String(payment.received_by) : '',
      notes           : payment.notes ?? '',
    })
    setDollarAmount((payment.amount / 100).toFixed(2))
    setInsuranceTotalAmount(insTotal > 0 ? (insTotal / 100).toFixed(2) : '')
    setApiError(null)
    setFormOpen(true)
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['payments', roId] })
    qc.invalidateQueries({ queryKey: ['repair_order_detail', roId] })
    qc.invalidateQueries({ queryKey: ['transactions_all'] })
    qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
  }

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', roId],
    queryFn: () => repairOrdersApi.listPayments(roId),
  })

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff_list', shop?.id],
    queryFn: () => repairOrdersApi.staffList(shop?.id),
    enabled: !!shop?.id,
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: repairOrdersApi.createPayment,
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      resetForm()
    },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to record payment'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreatePaymentInput }) =>
      repairOrdersApi.updatePayment(id, data),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      resetForm()
    },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to update payment'),
  })

  const deleteMut = useMutation({
    mutationFn: repairOrdersApi.deletePayment,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to delete payment'),
  })

  const saving = createMut.isPending || updateMut.isPending

  function handleAmountChange(val: string) {
    setDollarAmount(val)
    const parsed = parseFloat(val)
    setForm(prev => ({ ...prev, amount: isNaN(parsed) ? 0 : Math.round(parsed * 100) }))
  }

  function handleInsuranceTotalChange(val: string) {
    setInsuranceTotalAmount(val)
    const parsed = parseFloat(val)
    setForm(prev => ({ ...prev, insurance_total: isNaN(parsed) ? 0 : Math.round(parsed * 100) }))
  }

  function handleSave() {
    if (!form.amount || form.amount <= 0) { setApiError('Please enter a valid amount.'); return }
    if (!form.transaction_type)           { setApiError('Please select a transaction type.'); return }
    if (!form.payment_status)             { setApiError('Please select a payment status.'); return }
    setApiError(null)
    const payload: CreatePaymentInput = {
      repair_order_id:  form.repair_order_id,
      amount:           form.amount,
      transaction_type: form.transaction_type || undefined,
      payment_status:   form.payment_status || undefined,
      date_added:       form.date_added || undefined,
      received_by:      form.received_by ? Number(form.received_by) : null,
      notes:            form.notes.trim() || undefined,
      ...(form.transaction_type === 'deductible' && form.insurance_total > 0
        ? { insurance_total: form.insurance_total }
        : {}),
    }
    if (editingPayment) {
      updateMut.mutate({ id: editingPayment.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const total = (payments as Payment[]).reduce((sum, p) => sum + p.amount, 0)
  const totalOutstanding = (payments as Payment[]).filter(p => p.payment_status === 'not_paid').reduce((sum, p) => sum + p.amount, 0)
  const isEditing = Boolean(editingPayment)
  const deleteOpen = Boolean(deleteTarget)
  const deleteStatus = deleteTarget ? PAYMENT_STATUSES.find(s => s.value === deleteTarget.payment_status) : null
  const deleteType = deleteTarget ? TRANSACTION_TYPES.find(t => t.value === deleteTarget.transaction_type) : null
  const deleteDate = deleteTarget ? (deleteTarget.date_added ? formatDate(deleteTarget.date_added) : formatDate(deleteTarget.created_at)) : null

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
            Payments / Transactions
          </Typography>
          {(payments as Payment[]).length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.25 }}>
              <Typography variant="caption" color="text.secondary">
                Total billed: {formatCurrency(total)}
              </Typography>
              {totalOutstanding > 0 && (
                <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
                  Outstanding: {formatCurrency(totalOutstanding)}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        <Button
          size="small"
          startIcon={<Plus size={14} />}
          onClick={openCreateForm}
        >
          Record Transaction
        </Button>
      </Box>

      {/* Payment modal */}
      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ p: 0.875, bgcolor: 'success.main', borderRadius: 1.5, display: 'flex', color: '#fff' }}>
              <DollarSign size={16} />
            </Box>
            <Box>
              <Typography component="div" variant="subtitle2" fontWeight={700}>
                {isEditing ? 'Edit Payment' : 'Record Transaction'}
              </Typography>
              <Typography component="div" variant="caption" color="text.secondary">
                {isEditing ? 'Update the transaction details for this repair order.' : 'Add a transaction to this repair order.'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={closeForm}>
            <X size={16} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {apiError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError(null)}>
              {apiError}
            </Alert>
          )}
          <Grid container spacing={2}>
            {/* Transaction Type */}
            <Grid item xs={12} sm={6}>
              <TextField
                select label="Transaction Type *" size="small" fullWidth
                value={form.transaction_type}
                onChange={(e) => setForm(prev => ({ ...prev, transaction_type: e.target.value as TransactionType }))}
              >
                {TRANSACTION_TYPES.map(({ value, label }) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Amount */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Amount *" size="small" fullWidth type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={dollarAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DollarSign size={14} style={{ opacity: 0.5 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Insurance DED — only for deductible transactions */}
            {form.transaction_type === 'deductible' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Insurance DED" size="small" fullWidth type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  value={insuranceTotalAmount}
                  onChange={(e) => handleInsuranceTotalChange(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <DollarSign size={14} style={{ opacity: 0.5 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}

            {/* Employee selector — only for employee transactions */}
            {form.transaction_type === 'employee' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  select label="Employee *" size="small" fullWidth
                  value={form.received_by}
                  onChange={(e) => setForm(prev => ({ ...prev, received_by: e.target.value }))}
                >
                  <MenuItem value=""><em>Select employee…</em></MenuItem>
                  {staffList.map(s => (
                    <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}

            {/* Payment Status */}
            <Grid item xs={12} sm={6}>
              <TextField
                select label="Payment Status *" size="small" fullWidth
                value={form.payment_status}
                onChange={(e) => setForm(prev => ({ ...prev, payment_status: e.target.value as PaymentStatus }))}
                SelectProps={{
                  renderValue: (val): ReactNode => {
                    const value = val as PaymentStatus | ''
                    const s = PAYMENT_STATUSES.find(p => p.value === value)
                    return s ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                        {s.label}
                      </Box>
                    ) : value || 'Select...'
                  },
                }}
              >
                {PAYMENT_STATUSES.map(({ value, label, color }) => (
                  <MenuItem key={value} value={value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                      {label}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Date Added */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date Added *" size="small" fullWidth type="date"
                value={form.date_added}
                onChange={(e) => setForm(prev => ({ ...prev, date_added: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                label="Notes" size="small" fullWidth multiline minRows={3}
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="text" onClick={closeForm} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained" color="success"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <DollarSign size={14} />}
          >
            {isEditing ? (saving ? 'Saving...' : 'Save Changes') : (saving ? 'Saving...' : 'Save Payment')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment list */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (payments as Payment[]).length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No payments recorded yet. Use "Record Transaction" to log a transaction.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {(payments as Payment[]).map((payment) => {
            const txType    = TRANSACTION_TYPES.find(t => t.value === payment.transaction_type)
            const status    = PAYMENT_STATUSES.find(s => s.value === payment.payment_status)
            const dateLabel = payment.date_added ? formatDate(payment.date_added) : formatDate(payment.created_at)
            const employee  = payment.received_by_user
              ? `${payment.received_by_user.first_name} ${payment.received_by_user.last_name}`.trim()
              : null

            return (
              <Paper
                key={payment.id}
                variant="outlined"
                onClick={() => setDetailPayment(payment)}
                sx={{
                  borderRadius: 2, cursor: 'pointer', overflow: 'hidden',
                  borderColor: txType ? `${txType.color}44` : 'divider',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  '&:hover': { borderColor: txType ? txType.color : 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                {/* Top accent bar */}
                {txType && (
                  <Box sx={{ height: 3, bgcolor: txType.color, opacity: 0.7 }} />
                )}

                <Box sx={{ p: 1.5 }}>
                  {/* Row 1: amount + type + status + actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
                      <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                        {formatCurrency(payment.amount)}
                      </Typography>
                      {txType && (
                        <Box component="span" sx={{
                          px: 1.1, py: 0.15, borderRadius: 5,
                          fontSize: '0.7rem', fontWeight: 700,
                          bgcolor: `${txType.color}22`, color: txType.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {txType.label}
                        </Box>
                      )}
                      {status && (
                        <Box component="span" sx={{
                          px: 1.1, py: 0.15, borderRadius: 5,
                          fontSize: '0.7rem', fontWeight: 700,
                          bgcolor: `${status.color}18`, color: status.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {status.label}
                        </Box>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditForm(payment)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                          <Edit size={14} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(payment)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                          <Trash2 size={14} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>

                  {/* Row 2: meta pills */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{dateLabel}</Typography>
                    {payment.transaction_type === 'deductible' && (
                      <>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          Ins. DED:{' '}
                          <Box component="span" sx={{ fontWeight: 700, color: payment.insurance_total ? 'text.primary' : 'text.disabled' }}>
                            {payment.insurance_total ? formatCurrency(payment.insurance_total) : '—'}
                          </Box>
                        </Typography>
                      </>
                    )}
                    {payment.transaction_type === 'employee' && employee && (
                      <>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {employee}
                        </Typography>
                      </>
                    )}
                    {(payment.total_events ?? 0) > 0 && (
                      <>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {payment.total_events} note{payment.total_events !== 1 ? 's' : ''}
                        </Typography>
                      </>
                    )}
                  </Box>

                  {/* Notes */}
                  {payment.notes && (
                    <Box sx={{ mt: 1, px: 1.25, py: 0.75, borderRadius: 1.5, bgcolor: 'action.hover', borderLeft: '3px solid', borderLeftColor: txType ? txType.color : 'divider' }}>
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontStyle: 'italic' }}>
                        {payment.notes}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            )
          })}
        </Stack>
      )}

      <TransactionDetailsModal
        payment={detailPayment}
        onClose={() => setDetailPayment(null)}
      />

      <Dialog
        open={deleteOpen}
        onClose={() => { if (!deleteMut.isPending) setDeleteTarget(null) }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography component="div" variant="subtitle2" fontWeight={700}>Delete payment?</Typography>
          <IconButton size="small" onClick={() => { if (!deleteMut.isPending) setDeleteTarget(null) }}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This transaction will be permanently removed from the repair order.
          </Typography>
          {deleteTarget && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>
                {formatCurrency(deleteTarget.amount)}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                {deleteStatus && (
                  <Chip size="small" label={deleteStatus.label} sx={{ bgcolor: `${deleteStatus.color}22`, color: deleteStatus.color, fontWeight: 600, height: 22 }} />
                )}
                {deleteType && (
                  <Chip size="small" variant="outlined" label={deleteType.label} sx={{ fontSize: '0.7rem', height: 22 }} />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Recorded {deleteDate}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="text" onClick={() => setDeleteTarget(null)} disabled={deleteMut.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            disabled={!deleteTarget || deleteMut.isPending}
            startIcon={deleteMut.isPending ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={14} />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
