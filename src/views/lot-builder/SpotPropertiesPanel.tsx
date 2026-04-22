import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Tooltip from '@mui/material/Tooltip'
import { X } from 'lucide-react'
import type { CanvasSpot, ZoneCanvasState } from '@/stores/builderStore'
import type { SpotType } from '@/api/lot'

interface SpotPropertiesPanelProps {
  spot: CanvasSpot
  zone?: ZoneCanvasState
  onUpdate: (updates: Partial<CanvasSpot>) => void
  onClose: () => void
}

const SPOT_TYPE_LABELS: Record<SpotType, string> = {
  standard:   'Standard',
  accessible: 'Accessible (HC)',
  oversized:  'Oversized',
  reserved:   'Reserved',
}

const SPOT_TYPE_COLORS: Record<SpotType, string> = {
  standard:   '#6B7280',
  accessible: '#2563EB',
  oversized:  '#F59E0B',
  reserved:   '#EF4444',
}

export default function SpotPropertiesPanel({
  spot,
  zone,
  onUpdate,
  onClose,
}: SpotPropertiesPanelProps) {
  const color = zone?.color_hex ?? '#3B82F6'

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {spot.label}
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
            <X size={14} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider />

      {/* Label */}
      <TextField
        label="Spot label"
        size="small"
        fullWidth
        value={spot.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
      />

      {/* Type */}
      <FormControl size="small" fullWidth>
        <InputLabel>Spot type</InputLabel>
        <Select
          label="Spot type"
          value={spot.spot_type}
          onChange={(e) => onUpdate({ spot_type: e.target.value as SpotType })}
        >
          {(Object.entries(SPOT_TYPE_LABELS) as [SpotType, string][]).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '1px', bgcolor: SPOT_TYPE_COLORS[k], flexShrink: 0 }} />
                {v}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider />

      {/* Position (read-only info) */}
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
          POSITION
        </Typography>
        <Typography variant="caption" color="text.disabled" fontFamily="monospace">
          x: {spot.canvas_x}, y: {spot.canvas_y}
        </Typography>
      </Box>

      <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
        Drag to reposition · Delete key to remove
      </Typography>
    </Box>
  )
}
