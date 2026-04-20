import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { repairOrdersApi } from '@/api/repairOrders'
import { customersApi } from '@/api/customers'
import { vehiclesApi } from '@/api/vehicles'
import { teamApi } from '@/api/team'
import type { PaymentWithContext, TransactionType, PaymentStatus } from '@/types/repairOrder'
import type { Customer } from '@/types/customer'
import { TRANSACTION_TYPES } from '@/lib/transactionConstants'
import { formatDate, formatCurrency } from '@/lib/utils'
import RODetailDrawer from '../customer-view/components/RODetailDrawer'
import AddTransactionDialog from '../customers-view/components/AddTransactionDialog'
import CustomerDetailDialog from '../customers-view/components/CustomerDetailDialog'
import CustomerEditDialog from '../customers-view/components/CustomerEditDialog'
import TransactionDetailsModal from '@/components/TransactionDetailsModal'
import VehicleDetailDialog from '../customers-view/components/VehicleDetailDialog'
import NewROWizard from '@/components/NewROWizard'
import { KpiCard, PageHeader, Button, StatusPill, FilterPill, EmptyState } from '@/ui'
import type { StatusTone } from '@/ui'
import { Plus, Search, RefreshCw, DollarSign, AlertCircle, CheckCircle, Eye, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import Tooltip from '@mui/material/Tooltip'
import Pagination from '@mui/material/Pagination'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

// ── Helpers ───────────────────────────────────────────────────────────────────

function paymentStatusTone(status: PaymentStatus | null | undefined): StatusTone {
  switch (status) {
    case 'paid':         return 'done'
    case 'approved':     return 'done'
    case 'not_approved': return 'waiting'
    case 'not_paid':     return 'waiting'
    default:             return 'draft'
  }
}

function paymentStatusLabel(status: PaymentStatus | null | undefined): string {
  switch (status) {
    case 'paid':         return 'Paid'
    case 'approved':     return 'Approved'
    case 'not_approved': return 'Unapproved'
    case 'not_paid':     return 'Unpaid'
    default:             return '—'
  }
}

function txTypeLabel(type: TransactionType | null | undefined): string {
  return TRANSACTION_TYPES.find(t => t.value === type)?.label ?? (type ?? '—')
}

const JOB_TYPE_LABELS: Record<string, string> = {
  insurance:  'Insurance',
  self_pay:   'Self Pay',
  dealer:     'Dealer',
  redo:       'Redo',
  fleet:      'Fleet',
  police_tow: 'Police Tow',
}

function TxRowMenu({ onDelete }: { onDelete: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget) }}
        aria-label="Row actions"
        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-default)] transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={() => setAnchor(null)}
        PaperProps={{ sx: { borderRadius: '8px', minWidth: 160, boxShadow: 'var(--shadow-raised)', border: '1px solid var(--line)' } }}
      >
        <MenuItem onClick={onDelete} sx={{ fontSize: '13px', gap: 1.5, color: 'var(--danger-fg)' }}>
          <Trash2 size={14} /> Delete
        </MenuItem>
      </Menu>
    </>
  )
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type TxTab = 'all' | 'unpaid' | 'unapproved' | 'paid_approved'

const TX_TABS: { key: TxTab; label: string }[] = [
  { key: 'all',          label: 'All'              },
  { key: 'unpaid',       label: 'Unpaid'           },
  { key: 'unapproved',   label: 'Unapproved'       },
  { key: 'paid_approved', label: 'Paid / Approved' },
]

const PER_PAGE = 10

// ── Main View ─────────────────────────────────────────────────────────────────

