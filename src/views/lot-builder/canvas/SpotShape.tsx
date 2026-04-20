import { Group, Rect, Text, Line } from 'react-konva'
import type Konva from 'konva'
import type { CanvasSpot, ZoneCanvasState } from '@/stores/builderStore'

interface SpotShapeProps {
  spot: CanvasSpot
  zone?: ZoneCanvasState
  selected: boolean
  readonly?: boolean
  preview?: boolean
  showLabel?: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<CanvasSpot>) => void
}

export default function SpotShape({
  spot, zone, selected, readonly = false, preview = false, showLabel = true, onSelect, onUpdate,
}: SpotShapeProps) {
  const color = zone?.color_hex ?? '#3B82F6'
  const previewFill: Record<CanvasSpot['spot_type'], string> = {
    standard: '#22C55E', accessible: '#2563EB', oversized: '#F97316', reserved: '#F43F5E',
  }
  const base = preview ? previewFill[spot.spot_type] : color
  const borderColor = selected && !preview ? '#2563EB' : base

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (spot.canvas_points) {
      const dx = Math.round(e.target.x())
      const dy = Math.round(e.target.y())
      e.target.x(0)
      e.target.y(0)
      const newPts = spot.canvas_points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < newPts.length; i += 2) {
        minX = Math.min(minX, newPts[i]); minY = Math.min(minY, newPts[i + 1])
        maxX = Math.max(maxX, newPts[i]); maxY = Math.max(maxY, newPts[i + 1])
      }
      onUpdate({ canvas_points: newPts, canvas_x: Math.round(minX), canvas_y: Math.round(minY), canvas_w: Math.round(maxX - minX), canvas_h: Math.round(maxY - minY) })
    } else {
      onUpdate({ canvas_x: Math.round(e.target.x()), canvas_y: Math.round(e.target.y()) })
    }
  }

  const isPoly = spot.canvas_points && spot.canvas_points.length >= 6

  if (isPoly) {
    const cx = spot.canvas_x + spot.canvas_w / 2
    const cy = spot.canvas_y + spot.canvas_h / 2
    return (
      <Group
        draggable={!readonly}
        onClick={(e) => { e.cancelBubble = true; onSelect() }}
        onDragEnd={handleDragEnd}
      >
        <Line
          points={spot.canvas_points!}
          closed
          fill={preview ? base + 'CC' : base + (selected ? '30' : '18')}
          stroke={borderColor}
          strokeWidth={selected ? 2 : 1.5}
          lineCap="round"
          lineJoin="round"
        />
        {showLabel && (
          <Text
            x={cx - 20}
            y={cy - 6}
            width={40}
            text={spot.label}
            fontSize={9}
            fontStyle="bold"
            fill={preview ? '#0f172a' : (selected ? '#2563EB' : color)}
            align="center"
            listening={false}
          />
        )}
      </Group>
    )
  }

  return (
    <Group
      x={spot.canvas_x}
      y={spot.canvas_y}
      draggable={!readonly}
      onClick={(e) => { e.cancelBubble = true; onSelect() }}
      onDragEnd={handleDragEnd}
    >
      <Rect
        width={spot.canvas_w}
        height={spot.canvas_h}
        fill={preview ? base + 'CC' : base + (selected ? '30' : '18')}
        stroke={borderColor}
        strokeWidth={selected ? 2 : 1.5}
        cornerRadius={2}
      />
      {showLabel && (
        <Text
          text={spot.label}
          fontSize={9}
          fontStyle="bold"
          fill={preview ? '#0f172a' : (selected ? '#2563EB' : color)}
          width={spot.canvas_w}
          align="center"
          y={spot.canvas_h / 2 - 6}
          listening={false}
        />
      )}
      {spot.spot_type !== 'standard' && (
        <Rect
          x={spot.canvas_w - 7} y={3} width={4} height={4}
          fill={spot.spot_type === 'accessible' ? '#2563EB' : spot.spot_type === 'oversized' ? '#F59E0B' : '#EF4444'}
          cornerRadius={1} listening={false}
        />
      )}
    </Group>
  )
}
