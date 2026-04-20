import React, { useRef, useEffect, useState } from 'react'
import { Group, Rect, Line, Text, Circle, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ZoneCanvasState } from '@/stores/builderStore'

interface ZoneShapeProps {
  zone: ZoneCanvasState
  selected: boolean
  readonly?: boolean
  locked?: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<ZoneCanvasState>) => void
  onDblClick: () => void
}

function SpotCountBadge({
  x,
  y,
  count,
  color,
}: {
  x: number
  y: number
  count: number
  color: string
}) {
  const label = count.toString()
  const badgeW = Math.max(28, label.length * 6 + 12)
  const badgeH = 18
  return (
    <>
      <Rect
        x={x - badgeW}
        y={y}
        width={badgeW}
        height={badgeH}
        fill="rgba(15,23,42,0.92)"
        stroke={color}
        strokeWidth={1}
        cornerRadius={badgeH / 2}
        listening={false}
      />
      <Text
        x={x - badgeW}
        y={y + 3}
        width={badgeW}
        align="center"
        text={label}
        fontSize={11}
        fontStyle="bold"
        fill="#ffffff"
        listening={false}
      />
    </>
  )
}

const SPOT_PAD = 5
const SPOT_GAP = 2
const MIN_CELL = 8

function buildSpotCells(zone: ZoneCanvasState, headerH: number) {
  if (zone.spotCount <= 0) return null

  const cols = Math.max(1, zone.spots_per_row)
  const rows = Math.ceil(zone.spotCount / cols)

  const bodyW = zone.canvas_w - SPOT_PAD * 2
  const bodyH = zone.canvas_h - headerH - SPOT_PAD * 2 - 4
  if (bodyW < MIN_CELL || bodyH < MIN_CELL) return null

  const cellW = Math.floor((bodyW - SPOT_GAP * (cols - 1)) / cols)
  const cellH = Math.floor((bodyH - SPOT_GAP * (rows - 1)) / rows)
  if (cellW < MIN_CELL || cellH < MIN_CELL) return null

  const cells: React.ReactElement[] = []
  let idx = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (idx >= zone.spotCount) break
      const cx = SPOT_PAD + col * (cellW + SPOT_GAP)
      const cy = headerH + SPOT_PAD + 4 + row * (cellH + SPOT_GAP)
      cells.push(
        <Rect
          key={idx}
          x={cx}
          y={cy}
          width={cellW}
          height={cellH}
          fill={zone.color_hex + '40'}
          stroke={zone.color_hex + 'A0'}
          strokeWidth={1}
          cornerRadius={1}
          listening={false}
        />
      )
      idx++
    }
    if (idx >= zone.spotCount) break
  }
  return cells
}

/** Compute bounding box from a flat [x1,y1,x2,y2,...] array */
function polyBBox(pts: number[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i])
    minY = Math.min(minY, pts[i + 1])
    maxX = Math.max(maxX, pts[i])
    maxY = Math.max(maxY, pts[i + 1])
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

// ─── Polygon Zone ─────────────────────────────────────────────────────────────

function PolygonZoneShape({
  zone,
  selected,
  readonly,
  locked,
  onSelect,
  onUpdate,
  onDblClick,
}: ZoneShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const [hovered, setHovered] = useState(false)
  const pts = zone.canvas_points!
  const { minX, minY, maxX, maxY } = polyBBox(pts)
  const borderColor = selected ? '#2563EB' : zone.color_hex
  const HEADER_H = 20

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const dx = Math.round(e.target.x())
    const dy = Math.round(e.target.y())
    e.target.x(0)
    e.target.y(0)
    const newPts = pts.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
    const bb = polyBBox(newPts)
    onUpdate({
      canvas_points: newPts,
      canvas_x: Math.round(bb.minX),
      canvas_y: Math.round(bb.minY),
      canvas_w: Math.round(bb.w),
      canvas_h: Math.round(bb.h),
    })
  }

  // Vertex handles for selected polygon zone
  const vertexHandles = selected && !readonly
    ? Array.from({ length: pts.length / 2 }, (_, i) => (
        <Circle
          key={i}
          x={pts[i * 2]}
          y={pts[i * 2 + 1]}
          radius={5}
          fill="#ffffff"
          stroke="#2563EB"
          strokeWidth={1.5}
          listening={false}
        />
      ))
    : null

  // Spot cells inside bounding box
  const spotCells = zone.spotCount > 0 ? buildSpotCells(
    { ...zone, canvas_x: minX, canvas_y: minY, canvas_w: maxX - minX, canvas_h: maxY - minY },
    HEADER_H,
  )?.map((cell, i) =>
    React.cloneElement(cell, { key: i, x: (cell.props.x ?? 0) + minX, y: (cell.props.y ?? 0) + minY })
  ) : null

  return (
    <Group
      ref={groupRef}
      id={zone.tempId}
      draggable={!readonly && !locked}
      onClick={(e) => { e.cancelBubble = true; onSelect() }}
      onDblClick={(e) => { e.cancelBubble = true; if (!readonly) onDblClick() }}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Filled polygon */}
      <Line
        points={pts}
        closed
        fill={zone.color_hex + '18'}
        stroke={borderColor}
        strokeWidth={selected ? 2 : 1.5}
        lineCap="round"
        lineJoin="round"
      />

      {/* Header + label — visible on hover or selection only */}
      {(hovered || selected) && (
        <>
          <Rect
            x={minX}
            y={minY}
            width={Math.min(maxX - minX, 140)}
            height={HEADER_H}
            fill={zone.color_hex}
            cornerRadius={[3, 3, 0, 0]}
            listening={false}
          />
          {zone.spotCount > 0 && (
            <SpotCountBadge
              x={maxX - 6}
              y={minY + 4}
              count={zone.spotCount}
              color={zone.color_hex}
            />
          )}
          <Text
            x={minX + 5}
            y={minY + 4}
            text={zone.label}
            fontSize={11}
            fontStyle="bold"
            fill="#ffffff"
            width={Math.min(maxX - minX, 140) - 10}
            ellipsis
            listening={false}
          />
        </>
      )}

      {/* Spot grid */}
      {spotCells}

      {/* Vertex handles when selected */}
      {vertexHandles}
    </Group>
  )
}

