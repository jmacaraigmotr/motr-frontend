import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { Intake, IntakeDetail } from '@/types/repairOrder'

const api = createApiClient(API_GROUPS.repair_orders)

export interface CreateIntakeInput {
  repair_order_id: number
  is_towed?: boolean
  is_driveable?: boolean
  has_wrap?: boolean
  has_ceramic_coating?: boolean
  how_accident_happened?: string
  point_of_impact?: string
  date_of_loss?: string
  insurance_party?: string
  prior_unrelated_damage?: string
  damage_description?: string
  customer_requests?: string
  police_report_present?: boolean
  police_report_file?: File
  intake_photos?: File
  mileage?: number
  has_previous_estimate?: boolean
  notes?: string
}

export interface UpdateIntakeInput extends Partial<Omit<CreateIntakeInput, 'repair_order_id'>> {
  // Booleans are required on update so the backend never receives null for false
  is_towed: boolean
  is_driveable: boolean
  has_wrap: boolean
  has_ceramic_coating: boolean
  police_report_present: boolean
  has_previous_estimate: boolean
}

export const intakesApi = {
  getByRO: async (repair_order_id: number): Promise<IntakeDetail> =>
    api.get('/intakes/get', { params: { repair_order_id } }),

  create: async (data: CreateIntakeInput): Promise<Intake> =>
    api.post('/intakes/create', data),

  update: async (id: number, data: UpdateIntakeInput): Promise<Intake> =>
    api.patch('/intakes/update', { id, ...data }),

  delete: async (id: number): Promise<void> =>
    api.delete('/intakes/delete', { params: { id } }),
}