export default function AccountingView() {
  const { shop } = useAuth()
  const qc = useQueryClient()

  const [searchInput,        setSearchInput]        = useState('')
  const [search,             setSearch]             = useState('')
  const [txTab,              setTxTab]              = useState<TxTab>('all')
  const [csrId,              setCsrId]              = useState<number | null>(null)
  const [page,               setPage]               = useState(1)
  const [isFetching,         setIsFetching]         = useState(false)
  const [selectedROId,       setSelectedROId]       = useState<number | null>(null)
  const [selectedPayment,    setSelectedPayment]    = useState<PaymentWithContext | null>(null)
  const [selectedVehicleId,  setSelectedVehicleId]  = useState<number | null>(null)
  const [vehicleCustomerId,  setVehicleCustomerId]  = useState<number | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [editCustomer,       setEditCustomer]       = useState<Customer | null>(null)
  const [newROCustomer,      setNewROCustomer]      = useState<Customer | null>(null)
  const [addTxOpen,          setAddTxOpen]          = useState(false)

  const { data: customerData } = useQuery({
    queryKey: ['customer_detail_tx', selectedCustomerId],
    queryFn: () => customersApi.get(selectedCustomerId!),
    enabled: selectedCustomerId !== null,
    staleTime: 60_000,
  })

  const { data: vehicleList } = useQuery({
    queryKey: ['vehicles_for_tx', vehicleCustomerId],
    queryFn:  () => vehiclesApi.listByCustomer(vehicleCustomerId!),
    enabled:  vehicleCustomerId !== null,
    staleTime: 60_000,
  })
  const vehicleForDialog = vehicleList?.find(v => v.id === selectedVehicleId) ?? null

  const { data: teamMembers } = useQuery({
    queryKey: ['team_members', shop?.id],
    queryFn:  () => teamApi.listMembers({ shop_id: shop?.id }),
    enabled:  !!shop?.id,
    staleTime: 5 * 60_000,
  })

  const deleteMut = useMutation({
    mutationFn: repairOrdersApi.deletePayment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions_all'], exact: false }),
  })

  // Debounced search — resets to page 1
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset page when tab or CSR filter changes
  useEffect(() => { setPage(1) }, [txTab, csrId])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions_all', { shop_id: shop?.id, tab: txTab, page, search, csrId }],
    queryFn: () => repairOrdersApi.listAllPayments({
      shop_id:  shop?.id,
      tab:      txTab === 'all' ? undefined : txTab,
      csr_id:   csrId ?? undefined,
      page,
      per_page: PER_PAGE,
      search:   search || undefined,
    }),
    staleTime:       30_000,
    placeholderData: prev => prev,
  })

  const pageItems      = (data?.data ?? []) as PaymentWithContext[]
  const total          = data?.pagination?.total ?? 0
  const pageCount      = Math.max(1, Math.ceil(total / PER_PAGE))

  // KPI counts from metadata
  const toBePaidTotal      = data?.metadata?.to_be_paid_total      ?? 0
  const toBePaidCount      = data?.metadata?.to_be_paid_count      ?? 0
  const needsApprovalCount = data?.metadata?.needs_approval_count  ?? 0
  const paid30d            = data?.metadata?.paid_30d_total        ?? 0

  async function handleRefresh() {
    setIsFetching(true)
    await refetch()
    setIsFetching(false)
  }

  return (
    <div className="flex flex-col bg-[var(--surface-0)] min-h-full">

      {/* Header */}
      <PageHeader
        title="Transactions"
        description="Payment records, approvals, and financial overview"
        actions={
          <Button
            variant="primary"
            size="md"
            leadingIcon={<Plus size={16} />}
            onClick={() => setAddTxOpen(true)}
          >
            Add Transaction
          </Button>
        }
      />

      {/* Content */}
      <div className="px-6 pt-5 pb-16 w-full max-w-[1440px] mx-auto flex flex-col gap-4">

        {/* KPI cards */}
        <div className="flex gap-3 flex-wrap">
          <KpiCard
            label="To Be Paid"
            value={isLoading ? '—' : formatCurrency(toBePaidTotal)}
            caption={`${toBePaidCount} invoice${toBePaidCount !== 1 ? 's' : ''} outstanding`}
            tone={toBePaidTotal > 0 ? 'danger' : 'neutral'}
            icon={<DollarSign size={17} />}
          />
          <KpiCard
            label="Needs Approval"
            value={isLoading ? '—' : needsApprovalCount}
            caption={needsApprovalCount > 0 ? 'Pending review' : 'Nothing pending'}
            tone={needsApprovalCount > 0 ? 'warning' : 'neutral'}
            icon={<AlertCircle size={17} />}
          />
          <KpiCard
            label="Paid (last 30d)"
            value={isLoading ? '—' : formatCurrency(paid30d)}
            caption="Collected in the past 30 days"
            icon={<CheckCircle size={17} />}
          />
        </div>

        {/* Table card */}
        <div className="rounded-[20px] border border-[var(--line)] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] overflow-hidden">

          {/* Toolbar */}
          <div
            className="flex items-center gap-2.5 px-5 bg-[var(--surface-0)]"
            style={{ minHeight: 52, borderBottom: '1px solid var(--line)', boxShadow: '0 2px 6px -2px rgba(15,23,42,0.05)' }}
          >
            {/* Search */}
            <div className="relative w-72 shrink-0">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search transactions…"
                className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] text-[13px] bg-white border border-[var(--line)] focus:outline-none focus:border-[var(--text-default)] focus:shadow-[0_0_0_3px_rgba(15,23,42,0.06)] transition-all placeholder:text-[var(--text-muted)]"
                style={{ color: 'var(--text-default)' }}
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1" role="tablist">
              {TX_TABS.map(tab => (
                <FilterPill
                  key={tab.key}
                  label={tab.label}
                  selected={txTab === tab.key}
                  count={
                    tab.key === 'unpaid'     ? toBePaidCount :
                    tab.key === 'unapproved' ? needsApprovalCount :
                    undefined
                  }
                  onClick={() => { setTxTab(tab.key); setPage(1) }}
                />
              ))}
            </div>

            {/* CSR filter */}
            {teamMembers && teamMembers.some(m => m.role_id === 5) && (
              <select
                value={csrId ?? ''}
                onChange={e => setCsrId(e.target.value ? Number(e.target.value) : null)}
                className="h-9 pl-3 pr-7 rounded-[var(--radius-md)] text-[13px] bg-white border border-[var(--line)] text-[var(--text-default)] focus:outline-none focus:border-[var(--text-default)] appearance-none cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                <option value="">All CSRs</option>
                {teamMembers.filter(m => m.role_id === 5).map(m => (
                  <option key={m.id} value={m.id}>
                    {`${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex-1" />

            {/* Count */}
            <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
              {isLoading ? '…' : `${total.toLocaleString()} ${total === 1 ? 'record' : 'records'}`}
            </span>

            <div className="h-4 w-px bg-[var(--line)]" />

            {/* Refresh */}
            <Tooltip title="Refresh" placement="top">
              <button
                onClick={handleRefresh}
                disabled={isFetching || isLoading}
                aria-label="Refresh"
                className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-default)] disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={13} className={(isFetching || isLoading) ? 'animate-spin' : ''} />
              </button>
            </Tooltip>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'var(--surface-1)', borderBottom: '1.5px solid var(--line)' }}>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 whitespace-nowrap">Date</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50">Job</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50">Customer</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden md:table-cell">Job Type</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden lg:table-cell">Vehicle</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden sm:table-cell">Type</th>
                  <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50">Amount</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50">Status</th>
                  <th className="h-11 px-5 text-center text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden sm:table-cell">Events</th>
                  <th className="h-11 px-4 w-40" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--line)] last:border-b-0">
                      {[20, 30, 50, 30, 40, 40, 20, 30, 10, 16].map((w, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <span className="block h-3.5 rounded-full bg-[var(--surface-2)] animate-pulse" style={{ width: `${w}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        template={search ? 'no-results' : 'no-records-yet'}
                        headline={search ? 'No transactions match your search' : 'No transactions yet'}
                        action={!search ? { label: 'Add Transaction', onClick: () => setAddTxOpen(true) } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  pageItems.map(p => {
                    const ro = p.repair_order
                    const customer = p.customer
                    const csrUser = p.csr_user
                    const isNegative = p.amount < 0
                    const tone = paymentStatusTone(p.payment_status)

                    const vehicle = p.vehicle
                    const jobType = ro?.job_type

                    return (
                      <tr
                        key={p.id}
                        className="border-b border-[var(--line)] last:border-b-0 group transition-colors odd:bg-white even:bg-[var(--surface-0)] hover:!bg-[var(--surface-1)]"
                      >
                        {/* Date */}
                        <td className="px-5 py-3.5 align-middle whitespace-nowrap">
                          <span className="font-mono text-[12px] text-[var(--text-muted)] tabular-nums">
                            {formatDate(p.date_added ?? p.created_at)}
                          </span>
                        </td>

                        {/* Job — click opens RO drawer */}
                        <td className="px-5 py-3.5 align-middle whitespace-nowrap">
                          {ro ? (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedROId(ro.id) }}
                                className="text-[13.5px] font-semibold text-[var(--text-strong)] hover:underline text-left"
                              >
                                {ro.job_number != null ? `#${ro.job_number}` : ro.ro_number}
                              </button>
                              {csrUser && (
                                <span className="text-[11.5px] text-[var(--text-muted)]">
                                  <span className="font-medium">CSR:</span> {csrUser.first_name} {csrUser.last_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="font-mono text-[12px] text-[var(--text-muted)]">
                              RO #{p.repair_order_id}
                            </span>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="px-5 py-3.5 align-middle max-w-[180px]">
                          {customer ? (
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedCustomerId(customer.id) }}
                              className="text-left truncate text-[13px] text-[var(--text-default)] hover:underline"
                            >
                              {customer.first_name} {customer.last_name}
                            </button>
                          ) : (
                            <span className="text-[13px] text-[var(--text-muted)] italic">—</span>
                          )}
                        </td>

                        {/* Job Type */}
                        <td className="px-5 py-3.5 align-middle hidden md:table-cell whitespace-nowrap">
                          <span className="text-[12.5px] text-[var(--text-default)]">
                            {jobType ? (JOB_TYPE_LABELS[jobType] ?? jobType) : <span className="text-[var(--text-muted)]">—</span>}
                          </span>
                        </td>

                        {/* Vehicle */}
                        <td className="px-5 py-3.5 align-middle hidden lg:table-cell max-w-[160px]">
                          {vehicle ? (
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedVehicleId(vehicle.id); setVehicleCustomerId(customer?.id ?? null) }}
                              className="block truncate text-[12.5px] text-[var(--text-default)] hover:underline text-left max-w-[160px]"
                            >
                              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
                            </button>
                          ) : (
                            <span className="text-[12.5px] text-[var(--text-muted)]">—</span>
                          )}
                        </td>

                        {/* Tx Type */}
                        <td className="px-5 py-3.5 align-middle hidden sm:table-cell">
                          <span className="text-[12.5px] text-[var(--text-muted)]">
                            {txTypeLabel(p.transaction_type)}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-3.5 align-middle text-right whitespace-nowrap">
                          <span
                            className={[
                              'font-mono text-[14px] font-semibold tabular-nums',
                              isNegative ? 'text-[var(--danger-fg)]' : 'text-[var(--text-default)]',
                            ].join(' ')}
                          >
                            {isNegative ? '−' : ''}{formatCurrency(Math.abs(p.amount))}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 align-middle">
                          <StatusPill label={paymentStatusLabel(p.payment_status)} tone={tone} />
                        </td>

                        {/* Events */}
                        <td className="px-5 py-3.5 align-middle text-center hidden sm:table-cell">
                          {(p.total_events ?? 0) > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-default)]">
                              {p.total_events}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--text-muted)]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 align-middle" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => setSelectedPayment(p)}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--text-default)] border border-[var(--line)] bg-transparent hover:bg-[var(--surface-1)] transition-colors"
                            >
                              <Eye size={12} className="shrink-0" />
                              View
                            </button>
                            <button
                              onClick={() => setSelectedPayment(p)}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--text-default)] border border-[var(--line)] bg-transparent hover:bg-[var(--surface-1)] transition-colors"
                            >
                              <Pencil size={12} className="shrink-0" />
                              Edit
                            </button>
                            <TxRowMenu onDelete={() => deleteMut.mutate(p.id)} />
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--line)] bg-[var(--surface-0)]">
              <span className="text-[12px] text-[var(--text-muted)]">
                {total.toLocaleString()} records
              </span>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_, v) => setPage(v)}
                size="small"
                sx={{
                  '& .MuiPaginationItem-root': { borderRadius: '6px', fontSize: '12px' },
                  '& .Mui-selected': { bgcolor: 'var(--text-strong) !important', color: '#fff' },
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />
      <TransactionDetailsModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
      {vehicleForDialog && (
        <VehicleDetailDialog
          vehicle={vehicleForDialog}
          onClose={() => { setSelectedVehicleId(null); setVehicleCustomerId(null) }}
          onEdit={() => {}}
          onDelete={() => {}}
          onNewRO={() => {}}
          onSelectRO={id => setSelectedROId(id)}
        />
      )}

      {addTxOpen && (
        <AddTransactionDialog
          onClose={() => setAddTxOpen(false)}
          onSaved={() => {
            setAddTxOpen(false)
            qc.invalidateQueries({ queryKey: ['transactions_all'] })
          }}
        />
      )}

      {selectedCustomerId && customerData?.customer && (
        <CustomerDetailDialog
          customer={customerData.customer}
          onClose={() => setSelectedCustomerId(null)}
          onEdit={() => { setEditCustomer(customerData.customer); setSelectedCustomerId(null) }}
          onNewRO={() => { setNewROCustomer(customerData.customer); setSelectedCustomerId(null) }}
        />
      )}

      {editCustomer && (
        <CustomerEditDialog
          customer={editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={() => setEditCustomer(null)}
        />
      )}

      {newROCustomer && (
        <NewROWizard
          open
          preselectedCustomer={newROCustomer}
          onClose={() => setNewROCustomer(null)}
          onSuccess={(_n, roId) => {
            setNewROCustomer(null)
            setSelectedROId(roId)
          }}
        />
      )}
    </div>
  )
}
