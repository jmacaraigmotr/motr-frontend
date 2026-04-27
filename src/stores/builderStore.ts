import { create } from 'zustand'
import type { Zone, LotLayout, ZoneIconType, SpotType } from '@/api/lot'

// ─── Structure shapes ───────────────────────────────────────────────────────────

export interface StructureShape {
  id: string
  type: 'wall' | 'area'
  color: string
  label?: string
  // wall: closed polygon — flat [x1,y1,x2,y2,...] in design-space pixels
  points?: number[]
  // area: filled rectangle
  x?: number
  y?: number
  w?: number
  h?: number
}

// ─── Zone canvas state ──────────────────────────────────────────────────────────

export interface BoundaryRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ZoneCanvasState {
  id: number           // 0 = not yet saved to DB
  tempId: string       // stable client-side UUID (never changes during session)
  label: string
  color_hex: string
  canvas_x: number
  canvas_y: number
  canvas_w: number
  canvas_h: number
  // Polygon zone: flat [x1,y1,x2,y2,...] in design-space pixels.
  // When set, the zone is drawn as a closed polygon instead of a rectangle.
  // canvas_x/y/w/h store the bounding box for API compatibility.
  canvas_points?: number[]
  spots_per_row: number
  icon_type: ZoneIconType
  spotCount: number    // derived; excluded from history snapshots
}

// ─── Canvas spots ────────────────────────────────────────────────────────────────
// Individually placed spots on the canvas. Each has explicit x/y coordinates
// instead of relying on the zone's row/col grid.

export interface CanvasSpot {
  id: number           // 0 = not yet saved to DB
  tempId: string       // stable client-side UUID
  zoneTempId: string   // references ZoneCanvasState.tempId
  label: string
  spot_type: SpotType
  canvas_x: number
  canvas_y: number
  canvas_w: number     // default SPOT_W (28)
  canvas_h: number     // default SPOT_H (46)
  canvas_points?: number[]   // flat [x1,y1,...] polygon; when set, spot is drawn as polygon
}

// ─── History ────────────────────────────────────────────────────────────────────

interface BuilderSnapshot {
  boundary: BoundaryRect | null
  zones: ZoneCanvasState[]
  structures: StructureShape[]
  canvasSpots: CanvasSpot[]
}

export type ToolMode =
  | 'select'
  | 'draw-lot'
  | 'draw-zone'
  | 'draw-zone-poly'
  | 'draw-wall'
  | 'draw-area'
  | 'place-spot'
  | 'draw-spot-poly'
  | 'pan'

const MAX_HISTORY = 50

// ─── Store interface ────────────────────────────────────────────────────────────

interface BuilderStore {
  layoutId: number | null
  layoutLabel: string
  canvasWidth: number
  canvasHeight: number

  boundary: BoundaryRect | null
  zones: ZoneCanvasState[]
  structures: StructureShape[]
  canvasSpots: CanvasSpot[]

  // Background reference image (blueprint / lot photo).
  // Stored as a data URL. Not included in undo snapshots (it's layout metadata).
  backgroundImage: string | null
  backgroundOpacity: number   // 0–1
  bgX: number                 // design-space position
  bgY: number
  bgW: number                 // 0 = use natural image dimensions
  bgH: number

  // Polygon zone drawing in progress
  zonePolyInProgress: number[]

  // Polygon spot drawing in progress
  spotPolyInProgress: number[]

  selectedTempId: string | null       // selected zone
  selectedStructureId: string | null  // selected structure
  selectedSpotTempId: string | null   // selected canvas spot
  toolMode: ToolMode
  zonesLocked: boolean
  showZoneLabels: boolean
  showSpotLabels: boolean
  dirtySpotTempIds: string[]          // spots modified since last save
  deletedSpotIds: number[]            // saved spot IDs deleted since last save
  isDirty: boolean

  history: BuilderSnapshot[]
  histCursor: number
  canUndo: boolean
  canRedo: boolean

  // Layout lifecycle
  loadLayout: (layout: LotLayout, zones: Zone[]) => void
  loadCanvasSpots: (
    rawSpots: Array<{
      id: number; zone_id: number; name: string; spot_type: string
      canvas_x?: number | null; canvas_y?: number | null
      canvas_w?: number | null; canvas_h?: number | null
    }>,
    zoneIdToTempId: Record<number, string>,
  ) => void
  reset: () => void
  markClean: () => void

