import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Line, Circle, Image as KonvaImage, Text } from 'react-konva'
import type Konva from 'konva'
import { useBuilderStore, makeSpotLabel } from '@/stores/builderStore'
import type { ZoneCanvasState, StructureShape, CanvasSpot } from '@/stores/builderStore'
import LotBoundaryShape from './LotBoundaryShape'
import ZoneShape from './ZoneShape'
import SpotShape from './SpotShape'
import StructureShapeComponent from './StructureShape'
import GridOverlay from './GridOverlay'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { ZoomIn, ZoomOut, Maximize2, CheckCheck } from 'lucide-react'

const DESIGN_W = 1200
const DESIGN_H = 800
const MIN_DRAW_PX = 30
const INLINE_RENAME_PADDING = 12

const ZONE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

function pointInPolygon(x: number, y: number, pts: number[]): boolean {
  let inside = false
  const n = pts.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1]
    const xj = pts[j * 2], yj = pts[j * 2 + 1]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function findZoneAtPoint(x: number, y: number, zones: ZoneCanvasState[]): ZoneCanvasState | null {
  // Iterate in reverse so topmost zone wins
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i]
    if (z.canvas_points && z.canvas_points.length >= 6) {
      if (pointInPolygon(x, y, z.canvas_points)) return z
    } else {
      if (x >= z.canvas_x && x <= z.canvas_x + z.canvas_w &&
          y >= z.canvas_y && y <= z.canvas_y + z.canvas_h) return z
    }
  }
  return null
}

function nextSpotLabel(layoutLabel: string, zone: ZoneCanvasState, zoneSpots: CanvasSpot[]): string {
  return makeSpotLabel(layoutLabel, zone.label, zoneSpots.length + 1)
}

// ─── Types ───────────────────────────────────────────────────────────────────────

interface DrawState {
  startX: number
  startY: number
  x: number
  y: number
  w: number
  h: number
}

interface RenameState {
  tempId: string
  label: string
  x: number
  y: number
  w: number
}

// spot id → { isOccupied, jobLabel } — passed in by live/spot-map views
export interface SpotLiveData {
  isOccupied: boolean
  jobLabel: string | null  // e.g. "#42" or null when vacant
}

interface BuilderCanvasProps {
  readonly?: boolean
  spotLiveData?: Record<number, SpotLiveData>
}

// ─── Component ───────────────────────────────────────────────────────────────────

