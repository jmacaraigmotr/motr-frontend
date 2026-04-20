import { Shape } from 'react-konva'
import type Konva from 'konva'

interface GridOverlayProps {
  width: number
  height: number
  step?: number
}

// Renders a dot-grid background using native Canvas API for performance.
// listening=false so it never intercepts mouse events.
export default function GridOverlay({ width, height, step = 40 }: GridOverlayProps) {
  const draw = (ctx: Konva.Context, shape: Konva.Shape) => {
    const canvas = ctx.canvas as unknown as HTMLCanvasElement
    const nativeCtx = canvas.getContext('2d')
    if (!nativeCtx) return
    nativeCtx.fillStyle = 'rgba(148, 163, 184, 0.45)'
    for (let x = step; x < width; x += step) {
      for (let y = step; y < height; y += step) {
        nativeCtx.beginPath()
        nativeCtx.arc(x, y, 1.5, 0, Math.PI * 2)
        nativeCtx.fill()
      }
    }
    ctx.fillStrokeShape(shape)
  }

  return <Shape sceneFunc={draw} listening={false} />
}
