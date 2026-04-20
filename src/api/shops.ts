// Shops API — admin-only CRUD for managing shops across the platform.
// Backend files: backend/apis/shops/
// Update API_GROUPS.shops canonical in groups.ts after first Xano push.

import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { Shop } from '@/types/auth'

const api = createApiClient(API_GROUPS.shops)

export interface CreateShopInput {
  name: string
  address?: string
  phone?: string
  email?: string
  brand_color?: string
  canvas_cols?: number
  canvas_rows?: number
}

export interface UpdateShopInput {
  id: number
  name?: string
  address?: string
  phone?: string
  email?: string
  brand_color?: string
  canvas_cols?: number
  canvas_rows?: number
}

export const shopsApi = {
  list: async (): Promise<Shop[]> =>
    api.get('/shops/list'),

  create: async (input: CreateShopInput): Promise<Shop> =>
    api.post('/shops/create', input),

  update: async (input: UpdateShopInput): Promise<Shop> =>
    api.patch('/shops/update', input),

  delete: async (id: number): Promise<void> =>
    api.delete('/shops/delete', { data: { id } }),
}
