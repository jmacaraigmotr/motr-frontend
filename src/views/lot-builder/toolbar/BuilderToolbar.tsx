import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import {
  MousePointer2, Square, Undo2, Redo2,
  Spline, MapPin, Hand, Image, X, Lock, Unlock, Tag,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useBuilderStore } from '@/stores/builderStore'
import type { ToolMode } from '@/stores/builderStore'
import { lotApi } from '@/api/lot'

const TOOLS: Array<{ mode: ToolMode; label: string; hint: string; Icon: React.ElementType }> = [
  { mode: 'select',         label: 'Select',      hint: 'Select, move & resize (V)',                                                    Icon: MousePointer2 },
  { mode: 'draw-zone',      label: 'Zone',        hint: 'Draw a rectangular parking zone (Z)',                                          Icon: Square        },
  { mode: 'draw-zone-poly', label: 'Zone (poly)', hint: 'Click points to trace an irregular zone · Enter or Finish to close (Shift+Z)', Icon: Spline        },
  { mode: 'place-spot',     label: 'Spot',        hint: 'Click inside a zone to place an individual parking spot (S)',                  Icon: MapPin        },
  { mode: 'draw-spot-poly', label: 'Spot (poly)', hint: 'Click points to trace an irregular spot shape · Enter or Finish to close (Shift+S)', Icon: Spline  },
  { mode: 'pan',            label: 'Pan',         hint: 'Drag to pan the canvas (P or hold Space)',                          Icon: Hand          },
]

export const MODE_HINTS: Record<ToolMode, string> = {
  select:           'Click to select · Drag to move · Handles to resize · Dbl-click to rename',
  'draw-lot':       'Click and drag to draw the lot boundary',
  'draw-zone':      'Click and drag to draw a rectangular parking zone',
  'draw-zone-poly': 'Click to place points · Enter or "Finish" to close · Escape to cancel',
  'place-spot':     'Click inside a zone to drop a parking spot · Drag spots to reposition',
  'draw-spot-poly': 'Click to place spot points · Enter or "Finish" to close · Escape to cancel',
  'draw-wall':      'Click and drag to draw a wall rectangle',
  'draw-area':      'Click and drag to draw a structural area',
  pan:              'Drag canvas to pan · Scroll wheel to zoom (P or hold Space)',
}

interface BuilderToolbarProps {
  open: boolean
  onToggle: () => void
}

const COLLAPSED_W = 44
const EXPANDED_W = 140

