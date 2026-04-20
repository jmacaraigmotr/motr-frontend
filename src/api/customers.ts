import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import { documentsApi } from './documents'
import type {
  Customer,
  CustomerDetailResponse,
  CustomerListResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerListParams,
  CustomerHistory,
  ActivityLogEntry,
} from '@/types'

const api = createApiClient(API_GROUPS.customers)

export const customersApi = {
  list: async (params?: CustomerListParams): Promise<CustomerListResponse> =>
    api.get('/customers/list', { params }),

  get: async (id: number): Promise<CustomerDetailResponse> =>
    api.get('/customers/get', { params: { id } }),

  create: async (data: CreateCustomerInput): Promise<Customer> => {
    const { drivers_license_file, ...rest } = data
    const customer: Customer = await api.post('/customers/create', rest)
    if (drivers_license_file?.length) {
      await Promise.all(drivers_license_file.map(file =>
        documentsApi.upload({ entityType: 'customer', entityId: customer.id, file, category: 'drivers_license' })
      ))
    }
    return customer
  },

  update: async (id: number, data: UpdateCustomerInput): Promise<Customer> => {
    const { drivers_license_file, ...rest } = data
    const customer: Customer = await api.patch('/customers/update', { id, ...rest })
    if (drivers_license_file?.length) {
      await Promise.all(drivers_license_file.map(file =>
        documentsApi.upload({ entityType: 'customer', entityId: id, file, category: 'drivers_license' })
      ))
    }
    return customer
  },

  delete: async (id: number): Promise<{ success: boolean }> =>
    api.delete('/customers/delete', { params: { id } }),

  listCompanies: async (shop_id?: number): Promise<string[]> =>
    api.get('/customers/companies/list', { params: { shop_id } }),

  history: async (id: number): Promise<CustomerHistory> =>
    api.get('/customers/history', { params: { id } }),

  activity: async (id: number): Promise<ActivityLogEntry[]> =>
    api.get('/customers/activity', { params: { id } }),
}
