// Lot Management API
// Backend files: backend/apis/lot/
// Update API_GROUPS.lot canonical in groups.ts after first Xano push.

import { createApiClient } from './client'
import { API_GROUPS } from './groups'

const api = createApiClient(API_GROUPS.lot)

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LotLayout {
  id: number
  shop_id: number
  label: string
  is_active: boolean
  canvas_width: number
  canvas_height: number
  boundary_x: number | null
  boundary_y: number | null
  boundary_w: number | null
  boundary_h: number | null
  canvas_shapes: string | null       // JSON-serialised StructureShape[]
  background_image?: string | null   // CDN URL for blueprint/reference layer (never base64)
  background_opacity?: number | null // 0–1
  created_at: string
  created_by: number
}

export type ZoneIconType = 'outdoor' | 'booth' | 'lift' | 'indoor' | 'primer' | 'nose'

export interface Zone {
  id: number
  shop_id: number
  layout_id: number
  name: string
  canvas_x: number
  canvas_y: number
  canvas_w: number
  canvas_h: number
  // JSON-serialised number[] for polygon zones; null/absent for rectangular zones
  canvas_points?: string | null
  color_hex: string
  spots_per_row: number
  icon_type: ZoneIconType
}

export type SpotType = 'standard' | 'accessible' | 'oversized' | 'reserved'

export interface LotSpot {
  id: number
  zone_id: number
  layout_id: number
  name: string
  spot_type: SpotType
  spot_row: number
  spot_col: number
  is_occupied: boolean
  // Freeform canvas position (set when individually placed on builder canvas)
  canvas_x?: number | null
  canvas_y?: number | null
  canvas_w?: number | null
  canvas_h?: number | null
  canvas_points?: string | null   // JSON-serialised number[] for polygon spots
  current_ro_id?: number | null
  current_vehicle_id?: number | null
  ro_number?: string | null
  ro_status?: string | null
  current_ro?: { id: number; job_number: number | null; ro_number: string } | null
  // canvas endpoint JOIN alias
  ro?: { id: number; job_number: number | null; ro_number: string } | null
  vehicle?: {
    year: number | null
    make: string | null
    model: string | null
    color: string | null
  } | null
}

export interface SpotDetail {
  spot: {
    id: number
    name: string
    spot_type: string
    is_occupied: boolean
    canvas_x: number | null
    canvas_y: number | null
    canvas_w: number | null
    canvas_h: number | null
    canvas_points: string | null
    zone_id: number
    zone_name: string | null
    zone_color_hex: string | null
    layout_id: number
    layout_label: string | null
  }
  current: {
    ro_id: number
    ro_number: string
    job_number: number | null
    parked_in_spot_at: string | null
    arrived_at_shop: string | null
    scheduled_out_date: string | null
    status: string
    customer_id: number
    customer_first_name: string
    customer_last_name: string
    vehicle_year: number | null
    vehicle_make: string | null
    vehicle_model: string | null
    vehicle_color: string | null
  } | null
  history: Array<{
    ro_id: number | null
    ro_number: string | null
    customer_first_name: string | null
    customer_last_name: string | null
    moved_in_at: string
    moved_out_at?: string | null
    notes: string | null
  }>
}

export interface LotCanvasPayload {
  layout: {
    id: number
    label: string
    canvas_width: number
    canvas_height: number
    boundary: { x: number; y: number; w: number; h: number }
    background_image?: string | null
    background_opacity?: number | null
  } | null
  zones: Array<Zone & { spots: LotSpot[] }>
}

// Enriched layout returned by /lot/layouts/list when Xano includes nested zones+spots
export type LotLayoutWithSpots = LotLayout & {
  zones: Array<Zone & { spots: LotSpot[] }>
}

// ─── Input types ───────────────────────────────────────────────────────────────

export interface CreateZoneInput {
  layout_id: number
  shop_id: number
  name: string
  canvas_x: number
  canvas_y: number
  canvas_w: number
  canvas_h: number
  canvas_points?: string
  color_hex: string
  spots_per_row: number
  icon_type: ZoneIconType
}

export interface UpdateZoneInput {
  id: number
  name?: string
  canvas_x?: number
  canvas_y?: number
  canvas_w?: number
  canvas_h?: number
  canvas_points?: string | null
  color_hex?: string
  spots_per_row?: number
  icon_type?: ZoneIconType
}

