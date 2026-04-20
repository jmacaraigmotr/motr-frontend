import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { shopsApi } from '@/api/shops'
import LotBuilderView from '@/views/lot-builder/LotBuilderView'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowLeft } from 'lucide-react'

export default function AdminLotBuilderPage() {
  const params = useParams<{ shopId: string; layoutId: string }>()
  const shopId = Number(params.shopId)
  const layoutId = params.layoutId ? Number(params.layoutId) : undefined

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => shopsApi.list(),
    staleTime: 30_000,
  })

  const shop = useMemo(() => shops.find((s) => s.id === shopId), [shops, shopId])

  if (!shopId || Number.isNaN(shopId)) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Invalid shop.</Typography>
        <Button component={Link} to="/admin/shops" sx={{ mt: 2 }}>
          Back to shops
        </Button>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading shop…
        </Typography>
      </Box>
    )
  }

  if (!shop) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Shop not found.</Typography>
        <Button component={Link} to="/admin/shops" sx={{ mt: 2 }}>
          Back to shops
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Button
          component={Link}
          to={`/admin/shops/${shopId}/lots`}
          startIcon={<ArrowLeft size={15} />}
          size="small"
          sx={{ flexShrink: 0 }}
        >
          Lots
        </Button>
        <Typography variant="subtitle1" fontWeight={700} noWrap>
          {shop.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Lot Builder
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LotBuilderView shopIdOverride={shop.id} layoutIdOverride={layoutId} />
      </Box>
    </Box>
  )
}
