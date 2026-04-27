import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { ROInsurance } from '@/types/repairOrder'

const api = createApiClient(API_GROUPS.repair_orders)

export interface CreateInsuranceInput {
  repair_order_id: number
  has_first_party?: boolean
  has_third_party?: boolean
  first_party_company_id?: number
  first_party_claim_number?: string
  first_party_rep_name?: string
  first_party_rep_phone?: string
  third_party_company_id?: number
  third_party_claim_number?: string
  third_party_rep_name?: string
  third_party_rep_phone?: string
  liability_percentage?: string
  pd_limit?: number
  notes?: string
}

export interface UpdateInsuranceInput extends Partial<Omit<CreateInsuranceInput, 'repair_order_id'>> {}

export const insuranceApi = {
  getByRO: async (repair_order_id: number): Promise<ROInsurance | null> =>
    api.get('/insurance/get', { params: { repair_order_id } }),

  create: async (data: CreateInsuranceInput): Promise<ROInsurance> =>
    api.post('/insurance/create', data),

  update: async (id: number, data: UpdateInsuranceInput): Promise<ROInsurance> =>
    api.patch('/insurance/update', { id, ...data }),

  delete: async (id: number): Promise<void> =>
    api.delete('/insurance/delete', { params: { id } }),
}
