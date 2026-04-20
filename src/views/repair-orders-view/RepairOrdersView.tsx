import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { repairOrdersApi } from '@/api/repairOrders'
import { teamApi } from '@/api/team'
import type { RepairOrderListItem } from '@/types/repairOrder'
import RODetailDrawer from '../customer-view/components/RODetailDrawer'
import NewROWizard from '@/components/NewROWizard'
import { KpiCard, PageHeader, Button, StatusPill, FilterPill, EmptyState } from '@/ui'
import { formatCurrency } from '@/lib/utils'
import { format, isPast, isToday, isYesterday, isSameDay, subDays, parseISO } from 'date-fns'
import {
  Plus, MoreHorizontal, ClipboardList, AlertTriangle, DollarSign,
  Eye, Search, RefreshCw, UserMinus,
} from 'lucide-react'
import Tooltip from '@mui/material/Tooltip'
import Pagination from '@mui/material/Pagination'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

// ── Constants ─────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  insurance:  'Insurance',
  self_pay:   'Self Pay',
  dealer:     'Dealer',
  redo:       'Redo',
  fleet:      'Fleet',
  police_tow: 'Police Tow',
}

const PER_PAGE = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

function customerName(ro: RepairOrderListItem) {
  const c = ro.customer ?? ro.customers
  if (!c) return '—'
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
}

