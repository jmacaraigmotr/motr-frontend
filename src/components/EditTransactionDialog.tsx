import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { repairOrdersApi } from '@/api/repairOrders'
import type { Payment, TransactionType, PaymentStatus } from '@/types/repairOrder'
import { TRANSACTION_TYPES, PAYMENT_STATUSES } from '@/lib/transactionConstants'
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
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import { X, DollarSign, Pencil } from 'lucide-react'

const fieldSx = {
  '& .MuiInputBase-input': { fontSize: '0.9rem' },
  '& .MuiInputLabel-root': { fontSize: '0.9rem' },
}

interface Props {
  payment: Payment | null
  onClose: () => void
  onSaved: () => void
}

export default function EditTransactionDialog({ payment, onClose, onSaved }: Props) {
  const qc = useQueryClient()

  const [transactionType, setTransactionType] = useState<TransactionType | ''>('')
  const [amountDollars,   setAmountDollars]   = useState('')
  const [paymentStatus,   setPaymentStatus]   = useState<PaymentStatus | ''>('')
  const [dateAdded,       setDateAdded]       = useState('')
  const [notes,           setNotes]           = useState('')
  const [apiError,        setApiError]        = useState<string | null>(null)

  // Pre-fill form whenever the payment changes
  useEffect(() => {
    if (!payment) return
    setTransactionType((payment.transaction_type as TransactionType) ?? '')
    setAmountDollars(payment.amount != null ? (payment.amount / 100).toFixed(2) : '')
    setPaymentStatus((payment.payment_status as PaymentStatus) ?? '')
    const rawDate = payment.date_added ?? payment.created_at
    setDateAdded(rawDate ? rawDate.slice(0, 10) : '')
    setNotes((payment as Record<string, unknown>).notes as string ?? '')
    setApiError(null)
  }, [payment?.id])

  const mutation = useMutation({
    mutationFn: () => repairOrdersApi.updatePayment(payment!.id, {
      repair_order_id:  payment!.repair_order_id,
      amount:           Math.round(parseFloat(amountDollars) * 100),
      transaction_type: transactionType || undefined,
      payment_status:   paymentStatus   || undefined,
      date_added:       dateAdded       || undefined,
      notes:            notes           || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', payment?.repair_order_id] })
      qc.invalidateQueries({ queryKey: ['transactions_all'] })
      qc.invalidateQueries({ queryKey: ['customer_transactions'] })
      qc.invalidateQueries({ queryKey: ['repair_order_activity', payment?.repair_order_id] })
      onSaved()
    },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to update transaction'),
  })

  function handleSave() {
    setApiError(null)
    if (!transactionType) { setApiError('Please select a transaction type.'); return }
    if (!amountDollars || isNaN(parseFloat(amountDollars)) || parseFloat(amountDollars) <= 0) {
      setApiError('Please enter a valid amount.'); return
    }
    if (!paymentStatus) { setApiError('Please select a payment status.'); return }
    mutation.mutate()
  }

  if (!payment) return null

  return (
    <Dialog
      open={Boolean(payment)}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3 } }}
      sx={{ zIndex: 1600 }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 0.875, bgcolor: 'primary.main', borderRadius: 1.5, display: 'flex', color: '#fff' }}>
            <Pencil size={17} />
          </Box>
          <Box>
            <Typography fontWeight={800} fontSize="1.05rem">Edit Transaction</Typography>
            <Typography fontSize="0.82rem" color="text.secondary">Transaction #{payment.id}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={fieldSx}>
              <InputLabel>Transaction Type *</InputLabel>
              <Select
                label="Transaction Type *"
                value={transactionType}
                onChange={e => setTransactionType(e.target.value as TransactionType)}
                MenuProps={{ sx: { zIndex: 1700 } }}
              >
                {TRANSACTION_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Amount *"
              fullWidth
              type="number"
              sx={fieldSx}
              value={amountDollars}
              onChange={e => setAmountDollars(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DollarSign size={15} style={{ opacity: 0.5 }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={fieldSx}>
              <InputLabel>Payment Status *</InputLabel>
              <Select
                label="Payment Status *"
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
                MenuProps={{ sx: { zIndex: 1700 } }}
                renderValue={(val) => {
                  const s = PAYMENT_STATUSES.find(p => p.value === val)
                  return s ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                      {s.label}
                    </Box>
                  ) : val
                }}
              >
                {PAYMENT_STATUSES.map(s => (
                  <MenuItem key={s.value} value={s.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                      {s.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Date *"
              fullWidth
              type="date"
              sx={fieldSx}
              value={dateAdded}
              onChange={e => setDateAdded(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={2}
              sx={fieldSx}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={mutation.isPending} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={15} color="inherit" /> : <Pencil size={15} />}
          sx={{ borderRadius: 2, minWidth: 160 }}
        >
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