  // Background
  setBackgroundImage: (url: string | null) => void
  setBackgroundOpacity: (v: number) => void
  setBackgroundTransform: (x: number, y: number, w: number, h: number) => void

  // Boundary
  setBoundary: (rect: BoundaryRect) => void

  // Zones
  addZone: (zone: ZoneCanvasState) => void
  updateZone: (tempId: string, updates: Partial<ZoneCanvasState>) => void
  deleteZone: (tempId: string) => void
  updateSpotCount: (tempId: string, count: number) => void

  // Structures
  addStructure: (s: StructureShape) => void
  updateStructure: (id: string, updates: Partial<StructureShape>) => void
  deleteStructure: (id: string) => void

  // Canvas spots
  addCanvasSpot: (spot: CanvasSpot) => void
  updateCanvasSpot: (tempId: string, updates: Partial<CanvasSpot>) => void
  deleteCanvasSpot: (tempId: string) => void

  // Polygon zone drawing
  addZonePolyPoint: (x: number, y: number) => void
  removeLastZonePolyPoint: () => void
  finishZonePoly: (color: string) => void
  cancelZonePoly: () => void

  // Polygon spot drawing
  addSpotPolyPoint: (x: number, y: number) => void
  removeLastSpotPolyPoint: () => void
  finishSpotPoly: (zoneTempId: string) => void
  cancelSpotPoly: () => void

  // Selection
  setSelected: (tempId: string | null) => void
  setSelectedStructure: (id: string | null) => void
  setSelectedSpot: (tempId: string | null) => void

  // Tool mode
  setToolMode: (mode: ToolMode) => void
  setZonesLocked: (v: boolean) => void
  setShowZoneLabels: (v: boolean) => void
  setShowSpotLabels: (v: boolean) => void

  // Undo / redo
  undo: () => void
  redo: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeSnapshot(
  boundary: BoundaryRect | null,
  zones: ZoneCanvasState[],
  structures: StructureShape[],
  canvasSpots: CanvasSpot[],
): BuilderSnapshot {
  return {
    boundary: boundary ? { ...boundary } : null,
    zones: zones.map((z) => ({ ...z })),
    structures: structures.map((s) => ({ ...s })),
    canvasSpots: canvasSpots.map((s) => ({ ...s })),
  }
}

function pushHistory(
  history: BuilderSnapshot[],
  cursor: number,
  snap: BuilderSnapshot,
): [BuilderSnapshot[], number] {
  const trimmed = history.slice(0, cursor + 1)
  const next = [...trimmed, snap].slice(-MAX_HISTORY)
  return [next, next.length - 1]
}

function parseStructures(raw: string | null | undefined): StructureShape[] {
  if (!raw) return []
  try { return JSON.parse(raw) as StructureShape[] } catch { return [] }
}

// ─── Spot label ────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')
}