export default function BuilderCanvas({ readonly = false, spotLiveData }: BuilderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [fitScale, setFitScale] = useState(1)
  const [stageSize, setStageSize] = useState({ w: DESIGN_W, h: DESIGN_H })
  const [zoomLevel, setZoomLevel] = useState(1)
  const [stageOffset, setStageOffset] = useState({ x: 0, y: 0 })

  // Rect draw state (zone, spot)
  const [drawState, setDrawState] = useState<DrawState | null>(null)

  // Zone tempId captured at spot-draw start so the spot is assigned to the right zone
  const [spotDrawZoneTempId, setSpotDrawZoneTempId] = useState<string | null>(null)

  // Zone-poly cursor tracking
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Inline rename for zones
  const [renameState, setRenameState] = useState<RenameState | null>(null)

  useEffect(() => {
    if (readonly && renameState) {
      setRenameState(null)
    }
  }, [readonly, renameState])

  // Background image element
  const [bgImgEl, setBgImgEl] = useState<HTMLImageElement | null>(null)

  const {
    boundary, zones, structures, canvasSpots, layoutLabel,
    zonePolyInProgress, spotPolyInProgress,
    selectedTempId, selectedStructureId, selectedSpotTempId,
    toolMode, backgroundImage, backgroundOpacity, bgX, bgY, bgW, bgH,
    zonesLocked, showZoneLabels, showSpotLabels,
    setBoundary, addZone, updateZone, deleteZone,
    addStructure, updateStructure, deleteStructure,
    addCanvasSpot, updateCanvasSpot, deleteCanvasSpot,
    addZonePolyPoint, finishZonePoly, cancelZonePoly,
    addSpotPolyPoint, finishSpotPoly, cancelSpotPoly,
    setSelected, setSelectedStructure, setSelectedSpot, setToolMode,
    setBackgroundTransform,
  } = useBuilderStore()

  // Local ref to track which zone the in-progress spot poly belongs to
  const spotPolyZoneRef = useRef<string | null>(null)

  // ── Background image ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!backgroundImage) { setBgImgEl(null); return }
    const img = new window.Image()
    img.onload = () => {
      setBgImgEl(img)
      // Set default transform to fit the design canvas if not yet positioned
      const { bgW: w } = useBuilderStore.getState()
      if (w === 0) {
        const scale = Math.min(DESIGN_W / img.naturalWidth, DESIGN_H / img.naturalHeight)
        setBackgroundTransform(0, 0, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale))
      }
    }
    img.src = backgroundImage
  }, [backgroundImage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Responsive scaling ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w === 0) return
      const s = w / DESIGN_W
      setFitScale(s)
      setStageSize({ w, h: Math.round(DESIGN_H * s) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readonly) return
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSpotTempId) deleteCanvasSpot(selectedSpotTempId)
        else if (selectedTempId) deleteZone(selectedTempId)
        if (selectedStructureId) deleteStructure(selectedStructureId)
      }
      if (e.key === 'Enter' && toolMode === 'draw-zone-poly') {
        const color = ZONE_COLORS[zones.length % ZONE_COLORS.length]
        finishZonePoly(color)
        setToolMode('select')
      }
      if (e.key === 'Enter' && toolMode === 'draw-spot-poly') {
        const count = spotPolyInProgress.length / 2
        if (count >= 3 && spotPolyZoneRef.current) {
          finishSpotPoly(spotPolyZoneRef.current)
          spotPolyZoneRef.current = null
          setToolMode('select')
        }
      }
      if (e.key === 'Escape') {
        if (toolMode === 'draw-zone-poly' && zonePolyInProgress.length > 0) {
          cancelZonePoly()
        } else if (toolMode === 'draw-spot-poly' && spotPolyInProgress.length > 0) {
          cancelSpotPoly()
          spotPolyZoneRef.current = null
        } else {
          setSelected(null)
          setSelectedStructure(null)
          setSelectedSpot(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readonly, selectedTempId, selectedStructureId, selectedSpotTempId, toolMode,
      zonePolyInProgress, spotPolyInProgress, zones.length,
      deleteZone, deleteStructure, deleteCanvasSpot,
      finishZonePoly, cancelZonePoly, finishSpotPoly, cancelSpotPoly,
      setSelected, setSelectedStructure, setSelectedSpot, setToolMode])

  // ── Coordinate helpers ────────────────────────────────────────────────────────

  const effectiveScale = fitScale * zoomLevel

  const toDesign = useCallback(
    (stage: Konva.Stage): { x: number; y: number } => {
      const p = stage.getPointerPosition()!
      return {
        x: Math.round((p.x - stageOffset.x) / effectiveScale),
        y: Math.round((p.y - stageOffset.y) / effectiveScale),
      }
    },
    [effectiveScale, stageOffset],
  )

  // ── Zoom controls ─────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()!
    const scaleBy = 1.12
    const oldScale = effectiveScale
    const pointer = stage.getPointerPosition()!

    const newZoom = e.evt.deltaY < 0
      ? Math.min(4, zoomLevel * scaleBy)
      : Math.max(0.2, zoomLevel / scaleBy)

    const newScale = fitScale * newZoom
    const mousePointTo = {
      x: (pointer.x - stageOffset.x) / oldScale,
      y: (pointer.y - stageOffset.y) / oldScale,
    }

    setZoomLevel(newZoom)
    setStageOffset({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }, [effectiveScale, fitScale, zoomLevel, stageOffset])

  const zoomIn = () => {
    const newZoom = Math.min(4, zoomLevel * 1.25)
    setZoomLevel(newZoom)
  }

  const zoomOut = () => {
    const newZoom = Math.max(0.2, zoomLevel / 1.25)
    setZoomLevel(newZoom)
  }

  const resetZoom = () => {
    setZoomLevel(1)
    setStageOffset({ x: 0, y: 0 })
  }

  // ── Stage event handlers ──────────────────────────────────────────────────────

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readonly) return
    const isBackground = e.target === e.target.getStage()

    if (toolMode === 'draw-spot-poly') {
      const stage = e.target.getStage()
      if (stage) {
        const { x, y } = toDesign(stage)
        if (spotPolyInProgress.length === 0) {
          // First click: detect which zone we're drawing into
          const zone = findZoneAtPoint(x, y, zones)
          if (zone) {
            spotPolyZoneRef.current = zone.tempId
            addSpotPolyPoint(x, y)
          }
        } else {
          addSpotPolyPoint(x, y)
        }
      }
      return
    }

    if (toolMode === 'draw-zone-poly') {
      if (isBackground) {
        const { x, y } = toDesign(e.target.getStage()!)
        addZonePolyPoint(x, y)
      }
      return
    }

    if (toolMode === 'place-spot') {
      const stage = e.target.getStage()
      if (stage) {
        const { x, y } = toDesign(stage)
        const zone = findZoneAtPoint(x, y, zones)
        if (zone) {
          setSpotDrawZoneTempId(zone.tempId)
          setDrawState({ startX: x, startY: y, x, y, w: 0, h: 0 })
        }
      }
      return
    }

    if (toolMode === 'draw-zone') {
      if (!isBackground) return
      const { x, y } = toDesign(e.target.getStage()!)
      setDrawState({ startX: x, startY: y, x, y, w: 0, h: 0 })
      setSelected(null)
      setSelectedStructure(null)
      setSelectedSpot(null)
    }
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()!
    const pos = toDesign(stage)

    if (toolMode === 'draw-zone-poly' || toolMode === 'draw-spot-poly') {
      setCursorPos(pos)
      return
    }

    if (!drawState) return
    setDrawState({
      ...drawState,
      x: Math.min(drawState.startX, pos.x),
      y: Math.min(drawState.startY, pos.y),
      w: Math.abs(pos.x - drawState.startX),
      h: Math.abs(pos.y - drawState.startY),
    })
  }

  const openRename = useCallback((zone: ZoneCanvasState) => {
    if (readonly) return
    if (toolMode === 'place-spot' || toolMode === 'draw-spot-poly') return
    setRenameState({
      tempId: zone.tempId,
      label: zone.label,
      x: zone.canvas_x + INLINE_RENAME_PADDING / 2,
      y: zone.canvas_y + INLINE_RENAME_PADDING / 2,
      w: Math.max(60, zone.canvas_w - INLINE_RENAME_PADDING),
    })
  }, [readonly, toolMode])

  const handleMouseUp = () => {
    if (!drawState) return
    const { x, y, w, h } = drawState

    if (toolMode === 'draw-zone' && w > MIN_DRAW_PX && h > MIN_DRAW_PX) {
      const newZone: ZoneCanvasState = {
        id: 0,
        tempId: crypto.randomUUID(),
        label: `Zone ${zones.length + 1}`,
        color_hex: ZONE_COLORS[zones.length % ZONE_COLORS.length],
        canvas_x: x, canvas_y: y, canvas_w: w, canvas_h: h,
        spots_per_row: 4,
        icon_type: 'outdoor',
        spotCount: 0,
      }
      addZone(newZone)
    } else if (toolMode === 'place-spot' && spotDrawZoneTempId && w > 8 && h > 8) {
      const zone = zones.find((z) => z.tempId === spotDrawZoneTempId)
      if (zone) {
        const zoneSpots = canvasSpots.filter((s) => s.zoneTempId === zone.tempId)
        addCanvasSpot({
          id: 0,
          tempId: crypto.randomUUID(),
          zoneTempId: zone.tempId,
          label: nextSpotLabel(layoutLabel, zone, zoneSpots),
          spot_type: 'standard',
          canvas_x: x,
          canvas_y: y,
          canvas_w: w,
          canvas_h: h,
        })
      }
      setSpotDrawZoneTempId(null)
    }

    setDrawState(null)
  }

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage() && toolMode === 'select') {
      setSelected(null)
      setSelectedStructure(null)
      setSelectedSpot(null)
    }
  }

  // ── Stage drag (pan mode) ─────────────────────────────────────────────────────

  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (toolMode === 'pan') {
      setStageOffset({ x: e.target.x(), y: e.target.y() })
    }
  }

  // ── Cursor style ──────────────────────────────────────────────────────────────

  const BLACK_CROSSHAIR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cline x1='10' y1='1' x2='10' y2='8' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='10' y1='12' x2='10' y2='19' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='1' y1='10' x2='8' y2='10' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='12' y1='10' x2='19' y2='10' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\") 10 10, crosshair"

  const cursorStyle =
    ['draw-zone', 'draw-zone-poly', 'place-spot', 'draw-spot-poly'].includes(toolMode)
      ? BLACK_CROSSHAIR
      : toolMode === 'pan' ? 'grab'
      : 'default'

  const previewColors: Record<string, { fill: string; stroke: string }> = {
    'draw-zone':   { fill: 'rgba(59,130,246,0.10)',  stroke: '#3B82F6' },
    'place-spot':  { fill: 'rgba(34,197,94,0.15)',   stroke: '#22C55E' },
  }
  const preview = previewColors[toolMode]

  // ── Zone-poly in-progress helpers ─────────────────────────────────────

  const zonePolyPtCount = zonePolyInProgress.length / 2
  const lastZonePolyX = zonePolyInProgress[zonePolyInProgress.length - 2]
  const lastZonePolyY = zonePolyInProgress[zonePolyInProgress.length - 1]
  const zonePolyColor = ZONE_COLORS[zones.length % ZONE_COLORS.length]
  const zonePolyAngleRad =
    cursorPos && zonePolyInProgress.length >= 2
      ? Math.atan2(cursorPos.y - lastZonePolyY, cursorPos.x - lastZonePolyX)
      : null
  const zonePolyAngleDeg =
    zonePolyAngleRad !== null ? ((zonePolyAngleRad * 180) / Math.PI + 360) % 360 : null
  const zonePolyAngleLabel =
    zonePolyAngleDeg !== null ? `${(Math.round(zonePolyAngleDeg * 10) / 10).toFixed(1)}°` : null
  const zonePolyLabelWidth = zonePolyAngleLabel ? Math.max(32, zonePolyAngleLabel.length * 6.5 + 10) : 0
  const zonePolyLabelHeight = 18
  const zonePolyMidX = zonePolyAngleLabel && cursorPos ? (lastZonePolyX + cursorPos.x) / 2 : 0
  const zonePolyMidY = zonePolyAngleLabel && cursorPos ? (lastZonePolyY + cursorPos.y) / 2 : 0
  const zonePolyLabelX = zonePolyAngleLabel ? zonePolyMidX - zonePolyLabelWidth / 2 : 0
  const zonePolyLabelY = zonePolyAngleLabel ? zonePolyMidY - zonePolyLabelHeight - 8 : 0

  // ── Spot-poly in-progress helpers ─────────────────────────────────────────────

  const spotPolyPtCount = spotPolyInProgress.length / 2
  const lastSpotPolyX = spotPolyInProgress[spotPolyInProgress.length - 2]
  const lastSpotPolyY = spotPolyInProgress[spotPolyInProgress.length - 1]
  const SPOT_POLY_COLOR = '#22C55E'

  // ── Background image display dimensions ───────────────────────────────────────

  const bgDisplayW = bgW > 0 ? bgW : (bgImgEl?.naturalWidth ?? 0)
  const bgDisplayH = bgH > 0 ? bgH : (bgImgEl?.naturalHeight ?? 0)

  return (
    <div ref={containerRef} style={{ width: '100%', userSelect: 'none', position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={stageSize.w}
        height={stageSize.h}
        scaleX={effectiveScale}
        scaleY={effectiveScale}
        x={stageOffset.x}
        y={stageOffset.y}
        draggable={toolMode === 'pan'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        style={{ cursor: cursorStyle, display: 'block' }}
      >
        <Layer>
          {/* Background reference image */}
          {bgImgEl && bgDisplayW > 0 && (
            <KonvaImage
              image={bgImgEl}
              x={bgX}
              y={bgY}
              width={bgDisplayW}
              height={bgDisplayH}
              opacity={backgroundOpacity}
              listening={false}
            />
          )}

          {/* Dot grid */}
          <GridOverlay width={DESIGN_W} height={DESIGN_H} />

          {/* Lot boundary */}
          {boundary && (
            <LotBoundaryShape x={boundary.x} y={boundary.y} width={boundary.w} height={boundary.h} />
          )}

          {/* Structure shapes — rendered BELOW zones */}
          {structures.map((s) => (
            <StructureShapeComponent
              key={s.id}
              shape={s}
              selected={selectedStructureId === s.id}
              readonly={readonly}
              onSelect={() => setSelectedStructure(s.id)}
              onUpdate={(updates) => updateStructure(s.id, updates)}
            />
          ))}

          {/* Zone shapes */}
          {zones.map((zone) => (
            <ZoneShape
              key={zone.tempId}
              zone={zone}
              selected={selectedTempId === zone.tempId}
              readonly={readonly}
              locked={zonesLocked}
              suppressLabel={toolMode === 'place-spot' || toolMode === 'draw-spot-poly'}
              onSelect={() => setSelected(zone.tempId)}
              onUpdate={(updates) => updateZone(zone.tempId, updates)}
              onDblClick={() => openRename(zone)}
            />
          ))}

          {/* Canvas spots */}
          {canvasSpots.map((spot) => {
            const zone = zones.find((z) => z.tempId === spot.zoneTempId)
            const live = spotLiveData?.[spot.id]
            return (
              <SpotShape
                key={spot.tempId}
                spot={spot}
                zone={zone}
                selected={selectedSpotTempId === spot.tempId}
                readonly={readonly}
                preview={readonly}
                showLabel={showSpotLabels}
                liveLabel={live !== undefined ? live.jobLabel : undefined}
                isOccupied={live?.isOccupied}
                onSelect={() => setSelectedSpot(spot.tempId)}
                onUpdate={(updates) => updateCanvasSpot(spot.tempId, updates)}
              />
            )
          })}

          {/* Rectangle draw preview (lot / zone / area / wall) */}
          {drawState && drawState.w > 2 && preview && (
            <Rect
              x={drawState.x} y={drawState.y}
              width={drawState.w} height={drawState.h}
              fill={preview.fill}
              stroke={preview.stroke}
              strokeWidth={2}
              dash={[8, 5]}
              listening={false}
            />
          )}

          {/* Polygon zone in progress */}
          {toolMode === 'draw-zone-poly' && zonePolyInProgress.length >= 2 && (
            <>
              <Line
                points={zonePolyInProgress}
                stroke={zonePolyColor}
                strokeWidth={2.5}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
              {cursorPos && (
                <Line
                  points={[lastZonePolyX, lastZonePolyY, cursorPos.x, cursorPos.y]}
                  stroke={zonePolyColor}
                  strokeWidth={2}
                  dash={[5, 4]}
                  opacity={0.5}
                  listening={false}
                />
              )}
              {Array.from({ length: zonePolyPtCount }, (_, i) => (
                <Circle
                  key={i}
                  x={zonePolyInProgress[i * 2]}
                  y={zonePolyInProgress[i * 2 + 1]}
                  radius={4}
                  fill="#ffffff"
                  stroke={zonePolyColor}
                  strokeWidth={2}
                  listening={false}
                />
              ))}
              {zonePolyPtCount >= 3 && cursorPos && (
                <Circle
                  x={zonePolyInProgress[0]}
                  y={zonePolyInProgress[1]}
                  radius={7}
                  stroke={zonePolyColor}
                  strokeWidth={1.5}
                  fill="transparent"
                  dash={[3, 2]}
                  listening={false}
                />
              )}
              {zonePolyAngleLabel && (
                <>
                  <Rect
                    x={zonePolyLabelX}
                    y={zonePolyLabelY}
                    width={zonePolyLabelWidth}
                    height={zonePolyLabelHeight}
                    fill="rgba(15,23,42,0.85)"
                    cornerRadius={4}
                    listening={false}
                  />
                  <Text
                    x={zonePolyLabelX}
                    y={zonePolyLabelY}
                    width={zonePolyLabelWidth}
                    height={zonePolyLabelHeight}
                    text={zonePolyAngleLabel}
                    fontSize={12}
                    fill="#fff"
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                </>
              )}
            </>
          )}

          {/* Polygon spot in progress */}
          {toolMode === 'draw-spot-poly' && spotPolyInProgress.length >= 2 && (
            <>
              <Line
                points={spotPolyInProgress}
                stroke={SPOT_POLY_COLOR}
                strokeWidth={2.5}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
              {cursorPos && (
                <Line
                  points={[lastSpotPolyX, lastSpotPolyY, cursorPos.x, cursorPos.y]}
                  stroke={SPOT_POLY_COLOR}
                  strokeWidth={2}
                  dash={[5, 4]}
                  opacity={0.5}
                  listening={false}
                />
              )}
              {Array.from({ length: spotPolyPtCount }, (_, i) => (
                <Circle
                  key={i}
                  x={spotPolyInProgress[i * 2]}
                  y={spotPolyInProgress[i * 2 + 1]}
                  radius={3}
                  fill="#ffffff"
                  stroke={SPOT_POLY_COLOR}
                  strokeWidth={2}
                  listening={false}
                />
              ))}
              {spotPolyPtCount >= 3 && cursorPos && (
                <Circle
                  x={spotPolyInProgress[0]}
                  y={spotPolyInProgress[1]}
                  radius={6}
                  stroke={SPOT_POLY_COLOR}
                  strokeWidth={1.5}
                  fill="transparent"
                  dash={[3, 2]}
                  listening={false}
                />
              )}
            </>
          )}

        </Layer>
      </Stage>

      {renameState && (
        <Box
          sx={{
            position: 'absolute',
            left: stageOffset.x + renameState.x * effectiveScale,
            top: stageOffset.y + renameState.y * effectiveScale,
            width: Math.max(80, renameState.w * effectiveScale),
            zIndex: 10,
          }}
        >
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameState.label}
            onChange={(e) => setRenameState((prev) => prev ? { ...prev, label: e.target.value } : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameState.label.trim()) {
                updateZone(renameState.tempId, { label: renameState.label.trim() })
                setRenameState(null)
              } else if (e.key === 'Escape') {
                setRenameState(null)
              }
            }}
            onBlur={() => {
              if (!renameState.label.trim()) {
                setRenameState(null)
                return
              }
              updateZone(renameState.tempId, { label: renameState.label.trim() })
              setRenameState(null)
            }}
            InputProps={{ sx: { fontSize: '0.8rem', py: 0.25, bgcolor: 'background.paper' } }}
          />
        </Box>
      )}

      {/* Floating Finish Zone button — shown when drawing a polygon zone */}
      {toolMode === 'draw-zone-poly' && (
        <Box sx={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider',
          borderRadius: 2, px: 1.5, py: 0.75,
          boxShadow: 2,
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
            {zonePolyPtCount} point{zonePolyPtCount !== 1 ? 's' : ''}
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCheck size={13} />}
            onClick={() => {
              const color = ZONE_COLORS[zones.length % ZONE_COLORS.length]
              finishZonePoly(color)
              setToolMode('select')
            }}
            disabled={zonePolyPtCount < 3}
            sx={{ borderRadius: 1.5, py: 0.35, fontSize: '0.75rem' }}
          >
            {zonePolyPtCount < 3 ? `Need ${3 - zonePolyPtCount} more` : 'Finish Zone'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => { cancelZonePoly(); setToolMode('select') }}
            sx={{ borderRadius: 1.5, py: 0.35, fontSize: '0.75rem' }}
          >
            Cancel
          </Button>
        </Box>
      )}

      {/* Floating Finish Spot button — shown when drawing a polygon spot */}
      {toolMode === 'draw-spot-poly' && (
        <Box sx={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider',
          borderRadius: 2, px: 1.5, py: 0.75,
          boxShadow: 2,
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
            {spotPolyPtCount} point{spotPolyPtCount !== 1 ? 's' : ''}
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCheck size={13} />}
            onClick={() => {
              if (spotPolyPtCount >= 3 && spotPolyZoneRef.current) {
                finishSpotPoly(spotPolyZoneRef.current)
                spotPolyZoneRef.current = null
                setToolMode('select')
              }
            }}
            disabled={spotPolyPtCount < 3 || !spotPolyZoneRef.current}
            sx={{ borderRadius: 1.5, py: 0.35, fontSize: '0.75rem' }}
          >
            {spotPolyPtCount < 3 ? `Need ${3 - spotPolyPtCount} more` : 'Finish Spot'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => { cancelSpotPoly(); spotPolyZoneRef.current = null; setToolMode('select') }}
            sx={{ borderRadius: 1.5, py: 0.35, fontSize: '0.75rem' }}
          >
            Cancel
          </Button>
        </Box>
      )}

      {/* Floating zoom controls */}
      <Box sx={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', alignItems: 'center', gap: 0.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 0.75, py: 0.5,
        boxShadow: 1,
      }}>
        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={zoomOut} sx={{ p: 0.5 }}>
            <ZoomOut size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset zoom (100%)">
          <Typography
            variant="caption"
            fontWeight={700}
            onClick={resetZoom}
            sx={{ fontSize: '0.7rem', minWidth: 32, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
          >
            {Math.round(zoomLevel * 100)}%
          </Typography>
        </Tooltip>
        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={zoomIn} sx={{ p: 0.5 }}>
            <ZoomIn size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit to view">
          <IconButton size="small" onClick={resetZoom} sx={{ p: 0.5 }}>
            <Maximize2 size={14} />
          </IconButton>
        </Tooltip>
      </Box>
    </div>
  )
}
