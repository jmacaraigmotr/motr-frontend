import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import { repairOrdersApi } from '@/api/repairOrders'
import { teamApi } from '@/api/team'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/uiStore'
import type { Customer, PreferredContact } from '@/types/customer'
import NewROWizard from '@/components/NewROWizard'
import RODetailDrawer from '@/views/customer-view/components/RODetailDrawer'
import CustomerDetailDialog   from './components/CustomerDetailDialog'
import CustomerEditDialog     from './components/CustomerEditDialog'
import CustomerDeleteDialog   from './components/CustomerDeleteDialog'
import AddVehicleDialog       from './components/AddVehicleDialog'
import AddTransactionDialog   from './components/AddTransactionDialog'
import { PageHeader, Button, Avatar, EmptyState, KpiCard } from '@/ui'
import {
  MoreHorizontal, UserPlus, RefreshCw, Car, FileText, Pencil, Trash2,
  Phone, Mail, MessageSquare, ClipboardList, Users, Activity, Search, UserMinus, Eye,
} from 'lucide-react'
import Tooltip from '@mui/material/Tooltip'
import Pagination from '@mui/material/Pagination'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(c: Customer) {
  return `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase()
}

const CONTACT_META: Record<PreferredContact, { label: string; icon: React.ElementType; color: string }> = {
  phone: { label: 'Phone',       icon: Phone,        color: 'var(--info-fg)'    },
  email: { label: 'Email',       icon: Mail,         color: 'var(--text-muted)' },
  text:  { label: 'Text',        icon: MessageSquare, color: 'var(--success-fg)' },
}

function PrefContactBadge({ value }: { value: PreferredContact | null }) {
  if (!value) return (
    <span className="inline-flex items-center rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">—</span>
  )
  const meta = CONTACT_META[value]
  const Icon = meta.icon
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-medium shrink-0"
      style={{ color: meta.color }}
    >
      <Icon size={10} className="shrink-0" />
      {meta.label}
    </span>
  )
}

// ── Row action menu ───────────────────────────────────────────────────────────

function RowMenu({
  customer, onDetail, onEdit, onDelete, onAddVehicle, onAddRO,
}: {
  customer: Customer
  onDetail: () => void
  onEdit: () => void
  onDelete: () => void
  onAddVehicle: () => void
  onAddRO: () => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget) }}
        aria-label="More actions"
        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-default)] transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={() => setAnchor(null)}
        PaperProps={{ sx: { borderRadius: '8px', minWidth: 188, boxShadow: 'var(--shadow-raised)', border: '1px solid var(--line)' } }}
      >
        <MenuItem onClick={onDetail}    sx={{ fontSize: '13px', gap: 1.5 }}><FileText size={14} /> View Profile</MenuItem>
        <MenuItem onClick={onAddRO}     sx={{ fontSize: '13px', gap: 1.5 }}><ClipboardList size={14} /> New Repair Order</MenuItem>
        <MenuItem onClick={onAddVehicle} sx={{ fontSize: '13px', gap: 1.5 }}><Car size={14} /> Add Vehicle</MenuItem>
        <MenuItem onClick={onEdit}      sx={{ fontSize: '13px', gap: 1.5 }}><Pencil size={14} /> Edit Customer</MenuItem>
        <MenuItem onClick={onDelete}    sx={{ fontSize: '13px', gap: 1.5, color: 'var(--danger-fg)' }}><Trash2 size={14} /> Archive</MenuItem>
      </Menu>
    </>
  )
}

// ── Filter options ────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { key: 'all',    label: 'All'           },
  { key: 'active', label: 'With Open ROs' },
]

// ── Main View ─────────────────────────────────────────────────────────────────

type DialogType = 'detail' | 'edit' | 'delete' | 'addRO' | 'addVehicle' | 'addTransaction' | null

export default function CustomersView() {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const { tourAction, setTourAction } = useUIStore()

  const [page,         setPage]        = useState(1)
  const [perPage]                      = useState(5)
  const [searchInput,  setSearchInput] = useState('')
  const [search,       setSearch]      = useState('')
  const [filter,       setFilter]      = useState('all')
  const [sortDir,      setSortDir]     = useState<'asc' | 'desc'>('asc')
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null)
  const [dialog,         setDialog]         = useState<DialogType>(null)
  const [newROId,        setNewROId]         = useState<number | null>(null)
  const [roClickCustomer, setRoClickCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['customers_table', { shop_id: shop?.id, page, per_page: perPage, search, filter, sortDir }],
    queryFn: () => customersApi.list({
      shop_id: shop?.id,
      page,
      per_page: perPage,
      search: search.trim() ? search : undefined,
      with_open_ros: filter === 'active',
      sort_dir: sortDir,
    }),
    staleTime: 30_000,
    placeholderData: prev => prev,
  })

  const { data: roChipData } = useQuery({
    queryKey: ['ro_chip_lookup', roClickCustomer?.id],
    queryFn:  () => repairOrdersApi.list({ customer_id: roClickCustomer!.id, per_page: 1 }),
    enabled:  !!roClickCustomer,
    staleTime: 0,
  })

  const { data: teamMembers } = useQuery({
    queryKey: ['team_members', shop?.id],
    queryFn:  () => teamApi.listMembers(shop?.id ? { shop_id: shop.id } : undefined),
    enabled: !!shop?.id,
    staleTime: 5 * 60_000,
  })

  const csrMap = new Map((teamMembers ?? []).map(m => [
    m.id,
    `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.name || `#${m.id}`,
  ]))

  useEffect(() => {
    if (roChipData?.data?.[0]?.id) {
      setNewROId(roChipData.data[0].id)
      setRoClickCustomer(null)
    }
  }, [roChipData])

  const allCustomers     = data?.data ?? []
  const total            = data?.pagination?.total ?? 0
  const totalPages       = Math.max(1, Math.ceil(total / perPage))
  const customers        = allCustomers
  const withOpenROsTotal = data?.metadata?.with_open_ros ?? 0

  function openDialog(type: DialogType, customer: Customer) {
    setActiveCustomer(customer); setDialog(type)
  }
  function closeDialog() { setDialog(null); setActiveCustomer(null) }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['customers_table'] })
    qc.invalidateQueries({ queryKey: ['customers'] })
  }

  useEffect(() => {
    if (!tourAction) return
    if (tourAction === 'open-add-customer') {
      setActiveCustomer(null); setDialog('edit'); setTourAction(null)
    } else if (tourAction === 'open-first-customer') {
      if (allCustomers.length > 0) openDialog('detail', allCustomers[0])
      setTourAction(null)
    } else if (tourAction === 'close-all') {
      closeDialog(); setTourAction(null)
    }
  }, [tourAction]) // eslint-disable-line

  return (
    <div className="flex flex-col bg-[var(--surface-0)] min-h-full">

      {/* ── Page header ── */}
      <PageHeader
        title="Customers"
        description="Customer records, contact details, and repair history"
        actions={
          <Button
            data-tour-id="add-customer-btn"
            variant="primary"
            size="md"
            leadingIcon={<UserPlus size={16} />}
            onClick={() => { setActiveCustomer(null); setDialog('edit') }}
          >
            Add Customer
          </Button>
        }
      />

      {/* ── Content ── */}
      <div className="px-6 pt-5 pb-16 w-full max-w-[1440px] mx-auto flex flex-col gap-4">

        {/* KPI cards */}
        <div className="flex gap-3 flex-wrap">
          <KpiCard
            label="Total Customers"
            value={isLoading ? '—' : total.toLocaleString()}
            caption={isLoading ? '' : `${total === 1 ? '1 record' : `${total} records`} in your database`}
            icon={<Users size={17} />}
          />
          <KpiCard
            label="With Active ROs"
            value={isLoading ? '—' : withOpenROsTotal}
            caption={isLoading ? '' : `${withOpenROsTotal} customer${withOpenROsTotal !== 1 ? 's' : ''} with open repair orders`}
            icon={<Activity size={17} />}
          />
        </div>

        {/* ── Table card (toolbar + table + pagination unified) ── */}
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
                placeholder="Search customers…"
                className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] text-[13px] bg-white border border-[var(--line)] focus:outline-none focus:border-[var(--text-default)] focus:shadow-[0_0_0_3px_rgba(15,23,42,0.06)] transition-all placeholder:text-[var(--text-muted)]"
                style={{ color: 'var(--text-default)' }}
              />
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setFilter(opt.key); setPage(1) }}
                  className={[
                    'h-8 px-3 rounded-[var(--radius-md)] text-[12px] font-medium transition-colors',
                    filter === opt.key
                      ? 'bg-[var(--text-strong)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-default)] hover:bg-[var(--surface-2)]',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Count */}
            <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
              {isLoading ? '…' : `${total.toLocaleString()} total`}
            </span>

            <div className="h-4 w-px bg-[var(--line)]" />

            {/* Sort */}
            <button
              onClick={() => { setSortDir(p => p === 'asc' ? 'desc' : 'asc'); setPage(1) }}
              className="flex items-center gap-1 h-8 px-2.5 rounded-[var(--radius-md)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-default)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Name {sortDir === 'asc' ? '↑' : '↓'}
            </button>

            {/* Refresh */}
            <Tooltip title="Refresh" placement="top">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh"
                className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-default)] disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              </button>
            </Tooltip>
          </div>

          {/* Table */}
          <table className="w-full border-collapse text-[14px]">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: 'var(--surface-1)', borderBottom: '1.5px solid var(--line)' }}>
                <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50">Customer</th>
                <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden sm:table-cell">Contact</th>
                <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden md:table-cell">Engagement</th>
                <th className="h-11 px-5 w-40 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-default)] opacity-50 hidden lg:table-cell">Assigned CSR</th>
                <th className="h-11 px-4 w-36" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-b-0">
                    {[50, 70, 50, 35, 28].map((w, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <span className="block h-3.5 rounded-full bg-[var(--surface-2)] animate-pulse" style={{ width: `${w}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      template={search ? 'no-results' : 'no-records-yet'}
                      headline={search ? 'No customers match your search' : 'No customers yet'}
                      action={!search ? { label: 'Add Customer', onClick: () => { setActiveCustomer(null); setDialog('edit') } } : undefined}
                    />
                  </td>
                </tr>
              ) : (
                customers.map(customer => (
                  <tr
                    key={customer.id}
                    onClick={() => openDialog('detail', customer)}
                    className="border-b border-[var(--line)] cursor-pointer group transition-colors last:border-b-0 odd:bg-white even:bg-[var(--surface-0)] hover:!bg-[var(--surface-1)]"
                  >
                    {/* Customer */}
                    <td className="px-5 py-3.5 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={getInitials(customer)} size="md" />
                        <div className="min-w-0 flex flex-col justify-center">
                          <span className="block text-[13.5px] font-semibold text-[var(--text-strong)] truncate leading-tight">
                            {customer.first_name} {customer.last_name}
                          </span>
                          {customer.company?.name && (
                            <span className="block text-[11.5px] text-[var(--text-muted)] truncate leading-tight mt-0.5">
                              {customer.company.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3.5 align-middle hidden sm:table-cell">
                      {customer.phone ? (
                        <span className="block font-mono text-[13px] text-[var(--text-default)] tabular-nums leading-snug">
                          {customer.phone}
                        </span>
                      ) : null}
                      {customer.email ? (
                        <span className="block text-[12px] text-[var(--text-muted)] truncate max-w-[200px] leading-snug">
                          {customer.email}
                        </span>
                      ) : null}
                      {!customer.phone && !customer.email && (
                        <span className="text-[13px] text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Engagement */}
                    <td className="px-5 py-3.5 align-middle hidden md:table-cell">
                      {(() => {
                        const hasAlerts = customer.active_ro_count > 0 || (customer.waiting_for_payment_count ?? 0) > 0
                        return (
                          <div className="flex items-center gap-1.5 flex-nowrap">
                            <PrefContactBadge value={customer.preferred_contact} />
                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] shrink-0">
                              <Car size={10} className="shrink-0" />
                              {customer.vehicle_count}
                            </span>
                            {hasAlerts && <span className="w-px h-3.5 bg-[var(--line)] shrink-0 opacity-60 mx-0.5" aria-hidden="true" />}
                            {customer.active_ro_count > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--info-bg)] border border-[var(--info-border)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--info-fg)] shrink-0">
                                <ClipboardList size={10} className="shrink-0" />
                                {customer.active_ro_count} open
                              </span>
                            )}
                            {(customer.waiting_for_payment_count ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--warning-border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--warning-fg)] shrink-0" style={{ background: 'var(--warning-bg)' }}>
                                Waiting for Payment
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>

                    {/* Assigned CSR */}
                    <td className="px-5 py-3.5 align-middle hidden lg:table-cell w-40">
                      {customer.assigned_csr_id ? (
                        <span className="text-[13px] font-medium text-[var(--text-default)] truncate max-w-[120px] block leading-tight">
                          {csrMap.get(customer.assigned_csr_id) ?? `#${customer.assigned_csr_id}`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)] italic select-none">
                          <UserMinus size={11} className="shrink-0 opacity-40" />
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 align-middle text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => openDialog('detail', customer)}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--text-default)] border border-[var(--line)] bg-transparent hover:bg-[var(--surface-1)] transition-colors"
                        >
                          <Eye size={12} className="shrink-0" />
                          View
                        </button>
                        <button
                          onClick={() => openDialog('edit', customer)}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--text-muted)] border border-[var(--line)] bg-transparent hover:bg-[var(--surface-1)] hover:text-[var(--text-default)] transition-colors"
                        >
                          <Pencil size={11} className="shrink-0" />
                          Edit
                        </button>
                        <RowMenu
                          customer={customer}
                          onDetail={() => openDialog('detail', customer)}
                          onEdit={() => openDialog('edit', customer)}
                          onDelete={() => openDialog('delete', customer)}
                          onAddVehicle={() => openDialog('addVehicle', customer)}
                          onAddRO={() => { setActiveCustomer(customer); setDialog('addRO') }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--line)] bg-[var(--surface-0)]">
              <span className="text-[12px] text-[var(--text-muted)]">
                {total.toLocaleString()} total customers
              </span>
              <Pagination
                count={totalPages}
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

      {/* ── Dialogs ── */}
      {dialog === 'detail' && activeCustomer && (
        <CustomerDetailDialog
          customer={activeCustomer} onClose={closeDialog}
          onEdit={() => setDialog('edit')}
          onNewRO={() => setDialog('addRO')}
        />
      )}
      {dialog === 'edit' && (
        <CustomerEditDialog
          customer={activeCustomer ?? null} onClose={closeDialog}
          onSaved={() => { closeDialog(); invalidate() }}
        />
      )}
      {dialog === 'delete' && activeCustomer && (
        <CustomerDeleteDialog
          customer={activeCustomer} onClose={closeDialog}
          onDeleted={() => { closeDialog(); invalidate() }}
        />
      )}
      {dialog === 'addVehicle' && activeCustomer && (
        <AddVehicleDialog
          customer={activeCustomer} onClose={closeDialog}
          onSaved={() => { closeDialog(); invalidate() }}
        />
      )}
      {dialog === 'addTransaction' && activeCustomer && (
        <AddTransactionDialog
          customer={activeCustomer} onClose={closeDialog}
          onSaved={() => { closeDialog(); invalidate() }}
        />
      )}
      {dialog === 'addRO' && activeCustomer && (
        <NewROWizard
          open preselectedCustomer={activeCustomer}
          onClose={() => { setDialog(null); setActiveCustomer(null) }}
          onSuccess={(_n, roId) => {
            setDialog(null); setActiveCustomer(null)
            qc.invalidateQueries({ queryKey: ['customers_table'] })
            setNewROId(roId)
          }}
        />
      )}
      <RODetailDrawer roId={newROId} onClose={() => setNewROId(null)} />
    </div>
  )
}
