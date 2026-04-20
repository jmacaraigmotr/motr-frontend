import { Rect } from 'react-konva'

interface LotBoundaryShapeProps {
  x: number
  y: number
  width: number
  height: number
}

// The outer lot boundary rectangle drawn by the admin.
// listening=false — selection is handled at zone level, not boundary level.
export default function LotBoundaryShape({ x, y, width, height }: LotBoundaryShapeProps) {
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(241, 245, 249, 0.6)"
      stroke="#94A3B8"
      strokeWidth={2}
      dash={[10, 5]}
      cornerRadius={4}
      listening={false}
    />
  )
}
