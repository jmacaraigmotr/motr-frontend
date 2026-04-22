import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { Vehicle, CreateVehicleInput } from '@/types/vehicle'
import type { AuditEntry } from '@/components/RecordHistory'

const api = createApiClient(API_GROUPS.customers)

export interface UpdateVehicleInput extends Partial<Omit<CreateVehicleInput, 'customer_id'>> {}

export const vehiclesApi = {
  listByCustomer: async (customer_id: number): Promise<Vehicle[]> =>
    api.get('/vehicles/list', { params: { customer_id } }),

  create: async (data: CreateVehicleInput): Promise<Vehicle> =>
    api.post('/vehicles/create', data),

  update: async (id: number, data: UpdateVehicleInput): Promise<Vehicle> =>
    api.patch('/vehicles/update', { id, ...data }),

  delete: async (id: number): Promise<void> =>
    api.delete('/vehicles/delete', { params: { id } }),

  history: async (id: number): Promise<AuditEntry[]> =>
    api.get('/vehicles/history', { params: { id } }),
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Title-case a string — NHTSA returns makes/models in ALL CAPS */
function titleCase(str: string | null | undefined): string | null {
  if (!str) return null
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bBmw\b/, 'BMW')
    .replace(/\bGmc\b/, 'GMC')
    .replace(/\bSuv\b/, 'SUV')
    .replace(/\bMpv\b/, 'MPV')
    .replace(/\bAwd\b/, 'AWD')
    .replace(/\bFwd\b/, 'FWD')
    .replace(/\bRwd\b/, 'RWD')
}

// ─── VIN Decoder ───────────────────────────────────────────────────────────────

export interface DecodedVin {
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  engine: string | null
  body_style: string | null
  raw_make: string | null
  raw_model: string | null
}

export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  const cleanVin = vin.trim().toUpperCase()
  if (cleanVin.length < 10) return null

  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${cleanVin}?format=json`,
      { signal: AbortSignal.timeout(8000) }
    )

    if (!res.ok) return null

    const json = await res.json()
    const r = json?.Results?.[0]
    if (!r) return null

    const errorCode = String(r.ErrorCode ?? '').trim()
    const hasError = errorCode !== '0' && !errorCode.startsWith('0,')
    const hasMake = !!r.Make

    if (hasError && !hasMake) return null

    let engine: string | null = null
    if (r.DisplacementL && r.DisplacementL !== '') {
      const liters = parseFloat(r.DisplacementL)
      const cylinders = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : ''
      const fuel = r.FuelTypePrimary ?? ''
      const parts = [
        !isNaN(liters) ? `${liters.toFixed(1)}L` : null,
        cylinders || null,
        fuel && fuel !== 'Gasoline' ? fuel : null,
      ].filter(Boolean)
      engine = parts.length > 0 ? parts.join(' ') : null
    }

    const rawMake = r.Make || null
    const rawModel = r.Model || null

    return {
      year:       r.ModelYear ? parseInt(r.ModelYear) : null,
      make:       titleCase(rawMake),
      model:      titleCase(rawModel),
      trim:       r.Trim || null,
      engine,
      body_style: r.BodyClass || null,
      raw_make:   rawMake,
      raw_model:  rawModel,
    }
  } catch (err) {
    console.warn('[VIN decode] failed:', err)
    return null
  }
}
