import type { ListParams } from './common'
import type { Customer } from './customer'
import type { Vehicle } from './vehicle'

export type ROStatus =
  | 'new'
  | 'estimate_pending'
  | 'estimate_approved'
  | 'pre_order'
  | 'parts_ordered'
  | 'parts_partial'
  | 'parts_complete'
  | 'scheduled'
  | 'in_production'
  | 'qa_check'
  | 'detail'
  | 'ready_for_pickup'
  | 'delivered'
  | 'closed'

export type JobStatus = 'open' | 'waiting_for_payment' | 'closed'

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open:                'Open',
  waiting_for_payment: 'Waiting for Payment',
  closed:              'Closed',
}

export const JOB_STATUS_COLORS: Record<JobStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  open:                'success',
  waiting_for_payment: 'warning',
  closed:              'default',
}

export type JobType = 'insurance' | 'self_pay' | 'dealer' | 'redo' | 'fleet' | 'police_tow'

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  insurance:  'Insurance',
  self_pay:   'Self Pay',
  dealer:     'Dealer',
  redo:       'Redo',
  fleet:      'Fleet',
  police_tow: 'Police Tow',
}
export type DealerClaimType = 'Lot' | 'Transportation' | 'Warranty' | 'Parts' | 'Used'
export type JobClass = 'collision' | 'mechanical' | 'paint' | 'custom'
export type ROPriority = 'normal' | 'high' | 'rush'

export const RO_STATUS_LABELS: Record<ROStatus, string> = {
  new:              'New',
  estimate_pending: 'Estimate Pending',
  estimate_approved:'Estimate Approved',
  pre_order:        'Pre-Order',
  parts_ordered:    'Parts Ordered',
  parts_partial:    'Parts Partial',
  parts_complete:   'Parts Complete',
  scheduled:        'Scheduled',
  in_production:    'In Production',
  qa_check:         'QA Check',
  detail:           'Detail',
  ready_for_pickup: 'Ready for Pickup',
  delivered:        'Delivered',
  closed:           'Closed',
}

export const RO_STATUS_COLORS: Record<ROStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  new:              'default',
  estimate_pending: 'warning',
  estimate_approved:'info',
  pre_order:        'secondary',
  parts_ordered:    'warning',
  parts_partial:    'warning',
  parts_complete:   'success',
  scheduled:        'info',
  in_production:    'primary',
  qa_check:         'secondary',
  detail:           'secondary',
  ready_for_pickup: 'success',
  delivered:        'success',
  closed:           'default',
}

export interface RepairOrder {
  id: number
  shop_id: number
  ro_number: string
  job_number?: number | null
  customer_id: number
  vehicle_id: number | null
  csr_id: number | null
  estimator_id: number | null
  status: ROStatus
  job_status: JobStatus
  job_type: JobType | null
  job_class: JobClass | null
  priority: ROPriority
  dealer_ro_number: string | null
  dealer_id: number | null
  is_total_loss: boolean
  insurance_authorized: boolean
  deductible_amount: number | null
  is_maxed: boolean
  has_room_left_in_vehicle: boolean
  amount_left_in_vehicle: number | null
  rental_needed: boolean
  estimated_total: number | null
  actual_total: number | null
  arrived_at: string | null
  scheduled_out_date: string | null
  delivered_at: string | null
  submission_route: string | null
  insurance_claim_type?: string | null
  lot_location_id: number | null
  latest_voice_text: string | null
  latest_voice_timestamp: string | null
  zone: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customer?: Customer
  vehicle?: Vehicle
}

export interface RepairOrderListItem {
  id: number
  ro_number: string
  job_number?: number | null
  vehicle_id?: number | null
  status: ROStatus
  job_status?: JobStatus | null
  job_type: JobType | null
  priority: ROPriority
  is_total_loss?: boolean
  arrived_at?: string | null
  scheduled_out_date: string | null
  deleted_at?: string | null
  created_at: string
  rental_needed?: boolean
  estimated_total?: number | null
  actual_total?: number | null
  zone?: string | null
  has_outstanding_payment?: number | null
  job_total?: { amount: number }[] | null
  outstanding_balance?: { amount: number }[] | null
  delivered_at?: string | null
  csr?: { id: number; first_name: string; last_name: string } | null
  estimator?: { id: number; first_name: string; last_name: string } | null
  lot_location?: { name: string; zones?: { name: string } | null; lot_layouts?: { label: string } | null } | null
  customer?: { id: number; first_name: string; last_name: string; phone: string | null }
  customers?: { first_name: string; last_name: string; phone: string | null }
  vehicles?: { year: number | null; make: string | null; model: string | null; color: string | null }
  vehicle?: { id: number; year: number | null; make: string | null; model: string | null; trim: string | null; color: string | null; vin: string | null; license_plate: string | null }
  shop?: { id: number; name: string; brand_color: string | null }
}

export interface CreateROInput {
  customer_id: number
  vehicle_id?: number
  job_number?: number
  job_type?: JobType
  job_class?: JobClass
  priority?: ROPriority
  rental_needed?: boolean
  submission_route?: string
  notes?: string
  shop_id?: number
  dealer_ro_number?: string
  dealer_claim_type?: DealerClaimType
  insurance_claim_type?: '1st Party' | '3rd Party' | 'Both'
  is_total_loss?: boolean
  is_maxed?: boolean
  has_room_left_in_vehicle?: boolean
  amount_left_in_vehicle?: number
  arrived_at?: string
  scheduled_out_date?: string
  csr_id?: number
  estimator_id?: number
  lot_location_id?: number
  zone?: string
}

