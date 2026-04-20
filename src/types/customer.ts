import type { ListParams } from './common'
import type { Company } from './company'
import type { CustomerDocument } from './document'
import type { ROEvent, RepairOrderListItem } from './repairOrder'
import type { Vehicle } from './vehicle'

export type PreferredContact = 'phone' | 'email' | 'text'

export type ReferredByType = 'customer' | 'employee' | 'internet' | 'social_media' | 'walk_in' | 'other'

export interface Customer {
  id: number
  shop_id: number
  assigned_csr_id: number | null
  first_name: string
  last_name: string
  company: Company | null
  company_id: number | null
  email: string | null
  phone: string | null
  phone_secondary: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  has_different_pickup_address: boolean | null
  pickup_address_line1: string | null
  pickup_city: string | null
  pickup_state: string | null
  pickup_zip: string | null
  preferred_contact: PreferredContact | null
  drivers_license: string | null
  drivers_license_file_url: string | null
  location_attribution: string | null
  referred_by: string | null
  referrer_name: string | null
  referred_by_customer_id: number | null
  referred_by_employee_id: number | null
  vehicle_count: number
  active_ro_count: number
  waiting_for_payment_count?: number | null
  satisfaction_rating: number | null
  lifetime_value: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateCustomerInput {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company_id?: number
  address_line1?: string | null
  address_line2?: string | null
  city?: string
  state?: string
  zip?: string
  has_different_pickup_address?: boolean
  pickup_address_line1?: string | null
  pickup_city?: string | null
  pickup_state?: string | null
  pickup_zip?: string | null
  drivers_license?: string
  drivers_license_file?: File[]
  preferred_contact?: PreferredContact
  location_attribution?: string
  assigned_csr_id?: number
  referred_by?: string
  referred_by_customer_id?: number
  referred_by_employee_id?: number
  referrer_name?: string
  notes?: string
  shop_id?: number
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {}

export interface CustomerListParams extends ListParams {
  shop_id?: number
  assigned_csr_id?: number
  with_open_ros?: boolean
}

export interface CustomerInteraction {
  id: number
  customer_id: number
  user_id: number | null
  repair_order_id: number | null
  type: 'call' | 'email' | 'text' | 'in_person' | 'note'
  direction: 'inbound' | 'outbound' | null
  subject: string | null
  body: string | null
  created_at: string
}

export interface CustomerHistory {
  ro_events: Array<
    ROEvent & {
      repair_orders?: {
        id: number
        ro_number: string
        job_number?: number | null
      }
    }
  >
  customer_interactions: Array<
    CustomerInteraction & {
      repair_orders?: {
        id: number
        ro_number: string
        job_number?: number | null
      }
    }
  >
  payments: Array<
    {
      id: number
      created_at?: string
      amount: number
      payment_method?: string | null
      payer_type?: string | null
      reference_number?: string | null
      notes?: string | null
      received_by?: number | null
      repair_orders?: {
        id: number
        ro_number: string
        job_number?: number | null
      }
    }
  >
}

export interface ActivityLogEntry {
  id: number
  created_at: string
  user_id: number | null
  user_email: string | null
  action_type: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'other' | string
  entity_type: string
  entity_id: number | null
  entity_name: string | null
  description: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  user: { id: number; name: string | null; first_name: string | null; last_name: string | null; email: string | null; job_title: string | null; role_id: number | null } | null
}

export interface XanoListResult<T> {
  items: T[]
  itemsReceived: number
  curPage: number
  perPage: number
  nextPage: number | null
  prevPage: number | null
  offset: number
  itemsTotal?: number
  pageTotal?: number
}

export interface CustomerMetadata {
  total_vehicles: number
  total_ros: number
  open_ros: number
  waiting_for_payment_ros: number
  closed_ros: number
}

export interface CustomerDetailResponse {
  customer: Customer
  vehicles: Vehicle[]
  open_ros: RepairOrderListItem[]
  documents: CustomerDocument[]
  metadata: CustomerMetadata
}

export interface CustomerListMetadata {
  total_customers: number
  with_open_ros: number
}

export interface CustomerListResponse {
  data: Customer[]
  pagination: { page: number; per_page: number; total: number }
  metadata: CustomerListMetadata | null
}
