import { Group, Rect, Line } from 'react-konva'
import type Konva from 'konva'
import type { StructureShape as StructureShapeType } from '@/stores/builderStore'

interface StructureShapeProps {
  shape: StructureShapeType
  selected: boolean
  readonly?: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<StructureShapeType>) => void
}

export default function StructureShape({
  shape,
  selected,
  readonly = false,
  onSelect,
  onUpdate,
}: StructureShapeProps) {
  const strokeColor = selected ? '#2563EB' : shape.color
  const strokeWidth = selected ? 2.5 : 2

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const dx = Math.round(e.target.x())
    const dy = Math.round(e.target.y())
    // Reset the group position — translate the stored coordinates instead
    e.target.x(0)
    e.target.y(0)

    if (shape.type === 'wall' && shape.points) {
      const newPoints = shape.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
      onUpdate({ points: newPoints })
    } else if (shape.type === 'area') {
      onUpdate({ x: Math.round((shape.x ?? 0) + dx), y: Math.round((shape.y ?? 0) + dy) })
    }
  }

  if (shape.type === 'wall') {
    return (
      <Group
        draggable={!readonly}
        onClick={(e) => { e.cancelBubble = true; onSelect() }}
        onDragEnd={handleDragEnd}
      >
        <Line
          points={shape.points ?? []}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          closed
          fill={shape.color + '18'}
          lineCap="round"
          lineJoin="round"
          dash={selected ? [6, 3] : undefined}
        />
      </Group>
    )
  }

  // area (filled rectangle)
  return (
    <Group
      draggable={!readonly}
      onClick={(e) => { e.cancelBubble = true; onSelect() }}
      onDragEnd={handleDragEnd}
    >
      <Rect
        x={shape.x ?? 0}
        y={shape.y ?? 0}
        width={shape.w ?? 0}
        height={shape.h ?? 0}
        fill={shape.color + '28'}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        dash={selected ? [6, 3] : undefined}
        cornerRadius={3}
      />
    </Group>
  )
}
