import { useMutation } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import type { Customer } from '@/types/customer'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { Trash2 } from 'lucide-react'

interface Props {
  customer: Customer
  onClose: () => void
  onDeleted: () => void
}

export default function CustomerDeleteDialog({ customer, onClose, onDeleted }: Props) {
  const mutation = useMutation({
    mutationFn: () => customersApi.delete(customer.id),
    onSuccess: () => onDeleted(),
  })

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={!mutation.isPending ? onClose : undefined}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: 'error.main', borderRadius: 2, display: 'flex', color: '#fff' }}>
            <Trash2 size={18} />
          </Box>
          <Typography fontWeight={800} fontSize="1rem">Delete Customer</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {mutation.error ? (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {(mutation.error as { message?: string })?.message ?? 'Failed to delete customer. They may have active repair orders.'}
          </Alert>
        ) : null}

        <Typography sx={{ fontSize: '0.95rem', mb: 1 }}>
          Are you sure you want to delete{' '}
          <strong>{customer.first_name} {customer.last_name}</strong>?
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
          This action cannot be undone. The customer will be removed from your shop.
          {customer.active_ro_count > 0 && (
            <Box component="span" sx={{ display: 'block', mt: 1, color: 'error.main', fontWeight: 600 }}>
              ⚠ This customer has {customer.active_ro_count} active repair order{customer.active_ro_count !== 1 ? 's' : ''}. You must close them before deleting.
            </Box>
          )}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={mutation.isPending} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || customer.active_ro_count > 0}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={15} />}
          sx={{ borderRadius: 2 }}
        >
          {mutation.isPending ? 'Deleting…' : 'Delete Customer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