export function makeSpotLabel(layoutLabel: string, zoneLabel: string, n: number): string {
  const lot  = slugify(layoutLabel)  || 'Lot'
  const zone = slugify(zoneLabel)    || 'Zone'
  return `${lot}_${zone}_${n}`
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useBuilderStore = create<BuilderStore>((set, get) => ({
  layoutId: null,
  layoutLabel: '',
  canvasWidth: 1200,
  canvasHeight: 800,
  boundary: null,
  zones: [],
  structures: [],
  canvasSpots: [],
  backgroundImage: null,
  backgroundOpacity: 0.4,
  bgX: 0,
  bgY: 0,
  bgW: 0,
  bgH: 0,
  zonePolyInProgress: [],
  spotPolyInProgress: [],
  selectedTempId: null,
  selectedStructureId: null,
  selectedSpotTempId: null,
  toolMode: 'select',
  zonesLocked: false,
  showZoneLabels: true,
  showSpotLabels: true,
  dirtySpotTempIds: [],
  deletedSpotIds: [],
  isDirty: false,
  history: [],
  histCursor: -1,
  canUndo: false,
  canRedo: false,

  // ── Layout lifecycle ────────────────────────────────────────────────────────

  loadLayout: (layout, dbZones) => {
    const zones: ZoneCanvasState[] = dbZones.map((z) => ({
      id: z.id,
      tempId: String(z.id),
      label: z.name,
      color_hex: z.color_hex,
      canvas_x: z.canvas_x,
      canvas_y: z.canvas_y,
      canvas_w: z.canvas_w,
      canvas_h: z.canvas_h,
      canvas_points: z.canvas_points ? JSON.parse(z.canvas_points) as number[] : undefined,
      spots_per_row: z.spots_per_row,
      icon_type: z.icon_type,
      spotCount: 0,
    }))

    const boundary: BoundaryRect | null =
      layout.boundary_w && layout.boundary_w > 0
        ? { x: layout.boundary_x ?? 0, y: layout.boundary_y ?? 0, w: layout.boundary_w, h: layout.boundary_h ?? 0 }
        : null

    const structures = parseStructures(layout.canvas_shapes)
    const snap = makeSnapshot(boundary, zones, structures, [])

    set({
      layoutId: layout.id,
      layoutLabel: layout.label ?? '',
      canvasWidth: layout.canvas_width ?? 1200,
      canvasHeight: layout.canvas_height ?? 800,
      boundary,
      zones,
      structures,
      canvasSpots: [],
      backgroundImage: layout.background_image ?? null,
      backgroundOpacity: layout.background_opacity ?? 0.4,
      bgX: 0,
      bgY: 0,
      bgW: 0,
      bgH: 0,
      zonePolyInProgress: [],
      spotPolyInProgress: [],
      selectedTempId: null,
      selectedStructureId: null,
      selectedSpotTempId: null,
      isDirty: false,
      history: [snap],
      histCursor: 0,
      canUndo: false,
      canRedo: false,
    })
  },

  loadCanvasSpots: (rawSpots, zoneIdToTempId) => {
    const canvasSpots: CanvasSpot[] = rawSpots
      .filter((s) => s.canvas_x != null && s.canvas_y != null)
      .map((s) => ({
        id: s.id,
        tempId: String(s.id),
        zoneTempId: zoneIdToTempId[s.zone_id] ?? '',
        label: s.name,
        spot_type: (s.spot_type as SpotType) ?? 'standard',
        canvas_x: s.canvas_x!,
        canvas_y: s.canvas_y!,
        canvas_w: s.canvas_w ?? 28,
        canvas_h: s.canvas_h ?? 46,
        canvas_points: (s as any).canvas_points ? JSON.parse((s as any).canvas_points) as number[] : undefined,
      }))
    set({ canvasSpots })
  },

  reset: () =>
    set({
      layoutId: null,
      boundary: null,
      zones: [],
      structures: [],
      canvasSpots: [],
      backgroundImage: null,
      backgroundOpacity: 0.4,
      bgX: 0, bgY: 0, bgW: 0, bgH: 0,
      zonePolyInProgress: [],
      spotPolyInProgress: [],
      selectedTempId: null,
      selectedStructureId: null,
      selectedSpotTempId: null,
      zonesLocked: false,
      showZoneLabels: true,
      showSpotLabels: true,
      isDirty: false,
      history: [],
      histCursor: -1,
      canUndo: false,
      canRedo: false,
    }),

  markClean: () => set({ isDirty: false, dirtySpotTempIds: [], deletedSpotIds: [] }),

  // ── Background ──────────────────────────────────────────────────────────────

  setBackgroundImage: (url) => set({
    backgroundImage: url,
    // Reset transform so the new image gets auto-fitted on load.
    // Without this, bgW/bgH from the previous image remain and
    // the new image gets stretched to the old dimensions.
    bgX: 0, bgY: 0, bgW: 0, bgH: 0,
    isDirty: true,
  }),

  setBackgroundOpacity: (v) => set({ backgroundOpacity: v, isDirty: true }),

  setBackgroundTransform: (x, y, w, h) => set({ bgX: x, bgY: y, bgW: w, bgH: h, isDirty: true }),

  // ── Boundary ────────────────────────────────────────────────────────────────

  setBoundary: (rect) => {
    const s = get()
    const snap = makeSnapshot(rect, s.zones, s.structures, s.canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ boundary: rect, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  // ── Zones ───────────────────────────────────────────────────────────────────

  addZone: (zone) => {
    const s = get()
    const zones = [...s.zones, zone]
    const snap = makeSnapshot(s.boundary, zones, s.structures, s.canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ zones, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  updateZone: (tempId, updates) => {
    const s = get()
    const zones = s.zones.map((z) => (z.tempId === tempId ? { ...z, ...updates } : z))
    const snap = makeSnapshot(s.boundary, zones, s.structures, s.canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ zones, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  deleteZone: (tempId) => {
    const s = get()
    const zones = s.zones.filter((z) => z.tempId !== tempId)
    const canvasSpots = s.canvasSpots.filter((sp) => sp.zoneTempId !== tempId)
    const selectedTempId = s.selectedTempId === tempId ? null : s.selectedTempId
    const snap = makeSnapshot(s.boundary, zones, s.structures, canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ zones, canvasSpots, selectedTempId, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  updateSpotCount: (tempId, count) =>
    set((s) => ({ zones: s.zones.map((z) => (z.tempId === tempId ? { ...z, spotCount: count } : z)) })),

  // ── Structures ──────────────────────────────────────────────────────────────

  addStructure: (structure) => {
    const s = get()
    const structures = [...s.structures, structure]
    const snap = makeSnapshot(s.boundary, s.zones, structures, s.canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ structures, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  updateStructure: (id, updates) => {
    const s = get()
    const structures = s.structures.map((st) => (st.id === id ? { ...st, ...updates } : st))
    const snap = makeSnapshot(s.boundary, s.zones, structures, s.canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ structures, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  deleteStructure: (id) => {
    const s = get()
    const structures = s.structures.filter((st) => st.id !== id)
    const selectedStructureId = s.selectedStructureId === id ? null : s.selectedStructureId
    const snap = makeSnapshot(s.boundary, s.zones, structures, s.canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ structures, selectedStructureId, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  // ── Canvas spots ────────────────────────────────────────────────────────────

  addCanvasSpot: (spot) => {
    const s = get()
    const canvasSpots = [...s.canvasSpots, spot]
    const snap = makeSnapshot(s.boundary, s.zones, s.structures, canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ canvasSpots, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  updateCanvasSpot: (tempId, updates) => {
    const s = get()
    const canvasSpots = s.canvasSpots.map((sp) => (sp.tempId === tempId ? { ...sp, ...updates } : sp))
    const snap = makeSnapshot(s.boundary, s.zones, s.structures, canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    const dirtySpotTempIds = s.dirtySpotTempIds.includes(tempId)
      ? s.dirtySpotTempIds
      : [...s.dirtySpotTempIds, tempId]
    set({ canvasSpots, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false, dirtySpotTempIds })
  },

  deleteCanvasSpot: (tempId) => {
    const s = get()
    const spot = s.canvasSpots.find((sp) => sp.tempId === tempId)
    const canvasSpots = s.canvasSpots.filter((sp) => sp.tempId !== tempId)
    const selectedSpotTempId = s.selectedSpotTempId === tempId ? null : s.selectedSpotTempId
    // Track the backend ID so save can DELETE it from the server
    const deletedSpotIds = spot && spot.id > 0
      ? [...s.deletedSpotIds, spot.id]
      : s.deletedSpotIds
    const snap = makeSnapshot(s.boundary, s.zones, s.structures, canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ canvasSpots, selectedSpotTempId, deletedSpotIds, isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  // ── Wall drawing ────────────────────────────────────────────────────────────

  // ── Polygon zone drawing ────────────────────────────────────────────────────

  addZonePolyPoint: (x, y) =>
    set((s) => ({ zonePolyInProgress: [...s.zonePolyInProgress, x, y] })),

  removeLastZonePolyPoint: () =>
    set((s) => {
      const pts = s.zonePolyInProgress
      if (pts.length < 2) return { zonePolyInProgress: [] }
      return { zonePolyInProgress: pts.slice(0, -2) }
    }),

  finishZonePoly: (color) => {
    const s = get()
    const pts = s.zonePolyInProgress
    if (pts.length < 6) {
      set({ zonePolyInProgress: [] })
      return
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i])
      minY = Math.min(minY, pts[i + 1])
      maxX = Math.max(maxX, pts[i])
      maxY = Math.max(maxY, pts[i + 1])
    }
    const newZone: ZoneCanvasState = {
      id: 0,
      tempId: crypto.randomUUID(),
      label: `Zone ${s.zones.length + 1}`,
      color_hex: color,
      canvas_x: Math.round(minX),
      canvas_y: Math.round(minY),
      canvas_w: Math.round(maxX - minX),
      canvas_h: Math.round(maxY - minY),
      canvas_points: pts,
      spots_per_row: 4,
      icon_type: 'outdoor',
      spotCount: 0,
    }
    const zones = [...s.zones, newZone]
    const snap = makeSnapshot(s.boundary, zones, s.structures, s.canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ zones, zonePolyInProgress: [], isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  cancelZonePoly: () => set({ zonePolyInProgress: [] }),

  // ── Polygon spot drawing ─────────────────────────────────────────────────────

  addSpotPolyPoint: (x, y) =>
    set((s) => ({ spotPolyInProgress: [...s.spotPolyInProgress, x, y] })),

  removeLastSpotPolyPoint: () =>
    set((s) => {
      const pts = s.spotPolyInProgress
      if (pts.length < 2) return { spotPolyInProgress: [] }
      return { spotPolyInProgress: pts.slice(0, -2) }
    }),

  finishSpotPoly: (zoneTempId) => {
    const s = get()
    const pts = s.spotPolyInProgress
    if (pts.length < 6 || !zoneTempId) {
      set({ spotPolyInProgress: [] })
      return
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i])
      minY = Math.min(minY, pts[i + 1])
      maxX = Math.max(maxX, pts[i])
      maxY = Math.max(maxY, pts[i + 1])
    }
    const zone = s.zones.find((z) => z.tempId === zoneTempId)
    const zoneSpots = s.canvasSpots.filter((sp) => sp.zoneTempId === zoneTempId)
    const label = makeSpotLabel(s.layoutLabel, zone?.label ?? '', zoneSpots.length + 1)
    const newSpot: CanvasSpot = {
      id: 0,
      tempId: crypto.randomUUID(),
      zoneTempId,
      label,
      spot_type: 'standard',
      canvas_x: Math.round(minX),
      canvas_y: Math.round(minY),
      canvas_w: Math.round(maxX - minX),
      canvas_h: Math.round(maxY - minY),
      canvas_points: pts,
    }
    const canvasSpots = [...s.canvasSpots, newSpot]
    const snap = makeSnapshot(s.boundary, s.zones, s.structures, canvasSpots)
    const [history, histCursor] = pushHistory(s.history, s.histCursor, snap)
    set({ canvasSpots, spotPolyInProgress: [], isDirty: true, history, histCursor, canUndo: histCursor > 0, canRedo: false })
  },

  cancelSpotPoly: () => set({ spotPolyInProgress: [] }),

  // ── Selection ───────────────────────────────────────────────────────────────

  setSelected: (tempId) => set({ selectedTempId: tempId, selectedStructureId: null, selectedSpotTempId: null }),

  setSelectedStructure: (id) => set({ selectedStructureId: id, selectedTempId: null, selectedSpotTempId: null }),

  setSelectedSpot: (tempId) => set({ selectedSpotTempId: tempId, selectedTempId: null, selectedStructureId: null }),

  // ── Tool mode ───────────────────────────────────────────────────────────────

  setToolMode: (mode) => {
    const { zonePolyInProgress, spotPolyInProgress } = get()
    if (mode !== 'draw-zone-poly' && zonePolyInProgress.length > 0) {
      set({ zonePolyInProgress: [] })
    }
    if (mode !== 'draw-spot-poly' && spotPolyInProgress.length > 0) {
      set({ spotPolyInProgress: [] })
    }
    // Auto-lock zones when switching to spot placement so zones don't move accidentally
    if (mode === 'place-spot' || mode === 'draw-spot-poly') {
      set({ toolMode: mode, zonesLocked: true })
    } else {
      set({ toolMode: mode })
    }
  },

  setZonesLocked: (v) => set({ zonesLocked: v }),
  setShowZoneLabels: (v) => set({ showZoneLabels: v }),
  setShowSpotLabels: (v) => set({ showSpotLabels: v }),

  // ── Undo / redo ─────────────────────────────────────────────────────────────

  undo: () => {
    const { history, histCursor } = get()
    if (histCursor <= 0) return
    const newCursor = histCursor - 1
    const snap = history[newCursor]
    set({
      boundary: snap.boundary,
      zones: snap.zones.map((z) => ({ ...z })),
      structures: snap.structures.map((s) => ({ ...s })),
      canvasSpots: snap.canvasSpots.map((s) => ({ ...s })),
      histCursor: newCursor,
      isDirty: true,
      canUndo: newCursor > 0,
      canRedo: true,
    })
  },

  redo: () => {
    const { history, histCursor } = get()
    if (histCursor >= history.length - 1) return
    const newCursor = histCursor + 1
    const snap = history[newCursor]
    set({
      boundary: snap.boundary,
      zones: snap.zones.map((z) => ({ ...z })),
      structures: snap.structures.map((s) => ({ ...s })),
      canvasSpots: snap.canvasSpots.map((s) => ({ ...s })),
      histCursor: newCursor,
      isDirty: true,
      canUndo: true,
      canRedo: newCursor < history.length - 1,
    })
  },
}))
