import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type {
  RepairOrder,
  RepairOrderListItem,
  CreateROInput,
  UpdateROStatusInput,
  UpdateJobStatusInput,
  ROListParams,
  ROListResponse,
  StaffMember,
  LotLocation,
  Payment,
  PaymentEvent,
  PaymentWithContext,
  PaymentsListAllParams,
  TransactionsListResponse,
  CreatePaymentInput,
  ROEvent,
} from '@/types'
import type { PaginatedResponse } from '@/types/common'

const api = createApiClient(API_GROUPS.repair_orders)
const authApi = createApiClient(API_GROUPS.auth)

export interface ROAuditEntry {
  id: number
  created_at: string
  user_id: number | null
  action_type: 'create' | 'update' | 'delete'
  entity_type: string
  entity_id: number | null
  entity_name: string | null
  description: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  user: { id: number; first_name: string | null; last_name: string | null; name: string | null; email: string | null } | null
}

export interface CreateEventInput {
  repair_order_id: number
  type?: string
  description: string
}

export const repairOrdersApi = {
  list: async (params?: ROListParams): Promise<ROListResponse> =>
    api.get('/repair_orders/list', { params }),

  get: async (id: number): Promise<{
    ro: RepairOrder
    customer: unknown
    csr: StaffMember | null
    vehicle: unknown
    intake: unknown
    insurance: unknown
    rental: unknown
    parts_orders: unknown[]
    departments: unknown[]
    events: unknown[]
    voice_recordings: unknown[]
  }> =>
    api.get('/repair_orders/get', { params: { id } }),

  create: async (data: CreateROInput): Promise<RepairOrder> =>
    api.post('/repair_orders/create', data),

  updateStatus: async (data: UpdateROStatusInput): Promise<RepairOrder> =>
    api.patch('/repair_orders/update_status', data),

  updateJobStatus: async (data: UpdateJobStatusInput): Promise<RepairOrder> =>
    api.patch('/repair_orders/update_job_status', data),

  update: async (id: number, data: Partial<{
    arrived_at: string | null
    scheduled_out_date: string | null
    vehicle_id: number | null
    csr_id: number | null
    estimator_id: number | null
    lot_location_id: number | null
    notes: string | null
    zone: string | null
    job_number: number | null
    job_type: string | null
    job_class: string | null
    insurance_claim_type: string | null
    dealer_ro_number: string | null
    is_total_loss: boolean | null
    is_maxed: boolean | null
    has_room_left_in_vehicle: boolean | null
    amount_left_in_vehicle: number | null
    rental_needed: boolean | null
    clear_lot_location: boolean
  }>): Promise<RepairOrder> =>
    api.patch('/repair_orders/update', { id, ...data }),

  updateVehicle: async (id: number, vehicle_id: number | null): Promise<RepairOrder> =>
    api.patch('/repair_orders/update', { id, vehicle_id }),

  delete: async (id: number): Promise<void> =>
    api.delete('/repair_orders/delete', { params: { id } }),

  // Staff records live in the auth API group, so call that base instead of repair_orders.
  staffList: async (shop_id?: number): Promise<StaffMember[]> =>
    authApi.get('/auth/team_members', { params: { shop_id } }),

  lotLocationsList: async (): Promise<LotLocation[]> =>
    api.get('/repair_orders/lot_locations'),

  checkJobNumber: async (job_number: number): Promise<{ available: boolean; existing_ro: { id: number; ro_number: string } | null }> =>
    api.get('/repair_orders/check_job_number', { params: { job_number } }),

  // ── Payments ────────────────────────────────────────────────────────────────
  listPayments: async (repair_order_id: number): Promise<Payment[]> => {
    const result = await api.get('/repair_orders/payments/list', { params: { repair_order_id } })
    if (Array.isArray(result)) return result
    const r = result as { data?: Payment[]; items?: Payment[] } | null
    return r?.data ?? r?.items ?? []
  },

  listAllPayments: async (params?: PaymentsListAllParams): Promise<TransactionsListResponse> =>
    api.get('/repair_orders/payments/list_all', { params }),

  createPayment: async (data: CreatePaymentInput): Promise<Payment> =>
    api.post('/repair_orders/payments/create', data),

  updatePayment: async (id: number, data: CreatePaymentInput): Promise<Payment> =>
    api.patch('/repair_orders/payments/update', { id, ...data }),

  deletePayment: async (id: number): Promise<void> =>
    api.delete('/repair_orders/payments/delete', { params: { id } }),

  // ── Events ───────────────────────────────────────────────────────────────────
  createEvent: async (data: CreateEventInput): Promise<ROEvent> =>
    api.post('/repair_orders/events/create', data),

  deleteEvent: async (id: number): Promise<void> =>
    api.delete('/repair_orders/events/delete', { params: { id } }),

  // ── Payment Events ────────────────────────────────────────────────────────────
  listPaymentEvents: async (payment_id: number): Promise<PaymentEvent[]> =>
    api.get('/repair_orders/payment_events/list', { params: { payment_id } }),

  createPaymentEvent: async (data: { payment_id: number; notes: string }): Promise<PaymentEvent> =>
    api.post('/repair_orders/payment_events/create', data),

  updatePaymentEvent: async (id: number, notes: string): Promise<PaymentEvent> =>
    api.patch('/repair_orders/payment_events/update', { id, notes }),

  deletePaymentEvent: async (id: number): Promise<void> =>
    api.delete('/repair_orders/payment_events/delete', { params: { id } }),

  // ── Activity (audit log) ──────────────────────────────────────────────────
  activity: async (id: number): Promise<ROAuditEntry[]> =>
    api.get('/repair_orders/activity', { params: { id } }),
}