export interface ReorderZonesInput {
  zones: Array<{
    id: number
    canvas_x: number
    canvas_y: number
    canvas_w: number
    canvas_h: number
    canvas_points?: string | null
  }>
}

export interface UpdateLayoutInput {
  id: number
  label?: string
  canvas_width?: number
  canvas_height?: number
  boundary_x?: number
  boundary_y?: number
  boundary_w?: number
  boundary_h?: number
  canvas_shapes?: string
  background_image?: string | null
  background_opacity?: number
}

export interface CreateSpotsInput {
  zone_id: number
  layout_id: number
  shop_id: number
  replace?: boolean
  spots: Array<{
    label: string
    spot_type?: SpotType
    spot_row: number
    spot_col: number
    canvas_x?: number
    canvas_y?: number
    canvas_w?: number
    canvas_h?: number
    canvas_points?: string | null
  }>
}

export interface UpdateSpotInput {
  id: number
  name?: string
  spot_type?: SpotType
  canvas_x?: number | null
  canvas_y?: number | null
  canvas_w?: number | null
  canvas_h?: number | null
  canvas_points?: string | null
}

// ─── API ───────────────────────────────────────────────────────────────────────

export const lotApi = {
  // Layouts
  listLayouts: (shop_id: number): Promise<LotLayoutWithSpots[]> =>
    api.get('/lot/layouts/list', { params: { shop_id } }),

  createLayout: (input: { shop_id?: number; label: string }): Promise<LotLayout> =>
    api.post('/lot/layouts/create', input),

  updateLayout: (input: UpdateLayoutInput): Promise<LotLayout> =>
    api.patch('/lot/layouts/update', input),

  publishLayout: (id: number): Promise<LotLayout> =>
    api.patch('/lot/layouts/publish', { id }),

  getActiveLayout: (shop_id: number): Promise<LotLayout | null> =>
    api.get('/lot/layouts/active', { params: { shop_id } }),

  // Zones
  listZones: (layout_id: number): Promise<Zone[]> =>
    api.get('/lot/zones/list', { params: { layout_id } }),

  createZone: (input: CreateZoneInput): Promise<Zone> =>
    api.post('/lot/zones/create', input),

  updateZone: (input: UpdateZoneInput): Promise<Zone> =>
    api.patch('/lot/zones/update', input),

  deleteZone: (id: number): Promise<void> =>
    api.delete('/lot/zones/delete', { data: { id } }),

  reorderZones: (input: ReorderZonesInput): Promise<void> =>
    api.post('/lot/zones/reorder', input),

  // Spots
  listSpots: (zone_id: number): Promise<LotSpot[]> =>
    api.get('/lot/spots/list', { params: { zone_id } }),

  bulkCreateSpots: (input: CreateSpotsInput): Promise<LotSpot[]> =>
    api.post('/lot/spots/bulk', input),

  updateSpot: (input: UpdateSpotInput): Promise<LotSpot> =>
    api.patch('/lot/spots/update', input),

  deleteSpot: (id: number): Promise<void> =>
    api.delete('/lot/spots/delete', { data: { id } }),

  // Live view
  getCanvas: (shop_id: number, layout_id?: number): Promise<LotCanvasPayload> =>
    api.get('/lot/canvas', { params: { shop_id, ...(layout_id != null ? { layout_id } : {}) } }),

  assignSpot: (id: number, ro_id: number): Promise<LotSpot> =>
    api.patch('/lot/spots/assign', { id, ro_id }),

  unassignSpot: (id: number): Promise<LotSpot> =>
    api.patch('/lot/spots/unassign', { id }),

  getSpotDetail: (spot_id: number): Promise<SpotDetail> =>
    api.get('/lot/spots/detail', { params: { spot_id } }),

  // Upload a blueprint image to Xano file storage.
  // Xano returns an attachment object with a `path` field (e.g. /vault/xxx/file.png).
  // We prepend VITE_XANO_BASE to form the full public CDN URL.
  uploadBackground: async (file: File): Promise<{ url: string }> => {
    const form = new FormData()
    form.append('background_file', file)
    const attachment = await api.post<{ path: string; name: string; type: string; size: number }>(
      '/lot/layouts/upload_background',
      form,
    )
    const base = import.meta.env.VITE_XANO_BASE as string
    return { url: base + attachment.path }
  },
}
