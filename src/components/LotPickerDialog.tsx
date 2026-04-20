import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Group, Line, Image as KonvaImage } from 'react-konva'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { ChevronLeft, Map, X } from 'lucide-react'
import { lotApi } from '@/api/lot'
import type { LotLayout, Zone, LotSpot } from '@/api/lot'
import type Konva from 'konva'

const ZONE_HDR = 24
const S_PAD = 3

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getSpotRect(spot: LotSpot, zone: Zone, totalSpots: number) {
  if (spot.canvas_x != null && spot.canvas_y != null) {
    return { x: spot.canvas_x, y: spot.canvas_y, w: spot.canvas_w ?? 60, h: spot.canvas_h ?? 40 }
  }
  const spr = zone.spots_per_row ?? 4
  const numRows = Math.max(1, Math.ceil(totalSpots / spr))
  const cellW = (zone.canvas_w - S_PAD * 2) / spr
  const cellH = (zone.canvas_h - ZONE_HDR - S_PAD * 2) / numRows
  return {
    x: zone.canvas_x + S_PAD + (spot.spot_col ?? 0) * cellW,
    y: zone.canvas_y + ZONE_HDR + S_PAD + (spot.spot_row ?? 0) * cellH,
    w: cellW - S_PAD,
    h: cellH - S_PAD,
  }
}

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const container = (e.target as Konva.Node).getStage()?.container()
  if (container) container.style.cursor = cursor
}

// ─── Canvas view ───────────────────────────────────────────────────────────────

interface CanvasViewProps {
  layout: LotLayout
  zones: Array<Zone & { spots: LotSpot[] }>
  tentativeId: number | undefined
  onSpotClick: (spot: LotSpot, zoneName: string) => void
}

function CanvasView({ layout, zones, tentativeId, onSpotClick }: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) setContainerW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const designW = layout.canvas_width ?? 1200
  const designH = layout.canvas_height ?? 800
  const scale = containerW > 0 ? containerW / designW : 1
  const canvasH = designH * scale

  const [bgImgEl, setBgImgEl] = useState<HTMLImageElement | null>(null)
  const [bgFitW, setBgFitW] = useState(0)
  const [bgFitH, setBgFitH] = useState(0)
  useEffect(() => {
    if (!layout.background_image) { setBgImgEl(null); return }
    const img = new window.Image()
    img.onload = () => {
      const fitScale = Math.min(designW / img.naturalWidth, designH / img.naturalHeight)
      setBgFitW(Math.round(img.naturalWidth * fitScale))
      setBgFitH(Math.round(img.naturalHeight * fitScale))
      setBgImgEl(img)
    }
    img.src = layout.background_image
  }, [layout.background_image, designW, designH])

  return (
    <Box ref={containerRef} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: '#1a1a1a', width: '100%' }}>
      {containerW > 0 && (
      <Stage width={containerW} height={canvasH} scaleX={scale} scaleY={scale}>
        <Layer>
          {/* Background reference image — centered, same fit-scale as BuilderCanvas */}
          {bgImgEl && bgFitW > 0 && (
            <KonvaImage
              image={bgImgEl}
              x={0} y={0}
              width={bgFitW} height={bgFitH}
              opacity={Math.min(layout.background_opacity ?? 0.35, 0.35)}
              listening={false}
            />
          )}

          {/* Boundary */}
          {layout.boundary_w != null && (
            <Rect
              x={layout.boundary_x ?? 0} y={layout.boundary_y ?? 0}
              width={layout.boundary_w} height={layout.boundary_h ?? 0}
              stroke="#c0c0c0" strokeWidth={2} fill="transparent" dash={[10, 5]}
            />
          )}

          {zones.map(zone => {
            const isPolygon = !!zone.canvas_points
            const fill = `${zone.color_hex}28`
            const stroke = zone.color_hex

            return (
              <Group key={zone.id}>
                {isPolygon ? (
                  <Line points={JSON.parse(zone.canvas_points!)} closed fill={fill} stroke={stroke} strokeWidth={2} />
                ) : (
                  <Rect
                    x={zone.canvas_x} y={zone.canvas_y}
                    width={zone.canvas_w} height={zone.canvas_h}
                    fill={fill} stroke={stroke} strokeWidth={2} cornerRadius={6}
                  />
                )}


                {/* Spots */}
                {zone.spots.map(spot => {
                  const r = getSpotRect(spot, zone, zone.spots.length)
                  const isSelected = tentativeId === spot.id
                  const isOccupied = spot.is_occupied

                  return (
                    <Group
                      key={spot.id}
                      onClick={() => !isOccupied && onSpotClick(spot, zone.name)}
                      onTap={() => !isOccupied && onSpotClick(spot, zone.name)}
                      onMouseEnter={(e) => setCursor(e, isOccupied ? 'not-allowed' : 'pointer')}
                      onMouseLeave={(e) => setCursor(e, 'default')}
                      opacity={isOccupied && !isSelected ? 0.5 : 1}
                    >
                      <Rect
                        x={r.x} y={r.y} width={r.w} height={r.h}
                        fill={isSelected ? '#1976d2' : isOccupied ? '#e0e0e0' : '#ffffff'}
                        stroke={isSelected ? '#1565c0' : isOccupied ? '#bdbdbd' : '#9e9e9e'}
                        strokeWidth={isSelected ? 2.5 : 1} cornerRadius={3}
                      />
                      <Text
                        x={r.x + 2} y={r.y + r.h / 2 - 6}
                        width={r.w - 4} text={spot.name} fontSize={11}
                        fill={isSelected ? '#fff' : isOccupied ? '#aaa' : '#333'}
                        align="center" ellipsis
                      />
                    </Group>
                  )
                })}
              </Group>
            )
          })}
        </Layer>
      </Stage>
      )}
    </Box>
  )
}