function vehicleLabel(ro: RepairOrderListItem) {
  const v = ro.vehicle ?? ro.vehicles
  if (!v) return '—'
  return `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim() || '—'
}

function colorLabel(ro: RepairOrderListItem) {
  const v = ro.vehicle ?? ro.vehicles
  return v?.color ?? null
}

function totalAmount(ro: RepairOrderListItem) {
  if (ro.job_total?.length) return ro.job_total.reduce((s, p) => s + p.amount, 0)
  return ro.actual_total ?? ro.estimated_total ?? null
}

function owedAmount(ro: RepairOrderListItem) {
  if (ro.outstanding_balance?.length) return ro.outstanding_balance.reduce((s, p) => s + p.amount, 0)
  return null
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'MMM d') } catch { return iso }
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type ViewTab = 'open' | 'needs_attention' | 'all' | 'closed'
             | 'available' | 'taken' | 'arrived' | 'delivered'

type DateOffset = 'today' | 'yesterday' | 'two_days_ago'

const PRIMARY_TABS: { key: ViewTab; label: string }[] = [
  { key: 'open',            label: 'Open'            },
  { key: 'needs_attention', label: 'Needs Attention' },
  { key: 'all',             label: 'All'             },
  { key: 'closed',          label: 'Closed'          },
]

const SECONDARY_TABS: { key: ViewTab; label: string }[] = [
  { key: 'available', label: 'Available for Sales' },
  { key: 'taken',     label: 'Taken for Sales'     },
  { key: 'arrived',   label: 'Arrived'             },
  { key: 'delivered', label: 'Delivered'           },
]

const DATE_OFFSETS: { key: DateOffset; label: string }[] = [
  { key: 'today',        label: 'Today'      },
  { key: 'yesterday',    label: 'Yesterday'  },
  { key: 'two_days_ago', label: '2 Days Ago' },
]

// arrived/delivered tabs filter client-side by date (backend can't range-compare date fields)
function matchesOffset(dateStr: string | null | undefined, offset: DateOffset): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (offset === 'today')        return isToday(d)
  if (offset === 'yesterday')    return isYesterday(d)
  return isSameDay(d, subDays(new Date(), 2))
}

// ── Row ⋯ menu ────────────────────────────────────────────────────────────────

function RORowMenu({ onView }: { onView: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget) }}
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
        <MenuItem onClick={onView} sx={{ fontSize: '13px', gap: 1.5 }}>View detail</MenuItem>
      </Menu>
    </>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function RepairOrdersView() {
  const { shop } = useAuth()
  const qc = useQueryClient()

  const [selectedROId, setSelectedROId] = useState<number | null>(null)
  const [wizardOpen,   setWizardOpen]   = useState(false)
  const [view,         setView]         = useState<ViewTab>('open')
  const [dateOffset,   setDateOffset]   = useState<DateOffset>('today')
  const [searchInput,  setSearchInput]  = useState('')
  const [search,       setSearch]       = useState('')
  const [csrId,        setCsrId]        = useState<number | null>(null)
  const [page,         setPage]         = useState(1)
  const [isFetching,   setIsFetching]   = useState(false)

  const showDatePicker = view === 'arrived' || view === 'delivered'

  // arrived/delivered tabs need a broad fetch for client-side date filtering
  const isDateTab = view === 'arrived' || view === 'delivered'

  // Debounced search — resets to page 1
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset to page 1 whenever tab, date, or CSR filter changes
  useEffect(() => { setPage(1) }, [view, dateOffset, csrId])

  const { data: teamMembers } = useQuery({
    queryKey: ['team_members', shop?.id],
    queryFn:  () => teamApi.listMembers({ shop_id: shop?.id }),
    enabled:  !!shop?.id,
    staleTime: 5 * 60_000,
  })

  const { data: activeData, isLoading, refetch } = useQuery({
    queryKey: ['repair_orders_list', shop?.id, view, isDateTab ? 'all' : page, isDateTab ? null : search, csrId],
    queryFn: () => repairOrdersApi.list({
      shop_id:  shop?.id,
      tab:      isDateTab ? 'all' : view,
      page:     isDateTab ? 1    : page,
      per_page: isDateTab ? 200  : PER_PAGE,
      search:   isDateTab ? undefined : (search || undefined),
      csr_id:   csrId ?? undefined,
    }),
    enabled:         !!shop?.id,
    staleTime:       15_000,
    placeholderData: prev => prev,
  })

  const rawItems = (activeData?.data ?? []) as RepairOrderListItem[]

  // For arrived/delivered: filter client-side by date offset then slice for current page
  const dateFilteredItems = useMemo(() => {
    if (!isDateTab) return rawItems
    return rawItems.filter(ro =>
      view === 'arrived'
        ? matchesOffset(ro.arrived_at, dateOffset)
        : matchesOffset(ro.delivered_at, dateOffset)
    )
  }, [isDateTab, rawItems, view, dateOffset])

  const pageItems = useMemo(() => {
    if (!isDateTab) return rawItems
    const start = (page - 1) * PER_PAGE
    return dateFilteredItems.slice(start, start + PER_PAGE)
  }, [isDateTab, rawItems, dateFilteredItems, page])

  const total          = isDateTab ? dateFilteredItems.length : (activeData?.pagination?.total ?? 0)
  const pageCount      = Math.max(1, Math.ceil(total / PER_PAGE))
  const openCount      = activeData?.metadata?.total_open ?? 0
  const needsCount     = activeData?.metadata?.needs_attention ?? 0
  const outstandingTotal = activeData?.metadata?.outstanding_balance_total ?? 0

  async function handleRefresh() {
    setIsFetching(true)
    await refetch()
    setIsFetching(false)
  }

  return (
    <div className="flex flex-col bg-[var(--surface-0)] min-h-full">

      {/* Header */}
      <PageHeader
        title="Repair Orders"
        description="Track open jobs, statuses, and scheduled work"
        actions={
          <Button
            variant="primary"
            size="md"
            leadingIcon={<Plus size={16} />}
            onClick={() => setWizardOpen(true)}
            className="hidden sm:inline-flex"
          >
            New Repair Order
          </Button>
        }
      />

      {/* Content */}
      <div className="px-6 pt-5 pb-16 w-full max-w-[1440px] mx-auto flex flex-col gap-4">

        {/* KPI cards */}
        <div className="flex gap-3 flex-wrap">
          <KpiCard
            label="Open ROs"
            value={isLoading ? '—' : openCount}
            caption={`${openCount === 1 ? '1 job' : `${openCount} jobs`} in progress`}
            icon={<ClipboardList size={17} />}
          />
          <KpiCard
            label="Needs Attention"
            value={isLoading ? '—' : needsCount}
            caption={needsCount > 0 ? 'Requires action today' : 'All jobs on track'}
            tone={needsCount > 0 ? 'warning' : 'neutral'}
            icon={<AlertTriangle size={17} />}
          />
          <KpiCard
            label="Outstanding Payments"
            value={isLoading ? '—' : outstandingTotal > 0 ? formatCurrency(outstandingTotal) : '—'}
            caption={outstandingTotal > 0 ? 'Awaiting collection' : 'No outstanding balance'}
            tone={outstandingTotal > 0 ? 'danger' : 'neutral'}
            icon={<DollarSign size={17} />}
          />
        </div>

        {/* Table card */}
        <div className="rounded-[20px] border border-[var(--line)] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] overflow-hidden">

          {/* Toolbar */}
          <div
            className="bg-[var(--surface-0)]"
            style={{ borderBottom: '1px solid var(--line)', boxShadow: '0 2px 6px -2px rgba(15,23,42,0.05)' }}
          >
            {/* Row 1: search + primary tabs + count + refresh */}
            <div className="flex items-center gap-2.5 px-5" style={{ minHeight: 52 }}>
              {/* Search */}
              <div className="relative w-72 shrink-0">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search jobs…"
                  className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] text-[13px] bg-white border border-[var(--line)] focus:outline-none focus:border-[var(--text-default)] focus:shadow-[0_0_0_3px_rgba(15,23,42,0.06)] transition-all placeholder:text-[var(--text-muted)]"
                  style={{ color: 'var(--text-default)' }}
                />
              </div>

              {/* Primary filter pills */}
              <div className="flex items-center gap-1" role="tablist">
                {PRIMARY_TABS.map(tab => (
                  <FilterPill
                    key={tab.key}
                    label={tab.label}
                    selected={view === tab.key}
                    count={tab.key === 'open' ? openCount : tab.key === 'needs_attention' ? needsCount : undefined}
                    onClick={() => { setView(tab.key); setPage(1) }}
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

            {/* Row 2: secondary tabs */}
            <div className="flex items-center gap-1 px-5 pb-3" role="tablist">
              {SECONDARY_TABS.map(tab => (
                <FilterPill
                  key={tab.key}
                  label={tab.label}
                  selected={view === tab.key}
                  onClick={() => { setView(tab.key); setPage(1) }}
                />
              ))}
            </div>

            {/* Row 3: date offset — only for Arrived / Delivered */}
            {showDatePicker && (
              <div className="flex items-center gap-1 px-5 pb-3" role="tablist">
                {DATE_OFFSETS.map(d => (
                  <FilterPill
                    key={d.key}
                    label={d.label}
                    selected={dateOffset === d.key}
                    onClick={() => { setDateOffset(d.key); setPage(1) }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'var(--surface-1)', borderBottom: '1.5px solid var(--line)' }}>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 whitespace-nowrap">Job / RO</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50">Customer</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden md:table-cell">Vehicle</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden lg:table-cell">Assigned</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden md:table-cell">Job Type</th>
                  <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50">Job Status</th>
                  <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 whitespace-nowrap hidden sm:table-cell">Sched Out</th>
                  <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden lg:table-cell">Billing</th>
                  <th className="h-11 px-4 w-36" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--line)] last:border-b-0">
                      {[30, 50, 60, 40, 30, 20, 30, 16].map((w, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <span className="block h-3.5 rounded-full bg-[var(--surface-2)] animate-pulse" style={{ width: `${w}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        template={search ? 'no-results' : 'no-records-yet'}
                        headline={view === 'needs_attention' ? 'No ROs need attention' : search ? 'No results found' : 'No repair orders'}
                        body={view === 'needs_attention' ? 'All repair orders are on track.' : undefined}
                        action={!search && view === 'open' ? { label: 'New Repair Order', onClick: () => setWizardOpen(true) } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  pageItems.map(ro => {
                    const jobStatusTone = ro.job_status === 'closed' ? 'done' : ro.job_status === 'waiting_for_payment' ? 'waiting' : 'in-progress'
                    const jobStatusLabel = ro.job_status === 'closed' ? 'Closed' : ro.job_status === 'waiting_for_payment' ? 'Waiting for Payment' : 'Open'
                    const owed = owedAmount(ro)
                    const total = totalAmount(ro)
                    const out = ro.scheduled_out_date
                    const isOverdue  = out && !['delivered', 'closed'].includes(ro.status) && isPast(parseISO(out))
                    const isDueToday = out && isToday(parseISO(out))
                    const csr = ro.csr
                    const est = ro.estimator

                    return (
                      <tr
                        key={ro.id}
                        onClick={() => setSelectedROId(ro.id)}
                        className="border-b border-[var(--line)] last:border-b-0 cursor-pointer group transition-colors odd:bg-white even:bg-[var(--surface-0)] hover:!bg-[var(--surface-1)]"
                      >
                        {/* Job / RO */}
                        <td className="px-5 py-3.5 align-middle whitespace-nowrap">
                          <span className="block text-[13.5px] font-semibold text-[var(--text-strong)] leading-tight">
                            {ro.job_number ? `#${ro.job_number}` : '—'}
                          </span>
                          <span className="block font-mono text-[11px] text-[var(--text-muted)] tabular-nums leading-tight mt-0.5">
                            {ro.ro_number}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="px-5 py-3.5 align-middle max-w-[180px]">
                          <span className="block truncate text-[13.5px] font-medium text-[var(--text-default)] leading-tight">
                            {customerName(ro)}
                          </span>
                        </td>

                        {/* Vehicle */}
                        <td className="px-5 py-3.5 align-middle hidden md:table-cell max-w-[200px]">
                          <span className="block truncate text-[13px] text-[var(--text-default)] leading-tight">
                            {vehicleLabel(ro)}
                          </span>
                          {colorLabel(ro) && (
                            <span className="block text-[11.5px] text-[var(--text-muted)] leading-tight mt-0.5">
                              {colorLabel(ro)}
                            </span>
                          )}
                        </td>

                        {/* Assigned */}
                        <td className="px-5 py-3.5 align-middle hidden lg:table-cell">
                          {csr || est ? (
                            <div className="flex flex-col gap-0.5">
                              {csr && (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] shrink-0">CSR</span>
                                  <span className="text-[12.5px] text-[var(--text-default)] leading-tight">{csr.first_name} {csr.last_name}</span>
                                </div>
                              )}
                              {est && (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] shrink-0">Est</span>
                                  <span className="text-[12px] text-[var(--text-muted)] leading-tight">{est.first_name} {est.last_name}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)] italic select-none">
                              <UserMinus size={11} className="shrink-0 opacity-40" />
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Job Type */}
                        <td className="px-5 py-3.5 align-middle hidden md:table-cell whitespace-nowrap">
                          <span className="text-[12.5px] text-[var(--text-default)]">
                            {ro.job_type ? (JOB_TYPE_LABELS[ro.job_type] ?? ro.job_type) : <span className="text-[var(--text-muted)]">—</span>}
                          </span>
                        </td>

                        {/* Job Status */}
                        <td className="px-5 py-3.5 align-middle">
                          <StatusPill label={jobStatusLabel} tone={jobStatusTone} />
                        </td>

                        {/* Sched out */}
                        <td className="px-5 py-3.5 align-middle text-right hidden sm:table-cell whitespace-nowrap">
                          <span
                            className={[
                              'font-mono text-[12px] tabular-nums',
                              isOverdue  ? 'text-[var(--danger-fg)] font-semibold' :
                              isDueToday ? 'text-[var(--warning-fg)] font-semibold' :
                                           'text-[var(--text-muted)]',
                            ].join(' ')}
                          >
                            {fmtDate(out)}
                            {isOverdue ? ' · OVR' : ''}
                          </span>
                        </td>

                        {/* Billing */}
                        <td className="px-5 py-3.5 align-middle text-right hidden lg:table-cell whitespace-nowrap">
                          {total != null ? (
                            <span className="block font-mono text-[12px] tabular-nums text-[var(--text-default)] leading-tight">
                              {formatCurrency(total)}
                            </span>
                          ) : null}
                          {owed != null && owed > 0 ? (
                            <span className="block font-mono text-[11px] tabular-nums text-[var(--danger-fg)] leading-tight">
                              {formatCurrency(owed)} owed
                            </span>
                          ) : null}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 align-middle text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => setSelectedROId(ro.id)}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--text-default)] border border-[var(--line)] bg-transparent hover:bg-[var(--surface-1)] transition-colors"
                            >
                              <Eye size={12} className="shrink-0" />
                              View
                            </button>
                            <RORowMenu onView={() => setSelectedROId(ro.id)} />
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
      <NewROWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(_n, roId) => {
          setWizardOpen(false)
          qc.invalidateQueries({ queryKey: ['repair_orders_list'] })
          setSelectedROId(roId)
        }}
      />
      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />
    </div>
  )
}
