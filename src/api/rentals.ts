import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { Rental } from '@/types/repairOrder'

const api = createApiClient(API_GROUPS.repair_orders)

export interface CreateRentalInput {
  repair_order_id: number
  rental_company?: string
  approved_daily_amount?: number
  days_on_policy?: number
  reservation_number?: string
  contract_number?: string
  rental_start_date?: string
  rental_due_date?: string
  notes?: string
}

export interface UpdateRentalInput extends Partial<Omit<CreateRentalInput, 'repair_order_id'>> {}

export const rentalsApi = {
  getByRO: async (repair_order_id: number): Promise<Rental | null> =>
    api.get('/rentals/get', { params: { repair_order_id } }),

  create: async (data: CreateRentalInput): Promise<Rental> =>
    api.post('/rentals/create', data),

  update: async (id: number, data: UpdateRentalInput): Promise<Rental> =>
    api.patch('/rentals/update', { id, ...data }),

  delete: async (id: number): Promise<void> =>
    api.delete('/rentals/delete', { params: { id } }),
}
