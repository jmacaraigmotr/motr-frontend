import { createApiClient } from './client'
import { API_GROUPS } from './groups'

const api = createApiClient(API_GROUPS.repair_orders)

export interface RentalCompany {
  id: number
  shop_id: number
  name: string
  phone: string | null
  website: string | null
  notes: string | null
  created_at: string
}

export interface CreateRentalCompanyInput {
  name: string
  shop_id?: number
  phone?: string
  website?: string
  notes?: string
}

export interface UpdateRentalCompanyInput extends Partial<Omit<CreateRentalCompanyInput, 'shop_id'>> {}

export const rentalCompaniesApi = {
  list: async (params?: { shop_id?: number; search?: string }): Promise<RentalCompany[]> =>
    api.get('/rental_companies/list', { params }),

  create: async (data: CreateRentalCompanyInput): Promise<RentalCompany> =>
    api.post('/rental_companies/create', data),

  update: async (id: number, data: UpdateRentalCompanyInput): Promise<RentalCompany> =>
    api.patch('/rental_companies/update', { id, ...data }),

  delete: async (id: number): Promise<void> =>
    api.delete('/rental_companies/delete', { params: { id } }),
}
