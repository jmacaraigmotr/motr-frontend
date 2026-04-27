﻿import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Group, Line, Circle, Image as KonvaImage } from 'react-konva'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { Clock, MapPin, MoveRight, X, Car, User, CalendarDays, History, ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react'
import { lotApi } from '@/api/lot'
import type { LotCanvasPayload, SpotDetail, LotSpot } from '@/api/lot'
import { LotPickerDialog } from './LotPickerDialog'
import type Konva from 'konva'
import { differenceInMinutes, format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(d: string | number | null | undefined): Date | null {
  if (!d) return null
  const parsed = typeof d === 'number' ? new Date(d) : parseISO(d)
  return isValid(parsed) ? parsed : null
}

function fmtDate(d: string | number | null | undefined) {
  const parsed = toDate(d)
  return parsed ? format(parsed, 'MMM d, yyyy') : '—'
}

function fmtParked(arrivedAt: string | number | null | undefined) {
  const parsed = toDate(arrivedAt)
  return parsed ? formatDistanceToNow(parsed, { addSuffix: false }) : '—'
}

function fmtDateTime(d: string | number | null | undefined) {
  const parsed = toDate(d)
  return parsed ? format(parsed, 'MMM d, yyyy h:mm a') : null
}

function fmtHoursBetween(from: string | number | null | undefined, to: string | number | null | undefined) {
  const fromD = toDate(from)
  if (!fromD) return null
  const toD = toDate(to) ?? new Date()
  const mins = Math.max(0, differenceInMinutes(toD, fromD))
  const hrs = mins / 60
  return hrs < 1 ? `${mins}m` : `${hrs.toFixed(1)}h`
}

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const c = (e.target as Konva.Node).getStage()?.container()
  if (c) c.style.cursor = cursor
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

const ZONE_HDR = 24
const S_PAD = 3

function getSpotRect(spot: { canvas_x?: number | null; canvas_y?: number | null; canvas_w?: number | null; canvas_h?: number | null; spot_row: number; spot_col: number }, zone: { canvas_x: number; canvas_y: number; canvas_w: number; canvas_h: number; spots_per_row: number }, totalSpots: number) {
  if (spot.canvas_x != null && spot.canvas_y != null) {
    return { x: spot.canvas_x, y: spot.canvas_y, w: spot.canvas_w ?? 28, h: spot.canvas_h ?? 46 }
  }
  const spr = zone.spots_per_row ?? 4
  const rows = Math.max(1, Math.ceil(totalSpots / spr))
  const cellW = (zone.canvas_w - S_PAD * 2) / spr
  const cellH = (zone.canvas_h - ZONE_HDR - S_PAD * 2) / rows
  return {
    x: zone.canvas_x + S_PAD + spot.spot_col * cellW,
    y: zone.canvas_y + ZONE_HDR + S_PAD + spot.spot_row * cellH,
    w: cellW - S_PAD,
    h: cellH - S_PAD,
  }
}

interface CanvasViewProps {
  canvasData: LotCanvasPayload
  backgroundImage?: string | null
  backgroundOpacity?: number | null
  selectedSpotId: number | null
  onSpotClick: (spotId: number, layoutId: number) => void
}

function CanvasView({ canvasData, backgroundImage, backgroundOpacity, selectedSpotId, onSpotClick }: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [zoomScale, setZoomScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [bgImgEl, setBgImgEl] = useState<HTMLImageElement | null>(null)
  const [bgFit, setBgFit] = useState({ w: 0, h: 0 })

  // Display toggles
  const [showSpotNames, setShowSpotNames] = useState(false)
  const [showJobNumber, setShowJobNumber] = useState(true)
  const [showVacantIcon, setShowVacantIcon] = useState(true)

  // Hover tooltip
  const [tooltip, setTooltip] = useState<{ spot: LotSpot; x: number; y: number } | null>(null)

  // Preload FA font so Konva canvas can render glyphs immediately
  useEffect(() => {
    document.fonts.load('900 16px "Font Awesome 6 Free"').then(() => {
      stageRef.current?.getLayers().forEach(l => l.batchDraw())
    })
  }, [])


  const layout = canvasData.layout
  const designW = layout?.canvas_width ?? 1200
  const designH = layout?.canvas_height ?? 800

  useEffect(() => {
    if (!backgroundImage) { setBgImgEl(null); setBgFit({ w: 0, h: 0 }); return }
    const img = new window.Image()
    img.onload = () => {
      setBgImgEl(img)
      // Match the builder's auto-fit: Math.min scale preserves aspect ratio, same as BuilderCanvas
      const s = Math.min(designW / img.naturalWidth, designH / img.naturalHeight)
      setBgFit({ w: Math.round(img.naturalWidth * s), h: Math.round(img.naturalHeight * s) })
    }
    img.src = backgroundImage
  }, [backgroundImage, designW, designH])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      if (w > 0) setContainerSize({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const baseScale = containerSize.w > 0 ? containerSize.w / designW : 1
  const totalScale = baseScale * zoomScale

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const scaleBy = 1.12
    const oldZoom = zoomScale
    const newZoom = Math.min(Math.max(e.evt.deltaY < 0 ? oldZoom * scaleBy : oldZoom / scaleBy, 0.3), 6)
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()!
    const oldTotal = baseScale * oldZoom
    const newTotal = baseScale * newZoom
    setStagePos({
      x: pointer.x - (pointer.x - stagePos.x) * (newTotal / oldTotal),
      y: pointer.y - (pointer.y - stagePos.y) * (newTotal / oldTotal),
    })
    setZoomScale(newZoom)
  }

  function zoom(dir: 1 | -1) {
    const scaleBy = 1.2
    const oldZoom = zoomScale
    const newZoom = Math.min(Math.max(dir > 0 ? oldZoom * scaleBy : oldZoom / scaleBy, 0.3), 6)
    const cx = containerSize.w / 2, cy = containerSize.h / 2
    const oldTotal = baseScale * oldZoom
    const newTotal = baseScale * newZoom
    setStagePos({
      x: cx - (cx - stagePos.x) * (newTotal / oldTotal),
      y: cy - (cy - stagePos.y) * (newTotal / oldTotal),
    })
    setZoomScale(newZoom)
  }

  function resetView() {
    setZoomScale(1)
    setStagePos({ x: 0, y: 0 })
  }

  // ── Mini-map ─────────────────────────────────────────────────────────────────
  const miniMapRef = useRef<HTMLCanvasElement>(null)
  const MINI_W = 200
  const miniH = Math.round(MINI_W * (designH / designW))
  const miniScale = MINI_W / designW

  useEffect(() => {
    const canvas = miniMapRef.current
    if (!canvas || containerSize.w === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, MINI_W, miniH)

    // Background
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, MINI_W, miniH)

    // Background image
    if (bgImgEl && bgFit.w > 0) {
      ctx.globalAlpha = backgroundOpacity ?? 0.4
      ctx.drawImage(bgImgEl, 0, 0, bgFit.w * miniScale, bgFit.h * miniScale)
      ctx.globalAlpha = 1
    }

    // Zones
    canvasData.zones.forEach(zone => {
      if (zone.canvas_points) {
        const pts = JSON.parse(zone.canvas_points) as number[]
        ctx.beginPath()
        for (let i = 0; i < pts.length; i += 2) {
          i === 0 ? ctx.moveTo(pts[i] * miniScale, pts[i + 1] * miniScale) : ctx.lineTo(pts[i] * miniScale, pts[i + 1] * miniScale)
        }
        ctx.closePath()
        ctx.fillStyle = zone.color_hex + '33'
        ctx.strokeStyle = zone.color_hex
        ctx.lineWidth = 1
        ctx.fill(); ctx.stroke()
      } else {
        ctx.fillStyle = zone.color_hex + '33'
        ctx.strokeStyle = zone.color_hex
        ctx.lineWidth = 1
        ctx.fillRect(zone.canvas_x * miniScale, zone.canvas_y * miniScale, zone.canvas_w * miniScale, zone.canvas_h * miniScale)
        ctx.strokeRect(zone.canvas_x * miniScale, zone.canvas_y * miniScale, zone.canvas_w * miniScale, zone.canvas_h * miniScale)
      }
    })

    // Occupied spots as orange dots
    canvasData.zones.forEach(zone => {
      zone.spots.forEach(spot => {
        if (!spot.is_occupied) return
        const cx = ((spot.canvas_x ?? zone.canvas_x + zone.canvas_w / 2) + (spot.canvas_w ?? 0) / 2) * miniScale
        const cy = ((spot.canvas_y ?? zone.canvas_y + zone.canvas_h / 2) + (spot.canvas_h ?? 0) / 2) * miniScale
        ctx.beginPath()
        ctx.arc(cx, cy, 2, 0, Math.PI * 2)
        ctx.fillStyle = '#E65100'
        ctx.fill()
      })
    })

    // Viewport indicator
    const vpX = (-stagePos.x / totalScale) * miniScale
    const vpY = (-stagePos.y / totalScale) * miniScale
    const vpW = (containerSize.w / totalScale) * miniScale
    const vpH = (containerSize.h / totalScale) * miniScale
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 2])
    ctx.strokeRect(vpX, vpY, vpW, vpH)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(vpX, vpY, vpW, vpH)
    ctx.setLineDash([])
  }, [stagePos, totalScale, containerSize, canvasData, bgImgEl, bgFit, backgroundOpacity, miniScale, miniH])

  function handleMiniMapClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const designX = mx / miniScale
    const designY = my / miniScale
    setStagePos({
      x: containerSize.w / 2 - designX * totalScale,
      y: containerSize.h / 2 - designY * totalScale,
    })
  }

  const btnSx = { bgcolor: 'rgba(40,40,40,0.9)', color: '#ccc', border: '1px solid #444', borderRadius: 1, p: 0.5, minWidth: 0, '&:hover': { bgcolor: '#333', color: '#fff' } }

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', bgcolor: '#1a1a1a', overflow: 'hidden', position: 'relative' }}>
      {/* Display toggles */}
      <Box sx={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        display: 'flex', gap: 0.75, flexWrap: 'wrap',
      }}>
        {([
          { label: 'Spot Names', value: showSpotNames, set: setShowSpotNames },
          { label: 'Job #',      value: showJobNumber, set: setShowJobNumber },
          { label: 'Vacant Icon',value: showVacantIcon,set: setShowVacantIcon },
        ] as const).map(({ label, value, set }) => (
          <Box
            key={label}
            onClick={() => set((v: boolean) => !v)}
            sx={{
              px: 1.25, py: 0.4,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
              border: '1px solid',
              transition: 'all 0.15s',
              bgcolor: value ? 'rgba(255,255,255,0.15)' : 'rgba(30,30,30,0.85)',
              borderColor: value ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)',
              color: value ? '#fff' : '#888',
              '&:hover': { borderColor: 'rgba(255,255,255,0.3)', color: '#ccc' },
            }}
          >
            {value ? '✓ ' : ''}{label}
          </Box>
        ))}
      </Box>

      {/* Mini-map */}
      {containerSize.w > 0 && (
        <Box sx={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, borderRadius: 1.5, overflow: 'hidden', border: '1px solid #444', boxShadow: '0 2px 8px rgba(0,0,0,0.6)', cursor: 'crosshair' }}>
          <canvas
            ref={miniMapRef}
            width={MINI_W}
            height={miniH}
            onClick={handleMiniMapClick}
            style={{ display: 'block' }}
          />
        </Box>
      )}
      {/* Zoom controls */}
      {containerSize.w > 0 && (
        <Box sx={{ position: 'absolute', bottom: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <IconButton size="small" onClick={() => zoom(1)} sx={btnSx}><ZoomIn size={16} /></IconButton>
          <IconButton size="small" onClick={() => zoom(-1)} sx={btnSx}><ZoomOut size={16} /></IconButton>
          <IconButton size="small" onClick={resetView} sx={btnSx}><Maximize2 size={16} /></IconButton>
        </Box>
      )}
      {containerSize.w > 0 && layout && (
        <Stage
          ref={stageRef}
          width={containerSize.w}
          height={containerSize.h || containerSize.w * (designH / designW)}
          scaleX={totalScale}
          scaleY={totalScale}
          x={stagePos.x}
          y={stagePos.y}
          draggable
          onWheel={handleWheel}
          onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        >
          <Layer>
            {/* Background blueprint image — auto-fitted like the builder (aspect-ratio preserved) */}
            {bgImgEl && bgFit.w > 0 && (
              <KonvaImage
                image={bgImgEl}
                x={0} y={0}
                width={bgFit.w} height={bgFit.h}
                opacity={backgroundOpacity ?? 0.4}
              />
            )}

            {/* Boundary */}
            {layout.boundary.w > 0 && (
              <Rect
                x={layout.boundary.x} y={layout.boundary.y}
                width={layout.boundary.w} height={layout.boundary.h}
                stroke="#555" strokeWidth={2} fill="transparent" dash={[10, 5]}
              />
            )}

            {canvasData.zones.map(zone => {
              const isPolygon = !!zone.canvas_points
              const fill = `${zone.color_hex}22`
              const stroke = zone.color_hex

              return (
                <Group key={zone.id}>
                  {isPolygon ? (
                    <Line points={JSON.parse(zone.canvas_points!)} closed fill={fill} stroke={stroke} strokeWidth={2} />
                  ) : (
                    <Rect x={zone.canvas_x} y={zone.canvas_y} width={zone.canvas_w} height={zone.canvas_h}
                      fill={fill} stroke={stroke} strokeWidth={2} cornerRadius={6} />
                  )}


                  {zone.spots.map(spot => {
                    const r = getSpotRect(spot, zone, zone.spots.length)
                    const isSelected = selectedSpotId === spot.id
                    const isOccupied = spot.is_occupied
                    const isPolySpot = !!spot.canvas_points
                    const iconSize = Math.min(r.w, r.h)

                    // Occupied: amber fill. Vacant: very dark with subtle green tint
                    const fillColor = isOccupied ? '#3a1a00' : '#161f16'
                    const strokeColor = isSelected ? '#ffffff' : isOccupied ? '#FF8F00' : '#2e4a2e'
                    const strokeW = isSelected ? 2.5 : 1.5
                    const vacantDash = isOccupied ? undefined : [4, 3]

                    const jobNum = spot.ro?.job_number ?? (spot as any).job_number ?? null
                    const jobLabel = jobNum != null ? `#${jobNum}` : spot.ro_number ?? null

                    return (
                      <Group
                        key={spot.id}
                        onClick={() => onSpotClick(spot.id, layout?.id ?? 0)}
                        onMouseEnter={(e) => {
                          setCursor(e, 'pointer')
                          setTooltip({ spot, x: e.evt.clientX, y: e.evt.clientY })
                        }}
                        onMouseMove={(e) => {
                          setTooltip(t => t ? { ...t, x: e.evt.clientX, y: e.evt.clientY } : null)
                        }}
                        onMouseLeave={(e) => {
                          setCursor(e, 'default')
                          setTooltip(null)
                        }}
                      >
                        {isPolySpot ? (
                          <Line
                            points={JSON.parse(spot.canvas_points!)}
                            closed
                            fill={fillColor} stroke={strokeColor} strokeWidth={strokeW}
                            dash={vacantDash}
                            shadowColor={isSelected ? '#fff' : 'transparent'}
                            shadowBlur={isSelected ? 10 : 0}
                            shadowOpacity={0.6}
                          />
                        ) : (
                          <Rect x={r.x} y={r.y} width={r.w} height={r.h}
                            fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} cornerRadius={3}
                            dash={vacantDash}
                            shadowColor={isSelected ? '#fff' : 'transparent'}
                            shadowBlur={isSelected ? 10 : 0}
                            shadowOpacity={0.6}
                          />
                        )}

                        {isOccupied ? (
                          <>
                            {/* fa-location-dot pin icon */}
                            <Text
                              x={r.x} y={r.y + r.h / 2 - iconSize * 0.36 - (showJobNumber && jobLabel ? iconSize * 0.1 : 0)}
                              width={r.w}
                              text={''}
                              fontFamily='"Font Awesome 6 Free"'
                              fontStyle="900"
                              fontSize={Math.max(8, iconSize * 0.46)}
                              fill={isSelected ? '#FFD54F' : '#FFB74D'}
                              align="center"
                              listening={false}
                            />
                            {showJobNumber && jobLabel && (
                              <Text
                                x={r.x + 1} y={r.y + r.h / 2 + iconSize * 0.22}
                                width={r.w - 2}
                                text={jobLabel}
                                fontSize={Math.max(6, iconSize * 0.18)}
                                fill={isSelected ? '#fff' : '#FFB74D'}
                                fontStyle="bold"
                                align="center" ellipsis
                                listening={false}
                              />
                            )}
                            {showSpotNames && (
                              <Text
                                x={r.x + 1} y={r.y + 3}
                                width={r.w - 2}
                                text={spot.name}
                                fontSize={Math.max(5, iconSize * 0.14)}
                                fill={isSelected ? '#fff' : '#888'}
                                align="center" ellipsis
                                listening={false}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            {/* Green availability dot */}
                            {showVacantIcon && (
                              <Circle
                                x={r.x + r.w / 2}
                                y={showSpotNames ? r.y + r.h * 0.38 : r.y + r.h / 2}
                                radius={Math.max(3, iconSize * 0.14)}
                                fill={isSelected ? '#fff' : '#4CAF50'}
                                listening={false}
                              />
                            )}
                            {showSpotNames && (
                              <Text
                                x={r.x + 1}
                                y={r.y + (showVacantIcon ? r.h * 0.58 : r.h / 2 - iconSize * 0.1)}
                                width={r.w - 2} text={spot.name}
                                fontSize={Math.max(5, iconSize * 0.16)}
                                fill={isSelected ? '#fff' : '#6aad6a'}
                                align="center" ellipsis
                                listening={false}
                              />
                            )}
                          </>
                        )}
                      </Group>
                    )
                  })}
                </Group>
              )
            })}
          </Layer>
        </Stage>
      )}

      {/* Hover tooltip */}
      {tooltip && (() => {
        const s = tooltip.spot
        const isOccupied = s.is_occupied
        const jobNum = s.ro?.job_number ?? (s as any).job_number ?? null
        const jobLabel = jobNum != null ? `#${jobNum}` : s.ro_number ?? null
        const veh = s.vehicle
        const vehicleLine = veh ? [veh.year, veh.make, veh.model].filter(Boolean).join(' ') : null
        return (
          <Box
            sx={{
              position: 'fixed',
              left: tooltip.x + 14,
              top: tooltip.y - 10,
              zIndex: 9999,
              pointerEvents: 'none',
              bgcolor: 'rgba(18,18,18,0.96)',
              border: `1px solid ${isOccupied ? '#FF8F00' : '#3a7a3a'}`,
              borderRadius: '8px',
              px: 1.5, py: 1,
              minWidth: 120,
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            }}
          >
            {isOccupied ? (
              <>
                {jobLabel && (
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#FFB74D', lineHeight: 1.3 }}>
                    Job {jobLabel}
                  </Typography>
                )}
                {vehicleLine && (
                  <Typography sx={{ fontSize: 11, color: '#ccc', lineHeight: 1.4, mt: 0.25 }}>
                    {vehicleLine}
                    {veh?.color && <span style={{ color: '#999' }}> · {veh.color}</span>}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 10, color: '#888', mt: 0.25 }}>{s.name}</Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#4CAF50', lineHeight: 1.3 }}>
                  Vacant
                </Typography>
                <Typography sx={{ fontSize: 10, color: '#666', mt: 0.25 }}>{s.name}</Typography>
              </>
            )}
          </Box>
        )
      })()}
    </Box>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  detail: SpotDetail | undefined
  isLoading: boolean
  roId?: number
  currentSpotId?: number
  resolvedZoneName?: string | null
  onMove: () => void
  onUnassign: () => void
  onMoveToDifferentLot: () => void
  isMutating: boolean
}

function DetailPanel({ detail, isLoading, roId, currentSpotId, resolvedZoneName, onMove, onUnassign, onMoveToDifferentLot, isMutating }: DetailPanelProps) {
  const [tab, setTab] = useState(0)

  useEffect(() => {
    setTab(0)
  }, [detail?.spot.id])

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="60%" height={36} />
        <Skeleton variant="text" width="40%" sx={{ mt: 1 }} />
        <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={80} sx={{ mt: 2, borderRadius: 2 }} />
      </Box>
    )
  }

  if (!detail) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.disabled', p: 3 }}>
        <MapPin size={36} strokeWidth={1.2} />
        <Typography sx={{ fontSize: '0.9rem', textAlign: 'center' }}>
          Click a spot on the map<br />to view its details
        </Typography>
      </Box>
    )
  }

  const { spot, current, history } = detail
  const isCurrentSpot = currentSpotId === spot.id
  const canMoveHere = !!roId && !spot.is_occupied && !isCurrentSpot
  const canUnassign = !!roId && isCurrentSpot
  const hasHistory = history.length > 0

  return (
    <Box sx={{ p: 2.5, overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.2 }}>
          {[resolvedZoneName ?? spot.zone_name, spot.name].filter(Boolean).join(' — ')}
        </Typography>
        <Chip
          label={spot.is_occupied ? 'Occupied' : 'Available'}
          size="small"
          sx={{
            fontWeight: 700, fontSize: '0.72rem',
            bgcolor: spot.is_occupied ? '#FFF3E0' : '#E8F5E9',
            color: spot.is_occupied ? '#E65100' : '#2E7D32',
            border: 'none',
          }}
        />
      </Box>

      {/* Breadcrumb */}
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
        {[spot.layout_label, spot.zone_name].filter(Boolean).join(' › ')}
      </Typography>

      <Chip
        label={spot.spot_type ?? 'standard'}
        size="small"
        variant="outlined"
        sx={{ fontSize: '0.72rem', mb: 2, textTransform: 'capitalize' }}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.78rem', fontWeight: 800 } }}
      >
        <Tab label="Details" />
        <Tab label={hasHistory ? `Occupancy History (${history.length})` : 'Occupancy History'} disabled={!hasHistory} />
      </Tabs>

      {tab === 0 && (
        <>
          {/* Current occupant */}
      {current ? (
        <>
          <Divider sx={{ mb: 2 }} />
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            Current Occupant
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <User size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {current.customer_first_name} {current.customer_last_name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25, flexShrink: 0 }}>
              {current.job_number != null && (
                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                  Job #{current.job_number}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                {current.ro_number}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Car size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              {[current.vehicle_year, current.vehicle_make, current.vehicle_model].filter(Boolean).join(' ') || '—'}
              {current.vehicle_color ? ` · ${current.vehicle_color}` : ''}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 1.5, mb: 0.5 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                <Clock size={12} style={{ opacity: 0.45 }} />
                <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em' }}>In This Spot</Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {fmtParked(current.parked_in_spot_at) ?? '—'}
              </Typography>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                <CalendarDays size={12} style={{ opacity: 0.45 }} />
                <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Due Out</Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {fmtDate(current.scheduled_out_date) ?? '—'}
              </Typography>
            </Box>
          </Box>
        </>
      ) : (
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}>
          This spot is currently empty.
        </Typography>
      )}

      {/* Action buttons */}
      {(canMoveHere || canUnassign) && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {canMoveHere && (
              <Button
                variant="contained"
                fullWidth
                disabled={isMutating}
                onClick={onMove}
                startIcon={isMutating ? <CircularProgress size={13} color="inherit" /> : <MapPin size={14} />}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  borderRadius: '8px',
                  py: 1,
                  background: '#C05621',
                  '&:hover': { background: '#9C4419' },
                  boxShadow: 'none',
                  '&:active': { boxShadow: 'none' },
                }}
              >
                Move Vehicle Here
              </Button>
            )}
            {canUnassign && (
              <Button
                variant="outlined"
                fullWidth
                disabled={isMutating}
                onClick={onMoveToDifferentLot}
                startIcon={<MoveRight size={14} />}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  borderRadius: '8px',
                  py: 1,
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { borderColor: 'text.secondary', background: 'action.hover' },
                }}
              >
                Move to Different Lot
              </Button>
            )}
            {canUnassign && (
              <Button
                variant="text"
                fullWidth
                disabled={isMutating}
                onClick={onUnassign}
                startIcon={<Trash2 size={13} />}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  borderRadius: '8px',
                  py: 0.75,
                  color: 'error.main',
                  '&:hover': { background: 'rgba(211,47,47,0.06)' },
                }}
              >
                Remove from Spot
              </Button>
            )}
          </Box>
        </>
      )}

        </>
      )}

      {/* History */}
      {tab === 1 && hasHistory && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <History size={13} style={{ opacity: 0.5 }} />
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Occupancy History
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {history.map((h, i) => {
              const movedIn = fmtDateTime(h.moved_in_at)
              const movedOut = fmtDateTime(h.moved_out_at)
              const duration = fmtHoursBetween(h.moved_in_at, h.moved_out_at)
              const isActive = !h.moved_out_at

              return (
              <Box
                key={i}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: isActive ? 'primary.light' : 'divider',
                  bgcolor: isActive ? 'primary.50' : 'transparent',
                  position: 'relative',
                }}
              >
                {/* RO + customer row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <User size={13} style={{ opacity: 0.5 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {h.customer_first_name
                        ? `${h.customer_first_name} ${h.customer_last_name ?? ''}`.trim()
                        : 'Unknown'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {duration && (
                      <Chip
                        label={duration}
                        size="small"
                        sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700, bgcolor: isActive ? '#E3F2FD' : '#f5f5f5', color: isActive ? '#1565C0' : 'text.secondary' }}
                      />
                    )}
                    {h.ro_number && (
                      <Chip label={h.ro_number} size="small" color={isActive ? 'primary' : 'default'} sx={{ height: 18, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                </Box>

                {/* Parked in / out row */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.25 }}>
                      Parked
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                      {movedIn ?? '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.25 }}>
                      Moved Out
                    </Typography>
                    {isActive ? (
                      <Chip label="Still here" size="small" sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#E8F5E9', color: '#2E7D32' }} />
                    ) : (
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                        {movedOut ?? '—'}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {h.notes && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.75, fontStyle: 'italic' }}>
                    {h.notes}
                  </Typography>
                )}
              </Box>
              )
            })}
          </Box>
        </>
      )}
    </Box>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  shopId: number
  initialSpotId?: number
  roId?: number
  currentSpotId?: number
  onSpotChanged?: () => void
}

