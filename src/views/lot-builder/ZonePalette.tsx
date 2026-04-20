import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { Trash2, Pencil } from 'lucide-react'
import { alpha } from '@mui/material/styles'
import { useState } from 'react'
import TextField from '@mui/material/TextField'
import type { ZoneCanvasState } from '@/stores/builderStore'

interface ZonePaletteProps {
  zones: ZoneCanvasState[]
  selectedTempId: string | null
  onSelectZone: (tempId: string) => void
  onDeleteZone: (tempId: string) => void
  onRenameZone: (tempId: string, label: string) => void
}

export default function ZonePalette({
  zones,
  selectedTempId,
  onSelectZone,
  onDeleteZone,
  onRenameZone,
}: ZonePaletteProps) {
  const [editingTempId, setEditingTempId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const startEdit = (tempId: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTempId(tempId)
    setEditLabel(label)
  }

  const commitEdit = () => {
    if (editingTempId && editLabel.trim()) {
      onRenameZone(editingTempId, editLabel.trim())
    }
    setEditingTempId(null)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ fontSize: '0.65rem', mb: 0.5, display: 'block' }}
      >
        Zones ({zones.length})
      </Typography>

      {zones.length === 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', py: 3, display: 'block', lineHeight: 1.6 }}>
          Use the <strong>Zone</strong> tool to draw zones on the canvas
        </Typography>
      )}

      {zones.map((z) => {
        const isSelected = selectedTempId === z.tempId
        const isEditing = editingTempId === z.tempId

        return (
          <Box
            key={z.tempId}
            onClick={() => onSelectZone(z.tempId)}
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: isSelected ? z.color_hex : 'divider',
              bgcolor: isSelected ? alpha(z.color_hex, 0.1) : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              '&:hover': { borderColor: z.color_hex, bgcolor: alpha(z.color_hex, 0.06) },
              transition: 'border-color 0.12s, background-color 0.12s',
            }}
          >
            {/* Color swatch */}
            <Box
              sx={{ width: 9, height: 9, borderRadius: 0.5, bgcolor: z.color_hex, flexShrink: 0 }}
            />

            {/* Name / edit input */}
            {isEditing ? (
              <TextField
                size="small"
                value={editLabel}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingTempId(null)
                }}
                sx={{ flex: 1 }}
                inputProps={{ style: { fontSize: '0.78rem', padding: '2px 4px' } }}
              />
            ) : (
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ flex: 1, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {z.label}
              </Typography>
            )}

            {/* Spot count */}
            {!isEditing && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', flexShrink: 0 }}>
                {z.spotCount}
              </Typography>
            )}

            {/* Actions */}
            {!isEditing && isSelected && (
              <Box sx={{ display: 'flex', gap: 0, ml: 'auto', flexShrink: 0 }}>
                <Tooltip title="Rename">
                  <IconButton
                    size="small"
                    sx={{ p: 0.25 }}
                    onClick={(e) => startEdit(z.tempId, z.label, e)}
                  >
                    <Pencil size={11} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete zone">
                  <IconButton
                    size="small"
                    sx={{ p: 0.25, '&:hover': { color: 'error.main' } }}
                    onClick={(e) => { e.stopPropagation(); onDeleteZone(z.tempId) }}
                  >
                    <Trash2 size={11} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