// ─── Rect Zone (original) ─────────────────────────────────────────────────────

function RectZoneShape({
  zone,
  selected,
  readonly,
  locked,
  onSelect,
  onUpdate,
  onDblClick,
}: ZoneShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!trRef.current) return
    if (selected && groupRef.current) {
      trRef.current.nodes([groupRef.current])
    } else {
      trRef.current.nodes([])
    }
    trRef.current.getLayer()?.batchDraw()
  }, [selected])

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onUpdate({
      canvas_x: Math.round(e.target.x()),
      canvas_y: Math.round(e.target.y()),
    })
  }

  const handleTransformEnd = () => {
    const node = groupRef.current
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    onUpdate({
      canvas_x: Math.round(node.x()),
      canvas_y: Math.round(node.y()),
      canvas_w: Math.max(60, Math.round(zone.canvas_w * scaleX)),
      canvas_h: Math.max(40, Math.round(zone.canvas_h * scaleY)),
    })
  }

  const fillColor = zone.color_hex + '18'
  const borderColor = selected ? '#2563EB' : zone.color_hex
  const headerH = Math.min(26, zone.canvas_h * 0.28)
  const spotCells = buildSpotCells(zone, headerH)

  return (
    <>
      <Group
        ref={groupRef}
        id={zone.tempId}
        x={zone.canvas_x}
        y={zone.canvas_y}
        width={zone.canvas_w}
        height={zone.canvas_h}
        draggable={!readonly && !locked}
        onClick={(e) => { e.cancelBubble = true; onSelect() }}
        onDblClick={(e) => { e.cancelBubble = true; if (!readonly) onDblClick() }}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Rect
          width={zone.canvas_w}
          height={zone.canvas_h}
          fill={fillColor}
          stroke={borderColor}
          strokeWidth={selected ? 2 : 1.5}
          cornerRadius={4}
        />
        {/* Header + label — visible on hover or selection only */}
        {(hovered || selected) && (
          <>
            <Rect
              width={zone.canvas_w}
              height={headerH}
              fill={zone.color_hex}
              cornerRadius={[4, 4, 0, 0]}
            />
            {zone.spotCount > 0 && (
              <SpotCountBadge
                x={zone.canvas_w - 8}
                y={6}
                count={zone.spotCount}
                color={zone.color_hex}
              />
            )}
            <Text
              x={8}
              y={headerH / 2 - 7}
              text={zone.label}
              fontSize={12}
              fontStyle="bold"
              fill="#ffffff"
              width={zone.canvas_w - 16}
              ellipsis
              listening={false}
            />
          </>
        )}
        {spotCells}
      </Group>

      {!readonly && !locked && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio={false}
          enabledAnchors={['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center']}
          anchorSize={8}
          anchorCornerRadius={2}
          borderStroke="#2563EB"
          borderStrokeWidth={1.5}
          anchorStroke="#2563EB"
          anchorFill="#ffffff"
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 60 || newBox.height < 40) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export default function ZoneShape(props: ZoneShapeProps) {
  if (props.zone.canvas_points && props.zone.canvas_points.length >= 6) {
    return <PolygonZoneShape {...props} />
  }
  return <RectZoneShape {...props} />
}
