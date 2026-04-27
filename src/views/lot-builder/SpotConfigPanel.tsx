import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import { X } from 'lucide-react'
import type { ZoneCanvasState } from '@/stores/builderStore'
import type { ZoneIconType } from '@/api/lot'

interface SpotConfigPanelProps {
  zone: ZoneCanvasState
  onUpdate: (updates: Partial<ZoneCanvasState>) => void
  onClose: () => void
}

const ICON_TYPE_LABELS: Record<string, string> = {
  outdoor: 'Outdoor',
  indoor: 'Indoor',
  booth: 'Booth',
  lift: 'Lift',
  primer: 'Primer',
  nose: 'Nose-In',
}

// Build spot label preview: A1, A2, B1, B2, ...
function buildSpotLabels(count: number, perRow: number): string[] {
  const labels: string[] = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const rowLetter = String.fromCharCode(65 + (row % 26))
    labels.push(`${rowLetter}${col + 1}`)
  }
  return labels
}

export default function SpotConfigPanel({ zone, onUpdate, onClose }: SpotConfigPanelProps) {
  const spotLabels = buildSpotLabels(zone.spotCount, zone.spots_per_row)

  const handleSpotCount = (raw: string) => {
    const v = parseInt(raw, 10)
    if (!isNaN(v) && v >= 0 && v <= 200) {
      onUpdate({ spotCount: v })
    }
  }

  const handleSpotsPerRow = (raw: string) => {
    const v = parseInt(raw, 10)
    if (!isNaN(v) && v >= 1 && v <= 20) {
      onUpdate({ spots_per_row: v })
    }
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 12, height: 12, borderRadius: '50%',
            bgcolor: zone.color_hex, flexShrink: 0,
          }}
        />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, minWidth: 0 }} noWrap>
          {zone.label}
        </Typography>
        <Tooltip title="Close panel">
          <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
            <X size={14} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider />

      {/* Zone type */}
      <FormControl size="small" fullWidth>
        <InputLabel>Zone type</InputLabel>
        <Select
          label="Zone type"
          value={zone.icon_type}
          onChange={(e) => onUpdate({ icon_type: e.target.value as ZoneIconType })}
        >
          {Object.entries(ICON_TYPE_LABELS).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider />

      {/* Spot label preview */}
      {zone.spotCount > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
            SPOT LABELS PREVIEW
          </Typography>
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            maxHeight: 160,
            overflowY: 'auto',
          }}>
            {spotLabels.map((label) => (
              <Box
                key={label}
                sx={{
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: zone.color_hex + '20',
                  border: '1px solid',
                  borderColor: zone.color_hex + '60',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  fontFamily: 'monospace',
                  lineHeight: 1.4,
                }}
              >
                {label}
              </Box>
            ))}
          </Box>
          {zone.spotCount > 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
              {zone.spotCount} spots · {Math.ceil(zone.spotCount / zone.spots_per_row)} rows
            </Typography>
          )}
        </Box>
      )}

      {zone.spotCount === 0 && (
        <Typography variant="caption" color="text.disabled">
          Set "Total spots" above to configure parking spaces in this zone.
        </Typography>
      )}
    </Box>
  )
}