export default function BuilderToolbar({ open, onToggle }: BuilderToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const {
    toolMode, setToolMode, undo, redo, canUndo, canRedo,
    backgroundImage, backgroundOpacity,
    setBackgroundImage, setBackgroundOpacity,
    zonesLocked, showZoneLabels, showSpotLabels,
    setZonesLocked, setShowZoneLabels, setShowSpotLabels,
  } = useBuilderStore()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const { url } = await lotApi.uploadBackground(file)
      setBackgroundImage(url)
    } catch {
      // upload failed — leave background unchanged
    } finally {
      setUploading(false)
    }
  }

  // ── Shared tool button ────────────────────────────────────────────────────────

  function ToolBtn({ mode, label, hint, Icon }: typeof TOOLS[0]) {
    const active = toolMode === mode
    const btn = (
      <Box
        component="button"
        data-tour={`tool-${mode}`}
        onClick={() => setToolMode(mode)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: open ? 1 : 0,
          justifyContent: open ? 'flex-start' : 'center',
          width: '100%',
          px: open ? 1.25 : 0,
          py: 0.6,
          border: 'none',
          borderRadius: 1.5,
          cursor: 'pointer',
          bgcolor: active ? 'primary.main' : 'transparent',
          color: active ? 'primary.contrastText' : 'text.secondary',
          '&:hover': { bgcolor: active ? 'primary.dark' : 'action.hover' },
          transition: 'background-color 0.12s',
          flexShrink: 0,
        }}
      >
        <Icon size={15} style={{ flexShrink: 0 }} />
        {open && (
          <Typography
            variant="caption"
            fontWeight={active ? 700 : 500}
            sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}
          >
            {label}
          </Typography>
        )}
      </Box>
    )
    return open ? btn : (
      <Tooltip title={<><strong>{label}</strong><br />{hint}</>} placement="right">
        {btn}
      </Tooltip>
    )
  }

  // ── Toggle button row shared style ────────────────────────────────────────────

  function ToggleRow({
    active, icon, label, hint, onClick,
  }: { active: boolean; icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
    const el = (
      <Box
        component="button"
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center',
          gap: open ? 1 : 0,
          justifyContent: open ? 'flex-start' : 'center',
          width: '100%',
          px: open ? 1.25 : 0, py: 0.6,
          border: 'none', borderRadius: 1.5, cursor: 'pointer',
          bgcolor: 'transparent',
          color: active ? 'primary.main' : 'text.disabled',
          '&:hover': { bgcolor: 'action.hover', color: active ? 'primary.dark' : 'text.secondary' },
          transition: 'background-color 0.12s',
          flexShrink: 0,
        }}
      >
        {icon}
        {open && (
          <Typography variant="caption" fontWeight={active ? 700 : 400} sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap', lineHeight: 1 }}>
            {label}
          </Typography>
        )}
      </Box>
    )
    return open ? el : <Tooltip title={hint} placement="right">{el}</Tooltip>
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Box sx={{
      width: open ? EXPANDED_W : COLLAPSED_W,
      flexShrink: 0,
      borderRight: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      py: 0.75,
      px: 0.5,
      overflowY: 'auto',
      overflowX: 'hidden',
      bgcolor: 'background.paper',
      transition: 'width 0.18s ease',
    }}>
      {/* Collapse / expand toggle */}
      <Box sx={{ display: 'flex', justifyContent: open ? 'flex-end' : 'center', mb: 0.5 }}>
        <Tooltip title={open ? 'Collapse' : 'Expand'} placement="right">
          <IconButton size="small" onClick={onToggle} sx={{ width: 28, height: 28, borderRadius: 1, color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}>
            {open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ mb: 0.5 }} />

      {/* Tool buttons */}
      {TOOLS.map((t) => <ToolBtn key={t.mode} {...t} />)}

      <Divider sx={{ my: 0.5 }} />

      {/* Undo / Redo */}
      <Tooltip title="Undo (Ctrl+Z)" placement="right" disableHoverListener={open}>
        <span>
          <Box
            component="button"
            onClick={undo}
            disabled={!canUndo}
            sx={{
              display: 'flex', alignItems: 'center', gap: open ? 1 : 0,
              justifyContent: open ? 'flex-start' : 'center',
              width: '100%', px: open ? 1.25 : 0, py: 0.6,
              border: 'none', borderRadius: 1.5, cursor: canUndo ? 'pointer' : 'default',
              bgcolor: 'transparent', color: canUndo ? 'text.secondary' : 'text.disabled',
              '&:hover': { bgcolor: canUndo ? 'action.hover' : 'transparent' },
            }}
          >
            <Undo2 size={15} style={{ flexShrink: 0 }} />
            {open && <Typography variant="caption" sx={{ fontSize: '0.72rem', lineHeight: 1 }}>Undo</Typography>}
          </Box>
        </span>
      </Tooltip>
      <Tooltip title="Redo (Ctrl+Y)" placement="right" disableHoverListener={open}>
        <span>
          <Box
            component="button"
            onClick={redo}
            disabled={!canRedo}
            sx={{
              display: 'flex', alignItems: 'center', gap: open ? 1 : 0,
              justifyContent: open ? 'flex-start' : 'center',
              width: '100%', px: open ? 1.25 : 0, py: 0.6,
              border: 'none', borderRadius: 1.5, cursor: canRedo ? 'pointer' : 'default',
              bgcolor: 'transparent', color: canRedo ? 'text.secondary' : 'text.disabled',
              '&:hover': { bgcolor: canRedo ? 'action.hover' : 'transparent' },
            }}
          >
            <Redo2 size={15} style={{ flexShrink: 0 }} />
            {open && <Typography variant="caption" sx={{ fontSize: '0.72rem', lineHeight: 1 }}>Redo</Typography>}
          </Box>
        </span>
      </Tooltip>

      <Divider sx={{ my: 0.5 }} />

      {/* View toggles */}
      <ToggleRow
        active={zonesLocked} hint={zonesLocked ? 'Unlock zone positions' : 'Lock zone positions'}
        label={zonesLocked ? 'Locked' : 'Lock zones'}
        icon={zonesLocked ? <Lock size={15} style={{ flexShrink: 0 }} /> : <Unlock size={15} style={{ flexShrink: 0 }} />}
        onClick={() => setZonesLocked(!zonesLocked)}
      />
      <ToggleRow
        active={showZoneLabels} hint={showZoneLabels ? 'Hide zone labels' : 'Show zone labels'}
        label="Zone labels"
        icon={<Tag size={15} style={{ flexShrink: 0 }} />}
        onClick={() => setShowZoneLabels(!showZoneLabels)}
      />
      <ToggleRow
        active={showSpotLabels} hint={showSpotLabels ? 'Hide spot labels' : 'Show spot labels'}
        label="Spot labels"
        icon={<MapPin size={13} style={{ flexShrink: 0 }} />}
        onClick={() => setShowSpotLabels(!showSpotLabels)}
      />

      <Divider sx={{ my: 0.5 }} />

      {/* Blueprint */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
      <div data-tour="tool-blueprint">
        <ToggleRow
          active={!!backgroundImage}
          hint={uploading ? 'Uploading…' : backgroundImage ? 'Remove blueprint' : 'Upload blueprint reference'}
          label={uploading ? 'Uploading…' : backgroundImage ? 'Remove bg' : 'Blueprint'}
          icon={
            uploading
              ? <CircularProgress size={13} sx={{ flexShrink: 0 }} />
              : backgroundImage
                ? <X size={15} style={{ flexShrink: 0 }} />
                : <Image size={15} style={{ flexShrink: 0 }} />
          }
          onClick={uploading ? () => {} : backgroundImage ? () => setBackgroundImage(null) : () => fileInputRef.current?.click()}
        />
      </div>

      {backgroundImage && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5, pb: 0.5 }}>
          <Slider
            orientation="vertical"
            size="small"
            value={backgroundOpacity}
            min={0.05} max={1} step={0.05}
            onChange={(_, v) => setBackgroundOpacity(v as number)}
            sx={{ height: 56 }}
          />
        </Box>
      )}

    </Box>
  )
}
