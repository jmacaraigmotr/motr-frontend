import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shopsApi } from '@/api/shops'
import type { CreateShopInput, UpdateShopInput } from '@/api/shops'
import type { Shop } from '@/types/auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import { Plus, Pencil, Trash2, MapPin, Building2 } from 'lucide-react'

interface ShopFormValues {
  name: string
  address: string
  phone: string
  brand_color: string
}

const EMPTY_FORM: ShopFormValues = { name: '', address: '', phone: '', brand_color: '' }

function ShopDialog({
  open,
  shop,
  onClose,
  onSave,
  saving,
  error,
}: {
  open: boolean
  shop: Shop | null
  onClose: () => void
  onSave: (values: ShopFormValues) => void
  saving: boolean
  error: string | null
}) {
  const [values, setValues] = useState<ShopFormValues>(EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setValues(
        shop
          ? {
              name: shop.name,
              address: shop.address ?? '',
              phone: shop.phone ?? '',
              brand_color: shop.brand_color ?? '',
            }
          : EMPTY_FORM,
      )
    }
  }, [open, shop])

  const set = (field: keyof ShopFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{shop ? 'Edit Shop' : 'Add Shop'}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Shop name" value={values.name} onChange={set('name')} autoFocus required size="small" />
        <TextField label="Address" value={values.address} onChange={set('address')} size="small" />
        <TextField label="Phone" value={values.phone} onChange={set('phone')} size="small" />
        <TextField
          label="Brand color (hex)"
          value={values.brand_color}
          onChange={set('brand_color')}
          size="small"
          helperText="Sets sidebar accent for staff in this shop"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => onSave(values)}
          disabled={saving || !values.name.trim()}
        >
          {saving ? 'Saving…' : shop ? 'Save changes' : 'Create shop'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DeleteShopDialog({
  shop,
  onClose,
  onConfirm,
  deleting,
  error,
}: {
  shop: Shop | null
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
  error: string | null
}) {
  return (
    <Dialog open={!!shop} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Delete shop?</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2">
          Are you sure you want to delete <strong>{shop?.name}</strong>? This cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function AdminShopsView() {
  const qc = useQueryClient()
  const [formShop, setFormShop] = useState<Shop | null | 'new'>(null)
  const [deleteShop, setDeleteShop] = useState<Shop | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ['shops'],
    queryFn: () => shopsApi.list(),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateShopInput) => shopsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shops'] })
      setFormShop(null)
      setFormError(null)
    },
    onError: (err: any) => setFormError(err?.message ?? 'Failed to create shop'),
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateShopInput) => shopsApi.update(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shops'] })
      setFormShop(null)
      setFormError(null)
    },
    onError: (err: any) => setFormError(err?.message ?? 'Failed to update shop'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shopsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shops'] })
      setDeleteShop(null)
      setDeleteError(null)
    },
    onError: (err: any) => setDeleteError(err?.message ?? 'Failed to delete shop'),
  })

  const handleSave = (values: ShopFormValues) => {
    setFormError(null)
    const payload = {
      name: values.name.trim(),
      address: values.address.trim() || undefined,
      phone: values.phone.trim() || undefined,
      brand_color: /^#[0-9A-Fa-f]{6}$/.test(values.brand_color) ? values.brand_color : undefined,
    }
    if (formShop === 'new') {
      createMutation.mutate(payload)
    } else if (formShop) {
      updateMutation.mutate({ id: formShop.id, ...payload })
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Shops
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={16} />}
          onClick={() => {
            setFormError(null)
            setFormShop('new')
          }}
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          Add shop
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 4 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading shops…
          </Typography>
        </Box>
      ) : shops.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Building2 size={32} style={{ opacity: 0.3 }} />
            <Typography variant="body2" color="text.disabled" mt={1}>
              No shops yet. Add one to get started.
            </Typography>
          </Box>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {shops.map((shop) => (
            <Card key={shop.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    flexShrink: 0,
                    bgcolor: shop.brand_color ?? 'action.selected',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!shop.brand_color && <Building2 size={18} style={{ opacity: 0.4 }} />}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={700} noWrap>
                    {shop.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {[shop.address, shop.phone].filter(Boolean).join(' · ') || 'No address or phone'}
                  </Typography>
                </Box>

                <Button
                  component={Link}
                  to={`/admin/shops/${shop.id}/lots`}
                  size="small"
                  variant="outlined"
                  startIcon={<MapPin size={14} />}
                  sx={{ mr: 1 }}
                >
                  Manage lots
                </Button>

                {shop.brand_color && (
                  <Chip
                    label={shop.brand_color}
                    size="small"
                    sx={{ fontFamily: 'monospace', fontSize: '0.7rem', bgcolor: shop.brand_color, color: '#fff' }}
                  />
                )}

                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => {
                    setFormError(null)
                    setFormShop(shop)
                  }}>
                    <Pencil size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeleteError(null)
                      setDeleteShop(shop)
                    }}
                    sx={{ '&:hover': { color: 'error.main' } }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <ShopDialog
        open={formShop !== null}
        shop={formShop === 'new' ? null : formShop}
        onClose={() => setFormShop(null)}
        onSave={handleSave}
        saving={saving}
        error={formError}
      />

      <DeleteShopDialog
        shop={deleteShop}
        onClose={() => setDeleteShop(null)}
        onConfirm={() => deleteShop && deleteMutation.mutate(deleteShop.id)}
        deleting={deleteMutation.isPending}
        error={deleteError}
      />
    </Box>
  )
}
