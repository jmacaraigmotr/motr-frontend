import type { TransactionType, PaymentStatus, PaymentMethod, PayerType } from '@/types/repairOrder'

export const TRANSACTION_TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: 'initial',         label: 'Initial',         color: '#3B82F6' },
  { value: 'deductible',      label: 'Deductible',      color: '#22C55E' },
  { value: 'supplement',      label: 'Supplement',      color: '#F59E0B' },
  { value: 'tow',             label: 'Tow',             color: '#8B5CF6' },
  { value: 'self_pay',        label: 'Self-Pay',        color: '#EC4899' },
  { value: 'employee',        label: 'Employee',        color: '#06B6D4' },
  { value: 'total_loss_fees', label: 'Total Loss Fees', color: '#F97316' },
  { value: 'customer_pay',    label: 'Customer Pay',    color: '#6366F1' },
]

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'not_paid',     label: 'Not Paid',     color: '#EF4444' },
  { value: 'paid',         label: 'Paid',         color: '#22C55E' },
  { value: 'not_approved', label: 'Not Approved', color: '#F59E0B' },
  { value: 'approved',     label: 'Approved',     color: '#3B82F6' },
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',        label: 'Cash'        },
  { value: 'check',       label: 'Check'       },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card',  label: 'Debit Card'  },
  { value: 'ach',         label: 'ACH Transfer'},
  { value: 'zelle',       label: 'Zelle'       },
  { value: 'other',       label: 'Other'       },
]

export const PAYER_TYPES: { value: PayerType; label: string }[] = [
  { value: 'customer',  label: 'Customer'  },
  { value: 'insurance', label: 'Insurance' },
  { value: 'dealer',    label: 'Dealer'    },
  { value: 'warranty',  label: 'Warranty'  },
  { value: 'other',     label: 'Other'     },
]
