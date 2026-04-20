import { useState, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shopsApi } from '@/api/shops'
import { lotApi } from '@/api/lot'
import type { LotLayout } from '@/api/lot'
import type { Shop } from '@/types/auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import { ArrowLeft, Plus, MapPin, LayoutDashboard, CheckCircle2 } from 'lucide-react'

function CreateLotDialog({
  open,
  onClose,
  onCreate,
  creating,
}: {
  open: boolean
  onClose: () => void
  onCreate: (label: string) => void
  creating: boolean
}) {
  const [label, setLabel] = useState('')

  const handleClose = () => {
    setLabel('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Lot</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <TextField
          label="Lot name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          fullWidth
          size="small"
          placeholder="e.g. Main Lot, North Parking, Summer 2025"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={creating}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onCreate(label)}
          disabled={creating || !label.trim()}
        >
          {creating ? 'Creating…' : 'Create lot'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function AdminShopLotsView() {
  const { shopId: shopIdParam } = useParams<{ shopId: string }>()
  const shopId = Number(shopIdParam)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const { data: shops = [], isLoading: shopsLoading } = useQuery<Shop[]>({
    queryKey: ['shops'],
    queryFn: () => shopsApi.list(),
    staleTime: 30_000,
  })

  const shop = useMemo(() => shops.find((s) => s.id === shopId), [shops, shopId])

  const { data: layouts = [], isLoading: layoutsLoading } = useQuery<LotLayout[]>({
    queryKey: ['lot-layouts', shopId],
    queryFn: () => lotApi.listLayouts(shopId),
    enabled: !!shopId && !Number.isNaN(shopId),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (label: string) => lotApi.createLayout({ shop_id: shopId, label }),
    onSuccess: (layout) => {
      qc.invalidateQueries({ queryKey: ['lot-layouts', shopId] })
      setCreateOpen(false)
      setCreateError(null)
      navigate(`/admin/shops/${shopId}/lots/${layout.id}`)
    },
    onError: (err: any) => setCreateError(err?.message ?? 'Failed to create lot'),
  })

  const publishMutation = useMutation({
    mutationFn: (layoutId: number) => lotApi.publishLayout(layoutId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lot-layouts', shopId] }),
  })

  if (!shopId || Number.isNaN(shopId)) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Invalid shop.</Typography>
        <Button component={Link} to="/admin/shops" sx={{ mt: 2 }}>Back to shops</Button>
      </Box>
    )
  }

  const isLoading = shopsLoading || layoutsLoading

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Button
            component={Link}
            to="/admin/shops"
            startIcon={<ArrowLeft size={16} />}
            size="small"
            sx={{ mb: 1, ml: -1 }}
          >
            Back to shops
          </Button>
          <Typography variant="overline" color="text.secondary" display="block">
            Lots
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {shopsLoading ? '…' : (shop?.name ?? 'Shop not found')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={16} />}
          onClick={() => { setCreateError(null); setCreateOpen(true) }}
          sx={{ borderRadius: 2, fontWeight: 700, mt: 4 }}
        >
          Add lot
        </Button>
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 4 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading lots…</Typography>
        </Box>
      ) : layouts.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <LayoutDashboard size={32} style={{ opacity: 0.3 }} />
            <Typography variant="body2" color="text.disabled" mt={1}>
              No lots yet. Add one to start mapping this shop's parking.
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => { setCreateError(null); setCreateOpen(true) }}
              sx={{ mt: 2, borderRadius: 2 }}
            >
              Add lot
            </Button>
          </Box>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {layouts.map((layout) => (
            <Card key={layout.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    flexShrink: 0,
                    bgcolor: layout.is_active ? 'success.main' : 'action.selected',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LayoutDashboard size={18} color={layout.is_active ? '#fff' : undefined} style={{ opacity: layout.is_active ? 1 : 0.4 }} />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight={700} noWrap>
                      {layout.label}
                    </Typography>
                    {layout.is_active && (
                      <Chip
                        label="Active"
                        size="small"
                        color="success"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Lot #{layout.id}
                    {layout.canvas_width && layout.canvas_height
                      ? ` · ${layout.canvas_width}×${layout.canvas_height}`
                      : ''}
                  </Typography>
                </Box>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CheckCircle2 size={14} />}
                  onClick={() => publishMutation.mutate(layout.id)}
                  disabled={publishMutation.isPending}
                  color={layout.is_active ? 'error' : 'primary'}
                  sx={{ borderRadius: 2 }}
                >
                  {layout.is_active ? 'Deactivate' : 'Set active'}
                </Button>

                <Button
                  component={Link}
                  to={`/admin/shops/${shopId}/lots/${layout.id}`}
                  size="small"
                  variant={layout.is_active ? 'contained' : 'outlined'}
                  startIcon={<MapPin size={14} />}
                  sx={{ borderRadius: 2 }}
                >
                  Open builder
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <CreateLotDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(label) => createMutation.mutate(label)}
        creating={createMutation.isPending}
      />
      {createError && (
        <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>
      )}
    </Box>
  )
}
