import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { shopsApi } from '@/api/shops'
import type { Shop } from '@/types/auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { Building2, MapPin, ChevronRight } from 'lucide-react'

function ShopLotCard({ shop }: { shop: Shop }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <CardActionArea component={Link} to={`/admin/shops/${shop.id}/lot-builder`}>
        <CardContent sx={{ p: '20px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Color swatch / icon */}
            <Box
              sx={{
                width: 48,
                height: 48,
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
              {shop.brand_color ? (
                <MapPin size={20} style={{ color: '#fff', opacity: 0.9 }} />
              ) : (
                <Building2 size={20} style={{ opacity: 0.35 }} />
              )}
            </Box>

            {/* Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body1" fontWeight={700} noWrap>
                {shop.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {shop.address || 'No address on file'}
              </Typography>
              {(shop.canvas_cols || shop.canvas_rows) && (
                <Typography variant="caption" color="text.disabled" display="block">
                  Grid: {shop.canvas_cols ?? '?'} × {shop.canvas_rows ?? '?'}
                </Typography>
              )}
            </Box>

            {/* CTA */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Typography variant="caption" color="primary.main" fontWeight={600}>
                Open builder
              </Typography>
              <ChevronRight size={16} style={{ opacity: 0.5 }} />
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export default function AdminLotBuilderPickerPage() {
  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn:  () => shopsApi.list(),
    staleTime: 30_000,
  })

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Configuration
        </Typography>
        <Typography variant="h5" fontWeight={900} mt={0.5}>
          Lot Builder
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Select a shop to configure its lot layout.
        </Typography>
      </Box>

      {/* Shop list */}
      {isLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 6 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading shops…</Typography>
        </Box>
      ) : shops.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Building2 size={32} style={{ opacity: 0.2 }} />
            <Typography variant="body2" color="text.disabled" mt={1} mb={2}>
              No shops found. Add a shop first.
            </Typography>
            <Button component={Link} to="/admin/shops" variant="outlined" size="small">
              Go to Shops
            </Button>
          </Box>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 640 }}>
          {shops.map((shop) => (
            <ShopLotCard key={shop.id} shop={shop} />
          ))}
        </Box>
      )}
    </Box>
  )
}
