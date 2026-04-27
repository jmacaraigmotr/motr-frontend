import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { PaymentWithContext } from '@/types/repairOrder'

const api = createApiClient(API_GROUPS.reports)

export interface TransactionsByCSRParams {
  shop_id?: number
}

/** Totals computed by reports/compute_csr_payment_metadata on the backend. */
export interface CSRPaymentMetadata {
  transaction_count: number
  total_outstanding: number
  total_not_paid: number
  total_not_approved: number
}

/** One CSR bucket as returned by the backend. */
export interface CSRTransactionGroup {
  csr: { id: number; first_name: string; last_name: string } | null
  metadata: CSRPaymentMetadata
  transactions: PaymentWithContext[]
}

/** Full response shape from GET /reports/transactions_by_csr. */
export interface TransactionsByCSRResponse {
  metadata: CSRPaymentMetadata & {
    shop_id: number
    csr_count: number
  }
  csrs: CSRTransactionGroup[]
}

export const reportsApi = {
  /**
   * Fetch all outstanding payments grouped by CSR.
   * Each CSR bucket includes pre-computed metadata (totals, counts).
   * Report-level grand totals are also returned in the top-level metadata field.
   */
  transactionsByCSR: async (params?: TransactionsByCSRParams): Promise<TransactionsByCSRResponse> =>
    api.get('/reports/transactions_by_csr', { params }),
}
