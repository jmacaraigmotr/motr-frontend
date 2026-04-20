import { createApiClient } from './client'
import { API_GROUPS } from './groups'

const api = createApiClient(API_GROUPS.repair_orders)

export interface InsuranceCompany {
  id: number
  name: string
  phone?: string | null
  rep_name?: string | null
  rep_phone?: string | null
  rep_email?: string | null
  shop_id?: number
}

export interface CreateInsuranceCompanyInput {
  name: string
  shop_id?: number
  phone?: string
  rep_name?: string
  rep_phone?: string
  rep_email?: string
}

export interface UpdateInsuranceCompanyInput {
  name?: string
  phone?: string
  rep_name?: string
  rep_phone?: string
  rep_email?: string
}

export const insuranceCompaniesApi = {
  list: async (shop_id?: number): Promise<InsuranceCompany[]> =>
    api.get('/repair_orders/insurance_companies/list', { params: shop_id ? { shop_id } : {} }),

  create: async (data: CreateInsuranceCompanyInput): Promise<InsuranceCompany> =>
    api.post('/repair_orders/insurance_companies/create', data),

  update: async (id: number, data: UpdateInsuranceCompanyInput): Promise<InsuranceCompany> =>
    api.patch('/repair_orders/insurance_companies/update', { id, ...data }),

  delete: async (id: number): Promise<void> =>
    api.delete('/repair_orders/insurance_companies/delete', { params: { id } }),
}