// ─── Lot selection cards ────────────────────────────────────────────────────────

interface LotCardsProps {
  layouts: LotLayout[]
  onSelect: (layout: LotLayout) => void
}

function LotCards({ layouts, onSelect }: LotCardsProps) {
  return (
    <Box>
      <Typography sx={{ mb: 2.5, color: 'text.secondary', fontSize: '0.9rem' }}>
        This shop has multiple lots. Choose the one where the vehicle will be parked.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
        {layouts.map(layout => (
          <Box
            key={layout.id}
            onClick={() => onSelect(layout)}
            sx={{
              p: 3, borderRadius: 2.5, border: '2px solid',
              borderColor: 'divider', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 2,
              transition: 'all 0.15s',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50', transform: 'translateY(-1px)', boxShadow: 2 },
            }}
          >
            <Box sx={{
              width: 44, height: 44, borderRadius: 2, flexShrink: 0,
              bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Map size={22} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                {layout.label}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.3 }}>
                Tap to view spots
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: '#fff', border: '#9e9e9e', label: 'Available' },
    { color: '#e0e0e0', border: '#bdbdbd', label: 'Occupied' },
    { color: '#1976d2', border: '#1565c0', label: 'Selected' },
  ]
  return (
    <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center' }}>
      {items.map(item => (
        <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{
            width: 16, height: 16, borderRadius: 0.5,
            bgcolor: item.color, border: `2px solid ${item.border}`,
          }} />
          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
        </Box>
      ))}
    </Box>
  )
}

// ─── Main dialog ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  shopId: number
  value?: number
  onConfirm: (spotId: number | undefined, label: string | undefined) => void
}

export function LotPickerDialog({ open, onClose, shopId, value, onConfirm }: Props) {
  const [selectedLayoutId, setSelectedLayoutId] = useState<number | null>(null)
  const [tentativeId, setTentativeId] = useState<number | undefined>(value)
  const [tentativeLabel, setTentativeLabel] = useState<string | undefined>()

  // Sync tentative state when dialog opens
  useEffect(() => {
    if (open) {
      setTentativeId(value)
      setTentativeLabel(undefined)
      setSelectedLayoutId(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Single query — preloaded by AppShell, zones+spots nested inside each layout
  const { data: layouts = [], isLoading: layoutsLoading } = useQuery({
    queryKey: ['lot_layouts_active', shopId],
    queryFn: async () => {
      const all = await lotApi.listLayouts(shopId)
      return all.filter(l => l.is_active)
    },
    staleTime: 30_000,
  })

  // Auto-select: only one lot, or the lot that contains the current spot
  useEffect(() => {
    if (selectedLayoutId !== null || layouts.length === 0) return
    if (layouts.length === 1) { setSelectedLayoutId(layouts[0].id); return }
    if (value) {
      const match = layouts.find(l => l.zones?.some(z => z.spots?.some(s => s.id === value)))
      if (match) { setSelectedLayoutId(match.id); return }
    }
  }, [layouts, selectedLayoutId, value])

  const activeLayout = layouts.find(l => l.id === selectedLayoutId) ?? null
  const zonesWithSpots = activeLayout?.zones ?? []
  const showLotSelect = selectedLayoutId === null && layouts.length > 1
  const hasMultipleLots = layouts.length > 1

  function handleSpotClick(spot: LotSpot, zoneName: string) {
    if (tentativeId === spot.id) {
      setTentativeId(undefined)
      setTentativeLabel(undefined)
    } else {
      setTentativeId(spot.id)
      const lotPrefix = hasMultipleLots && activeLayout ? `${activeLayout.label} · ` : ''
      setTentativeLabel(`${lotPrefix}${zoneName} — ${spot.name}`)
    }
  }

  function handleConfirm() {
    onConfirm(tentativeId, tentativeLabel)
    onClose()
  }

  const title = showLotSelect
    ? 'Select a Lot'
    : activeLayout
    ? `${activeLayout.label} — Pick a Spot`
    : 'Select Parking Spot'

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: '90vw', maxWidth: activeLayout ? `${(activeLayout.canvas_width ?? 1200) * 0.75}px` : 640, m: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        {/* Back to lot selection */}
        {!showLotSelect && hasMultipleLots && (
          <IconButton size="small" onClick={() => setSelectedLayoutId(null)} sx={{ mr: 0.5 }}>
            <ChevronLeft size={18} />
          </IconButton>
        )}
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.1rem', flex: 1 }}>
          {title}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {layoutsLoading ? (
          <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
        ) : layouts.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No active lot layout configured for this shop.</Typography>
          </Box>
        ) : showLotSelect ? (
          <LotCards layouts={layouts} onSelect={(l) => setSelectedLayoutId(l.id)} />
        ) : !activeLayout ? (
          <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 2 }} />
        ) : (
          <Box>
            <CanvasView
              layout={activeLayout}
              zones={zonesWithSpots}
              tentativeId={tentativeId}
              onSpotClick={handleSpotClick}
            />
            {/* Footer row: legend + selection chip */}
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Legend />
              {tentativeId && tentativeLabel ? (
                <Chip
                  size="small" color="primary"
                  label={tentativeLabel}
                  onDelete={() => { setTentativeId(undefined); setTentativeLabel(undefined) }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Click an available spot to select it
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {!showLotSelect && (
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose} variant="outlined" color="inherit">Cancel</Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={!tentativeId}
          >
            {tentativeId ? 'Confirm Spot' : 'No Spot Selected'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