export interface StaffMember {
  id: number
  name: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  role_id: number | null
}

export interface LotLocation {
  id: number
  name: string
  zone: string | null
  layout_label?: string | null
  is_occupied: boolean
}

export interface UpdateROStatusInput {
  id: number
  status: ROStatus
  notes?: string
}

export interface UpdateJobStatusInput {
  id: number
  job_status: JobStatus
  notes?: string
}

export interface ROListParams extends ListParams {
  shop_id?: number
  status?: ROStatus
  tab?: string
  date_start?: string
  date_end?: string
  csr_id?: number
  customer_id?: number
  vehicle_id?: number
  show_deleted?: boolean
}

export interface ROListMetadata {
  total_open: number
  needs_attention: number
  outstanding_payments: number
  outstanding_balance_total: number
}

export interface ROListResponse {
  data: RepairOrderListItem[]
  pagination: { page: number; per_page: number; total: number }
  metadata: ROListMetadata
}

export interface Intake {
  id: number
  repair_order_id: number
  created_by: number | null
  created_at: string
  deleted_at: string | null
  is_towed: boolean
  is_driveable: boolean
  has_wrap: boolean
  has_ceramic_coating: boolean
  how_accident_happened: string | null
  point_of_impact: string | null
  date_of_loss: string | null
  prior_unrelated_damage: string | null
  damage_description: string | null
  customer_requests: string | null
  police_report_present: boolean
  mileage: number | null
  has_previous_estimate: boolean
  notes: string | null
}

export interface IntakeDetail {
  intake: Intake | null
  creator: { id: number; name: string } | null
  deleted_intake: Intake | null
}

export interface ROInsurance {
  id: number
  repair_order_id: number
  has_first_party: boolean
  has_third_party: boolean
  first_party_company: string | null
  first_party_claim_number: string | null
  first_party_rep_name: string | null
  first_party_rep_phone: string | null
  third_party_company: string | null
  third_party_claim_number: string | null
  third_party_rep_name: string | null
  third_party_rep_phone: string | null
  liability_percentage: string | null
  pd_limit: number | null
  notes: string | null
}

export interface Rental {
  id: number
  repair_order_id: number
  rental_company: string | null
  approved_daily_amount: number | null
  days_on_policy: number | null
  reservation_number: string | null
  contract_number: string | null
  rental_start_date: string | null
  rental_due_date: string | null
  notes: string | null
}

export interface ROEvent {
  id: number
  repair_order_id: number
  user_id: number | null
  type: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type PaymentMethod = 'cash' | 'check' | 'credit_card' | 'debit_card' | 'ach' | 'zelle' | 'other'
export type PayerType = 'customer' | 'insurance' | 'dealer' | 'warranty' | 'other'

export type TransactionType =
  | 'initial'
  | 'deductible'
  | 'supplement'
  | 'tow'
  | 'self_pay'
  | 'employee'
  | 'total_loss_fees'
  | 'customer_pay'

export type PaymentStatus = 'not_paid' | 'paid' | 'not_approved' | 'approved'

export interface PaymentEvent {
  id: number
  payment_id: number
  shop_id: number
  user_id: number | null
  notes: string | null
  created_at: string
  user?: { id: number; first_name: string; last_name: string } | null
}

export interface Payment {
  id: number
  shop_id: number
  repair_order_id: number
  invoice_id: number | null
  customer_id: number | null
  received_by: number | null
  received_by_user?: { id: number; first_name: string; last_name: string } | null
  amount: number         // cents
  insurance_total?: number | null  // cents — full deductible amount (deductible transactions only)
  transaction_type: TransactionType | null
  payment_status: PaymentStatus | null
  date_added: string | null
  payment_method: PaymentMethod | null
  payer_type: PayerType | null
  reference_number: string | null
  notes: string | null
  total_events?: number
  created_at: string
}

export interface PaymentWithContext extends Payment {
  customer?: { id: number; first_name: string; last_name: string; phone: string | null }
  repair_order?: { id: number; ro_number: string; job_number: number | null; vehicle_id: number | null; csr_id: number | null; status: ROStatus; job_type: JobType | null }
  vehicle?: { id: number; year: number | null; make: string | null; model: string | null; color: string | null } | null
  csr_user?: { id: number; first_name: string; last_name: string } | null
}

export interface PaymentsListAllParams extends ListParams {
  shop_id?: number
  customer_id?: number
  csr_id?: number
  payment_status?: PaymentStatus
  transaction_type?: TransactionType
  tab?: string
}

export interface TransactionsListMetadata {
  to_be_paid_count: number
  to_be_paid_total: number
  needs_approval_count: number
  paid_30d_total: number
}

export interface TransactionsListResponse {
  data: PaymentWithContext[]
  pagination: { page: number; per_page: number; total: number }
  metadata: TransactionsListMetadata | null
}

export interface CreatePaymentInput {
  repair_order_id: number
  amount: number  // cents
  insurance_total?: number  // cents — full deductible amount (for deductible transactions)
  transaction_type?: TransactionType
  payment_status?: PaymentStatus
  date_added?: string  // ISO date string
  received_by?: number | null
  notes?: string
}

export interface VoiceRecording {
  id: number
  repair_order_id: number | null
  created_by: number | null
  transcript: string | null
  transcript_status: 'pending' | 'processing' | 'complete' | 'failed'
  transcribed_at: string | null
  created_at: string
}
