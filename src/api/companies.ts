import { createApiClient } from './client'
import type { Company, CreateCompanyInput, UpdateCompanyInput } from '@/types/company'

const COMPANIES_GROUP_ID = 'GhFJlhmG'

const api = createApiClient(COMPANIES_GROUP_ID)

export const companiesApi = {
  list: async (shop_id?: number): Promise<Company[]> =>
    api.get('/companies/list', { params: { shop_id } }),

  create: async (data: CreateCompanyInput): Promise<Company> =>
    api.post('/companies/create', data),

  update: async (id: number, data: UpdateCompanyInput): Promise<Company> =>
    api.patch('/companies/update', { id, ...data }),

  delete: async (id: number): Promise<void> =>
    api.delete('/companies/delete', { params: { id } }),
}