export function LotDetailsModal({ open, onClose, shopId, initialSpotId, roId, currentSpotId, onSpotChanged }: Props) {
  const qc = useQueryClient()
  const [selectedSpotId, setSelectedSpotId] = useState<number | null>(initialSpotId ?? null)
  const [resolvedLayoutId, setResolvedLayoutId] = useState<number | undefined>(undefined)
  const [lotPickerOpen, setLotPickerOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedSpotId(initialSpotId ?? null)
      setResolvedLayoutId(undefined)
    }
  }, [open, initialSpotId])

  const { data: spotDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['lot_spot_detail', selectedSpotId],
    queryFn: () => lotApi.getSpotDetail(selectedSpotId!),
    enabled: !!selectedSpotId,
    staleTime: 15_000,
  })

  // Resolve layout from spotDetail (initial open path)
  useEffect(() => {
    if (spotDetail?.spot.layout_id != null) {
      setResolvedLayoutId(spotDetail.spot.layout_id)
    }
  }, [spotDetail?.spot.layout_id])

  function handleSpotClick(spotId: number, layoutId: number) {
    setSelectedSpotId(spotId)
    if (layoutId) setResolvedLayoutId(layoutId)
  }

  // canvasLayoutId is stable — never reverts to undefined once resolved
  const canvasLayoutId = resolvedLayoutId
  // Block canvas from loading stale default-layout cache while we await the correct layout
  const isAwaitingLayout = !!selectedSpotId && resolvedLayoutId == null
  const canvasReady = !isAwaitingLayout

  const { data: canvasData, isLoading: canvasLoading } = useQuery({
    queryKey: ['lot_canvas', shopId, canvasLayoutId],
    queryFn: () => lotApi.getCanvas(shopId, canvasLayoutId),
    staleTime: 30_000,
    enabled: open && !!shopId && canvasReady,
  })

  const moveMut = useMutation({
    mutationFn: () => lotApi.assignSpot(selectedSpotId!, roId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lot_canvas', shopId] })
      qc.invalidateQueries({ queryKey: ['lot_spot_detail'] })
      qc.invalidateQueries({ queryKey: ['repair_order_detail'] })
      qc.invalidateQueries({ queryKey: ['lot_locations'] })
      onSpotChanged?.()
      onClose()
    },
  })

  const unassignMut = useMutation({
    mutationFn: () => lotApi.unassignSpot(currentSpotId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lot_canvas', shopId] })
      qc.invalidateQueries({ queryKey: ['lot_spot_detail'] })
      qc.invalidateQueries({ queryKey: ['repair_order_detail'] })
      qc.invalidateQueries({ queryKey: ['lot_locations'] })
      onSpotChanged?.()
      onClose()
    },
  })

  const pickAndMoveMut = useMutation({
    mutationFn: (newSpotId: number) => lotApi.assignSpot(newSpotId, roId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lot_canvas', shopId] })
      qc.invalidateQueries({ queryKey: ['lot_spot_detail'] })
      qc.invalidateQueries({ queryKey: ['repair_order_detail'] })
      qc.invalidateQueries({ queryKey: ['lot_locations'] })
      onSpotChanged?.()
      onClose()
    },
  })

  const layout = canvasData?.layout
  const title = layout ? `${layout.label} — Spot Map` : 'Spot Map'

  // Resolve zone name from canvas zones (zone_name from spot detail API is also correct, this is a fallback)
  const resolvedZoneName = spotDetail
    ? (canvasData?.zones.find(z => z.id === spotDetail.spot.zone_id)?.name ?? spotDetail.spot.zone_name)
    : undefined

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: '95vw', maxWidth: '95vw', height: '95vh', m: 1, borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 6, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>
          {title}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 10 }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left — canvas */}
        <Box sx={{ flex: '0 0 70%', borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
          {(canvasLoading || isAwaitingLayout) ? (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#1a1a1a' }}>
              <CircularProgress sx={{ color: '#555' }} />
            </Box>
          ) : canvasData ? (
            <CanvasView
              canvasData={canvasData}
              backgroundImage={canvasData?.layout?.background_image}
              backgroundOpacity={canvasData?.layout?.background_opacity}
              selectedSpotId={selectedSpotId}
              onSpotClick={handleSpotClick}
            />
          ) : (
            <Box sx={{ p: 3, color: 'text.disabled' }}>
              <Typography>No active lot layout found.</Typography>
            </Box>
          )}
        </Box>

        {/* Right — detail panel */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DetailPanel
            detail={spotDetail}
            isLoading={!!selectedSpotId && detailLoading}
            roId={roId}
            currentSpotId={currentSpotId}
            resolvedZoneName={resolvedZoneName}
            onMove={() => moveMut.mutate()}
            onUnassign={() => unassignMut.mutate()}
            onMoveToDifferentLot={() => setLotPickerOpen(true)}
            isMutating={moveMut.isPending || unassignMut.isPending || pickAndMoveMut.isPending}
          />
        </Box>
      </DialogContent>

      {roId && (
        <LotPickerDialog
          open={lotPickerOpen}
          onClose={() => setLotPickerOpen(false)}
          shopId={shopId}
          onConfirm={(spotId) => {
            if (spotId) pickAndMoveMut.mutate(spotId)
          }}
        />
      )}
    </Dialog>
  )
}
