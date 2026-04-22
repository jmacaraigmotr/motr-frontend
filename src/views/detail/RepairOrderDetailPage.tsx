import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import { repairOrdersApi } from '@/api/repairOrders'
import type { ROAuditEntry } from '@/api/repairOrders'
import type { Payment, RepairOrder } from '@/types/repairOrder'
import { Button, DataTable, EmptyState, FilterPill, PageHeader, StatusPill, roStatusLabel, roStatusToTone } from '@/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import AddTransactionDialog from '@/views/customers-view/components/AddTransactionDialog'
import RecordHistory from '@/components/RecordHistory'
import TransactionDetailsModal from '@/components/TransactionDetailsModal'
import { ArrowLeft, CreditCard, Plus, X, History } from 'lucide-react'

type ROTab = 'transactions' | 'intake' | 'vehicle' | 'insurance' | 'rental' | 'history'

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 truncate text-[14px] text-[var(--text-default)]">{value}</div>
    </div>
  )
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function TabHistory({ entries, entityType, isLoading }: { entries: ROAuditEntry[]; entityType: string; isLoading: boolean }) {
  const filtered = entries.filter(e => e.entity_type === entityType)
  return (
    <SectionCard title="Record History">
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(n => (
            <div key={n} className="flex gap-4">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--surface-2)]" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-14 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState template="no-records-yet" headline="No history yet" />
      ) : (
        <RecordHistory entries={filtered} />
      )}
    </SectionCard>
  )
}

export default function RepairOrderDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const roId = Number(id)
  const [tab, setTab] = useState<ROTab>('transactions')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)

  const detailQuery = useQuery({
    queryKey: ['repair_order_page', roId],
    queryFn: () => repairOrdersApi.get(roId),
    enabled: Number.isFinite(roId),
    staleTime: 30_000,
  })

  const paymentsQuery = useQuery({
    queryKey: ['repair_order_payments_page', roId],
    queryFn: () => repairOrdersApi.listPayments(roId),
    enabled: Number.isFinite(roId),
    staleTime: 30_000,
  })

  const activityQuery = useQuery({
    queryKey: ['repair_order_activity_page', roId],
    queryFn: () => repairOrdersApi.activity(roId),
    enabled: Number.isFinite(roId),
    staleTime: 60_000,
  })

  const detail = detailQuery.data
  const ro = detail?.ro as RepairOrder | undefined
  const customer = detail?.customer as { id?: number; first_name?: string; last_name?: string; phone?: string | null } | undefined
  const vehicle = detail?.vehicle as { year?: number | null; make?: string | null; model?: string | null; trim?: string | null; color?: string | null; vin?: string | null; license_plate?: string | null } | undefined
  const intake = detail?.intake as Record<string, unknown> | null | undefined
  const insurance = detail?.insurance as Record<string, unknown> | null | undefined
  const rental = detail?.rental as Record<string, unknown> | null | undefined
  const events = (detail?.events ?? []) as Array<{ id: number; description: string | null; created_at: string }>
  const payments = (paymentsQuery.data ?? []) as Payment[]
  const activity = (activityQuery.data ?? []) as ROAuditEntry[]

  const outstanding = useMemo(
    () => payments.filter(payment => payment.payment_status === 'not_paid').reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  )

  if (detailQuery.isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
    )
  }

  if (!ro) {
    return (
      <div className="p-6">
        <EmptyState
          template="no-results"
          headline="Repair order not found"
          action={{ label: 'Back', onClick: () => navigate('/') }}
        />
      </div>
    )
  }

  const customerName = customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : 'Customer TBD'
  const vehicleLabel = vehicle ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ') : 'Vehicle TBD'
  const statusTone = roStatusToTone(ro.status)

  return (
    <div className="flex h-full flex-col bg-[var(--surface-0)]">
      <PageHeader
        title={ro.job_number != null ? `Job #${ro.job_number}` : ro.ro_number}
        description={ro.ro_number}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} leadingIcon={<ArrowLeft size={14} />}>
              Back
            </Button>
            {outstanding > 0 && (
              <Button variant="primary" size="sm" onClick={() => setPaymentOpen(true)} leadingIcon={<CreditCard size={14} />}>
                Record Payment
              </Button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-6">
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{ro.ro_number}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                    {ro.job_number != null ? `Job #${ro.job_number}` : 'Repair Order'}
                  </h2>
                  <StatusPill label={roStatusLabel(ro.status)} tone={statusTone} />
                  {ro.job_type && (
                    <span className="text-[13px] text-[var(--text-muted)]">
                      {ro.job_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <SummaryField label="Customer" value={customer?.id ? <Link to={`/customers/${customer.id}`} className="hover:underline">{customerName}</Link> : customerName} />
                <SummaryField label="Vehicle" value={vehicleLabel} />
                <SummaryField label="Promised Out" value={formatDate(ro.scheduled_out_date)} />
                <SummaryField label="Assigned CSR" value={ro.csr_id ?? '—'} />
                <SummaryField label="Assigned EST" value={ro.estimator_id ?? '—'} />
                <SummaryField label="Outstanding" value={formatCurrency(outstanding)} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterPill label="Transactions" selected={tab === 'transactions'} count={payments.length} onClick={() => setTab('transactions')} />
            <FilterPill label="Intake" selected={tab === 'intake'} onClick={() => setTab('intake')} />
            <FilterPill label="Vehicle" selected={tab === 'vehicle'} onClick={() => setTab('vehicle')} />
            <FilterPill label="Insurance" selected={tab === 'insurance'} onClick={() => setTab('insurance')} />
            <FilterPill label="Rental" selected={tab === 'rental'} onClick={() => setTab('rental')} />
            <FilterPill label="History" selected={tab === 'history'} count={activity.length || events.length || undefined} onClick={() => setTab('history')} />
          </div>

          {tab === 'transactions' && (
            <>
              <SectionCard
                title="Transactions"
                action={
                  <Button variant="primary" size="sm" onClick={() => setPaymentOpen(true)} leadingIcon={<Plus size={14} />}>
                    Record Payment
                  </Button>
                }
              >
                <DataTable<Payment>
                  columns={[
                    {
                      key: 'date',
                      header: 'Date',
                      render: payment => <span className="font-mono text-[12px] text-[var(--text-muted)]">{formatDate(payment.date_added ?? payment.created_at)}</span>,
                    },
                    {
                      key: 'type',
                      header: 'Type',
                      render: payment => payment.transaction_type?.replace(/_/g, ' ') || '—',
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
                      align: 'right',
                      render: payment => <span className="font-mono">{formatCurrency(payment.amount)}</span>,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: payment => (
                        <StatusPill
                          label={payment.payment_status?.replace(/_/g, ' ') || '—'}
                          tone={payment.payment_status === 'paid' || payment.payment_status === 'approved' ? 'done' : 'waiting'}
                        />
                      ),
                    },
                  ]}
                  rows={payments}
                  getRowKey={payment => payment.id}
                  emptyTemplate="no-records-yet"
                  emptyHeadline="No transactions for this RO"
                />
              </SectionCard>
              <TabHistory entries={activity} entityType="payments" isLoading={activityQuery.isLoading} />
            </>
          )}

          {tab === 'intake' && (
            <>
              <SectionCard title="Intake">
                {!intake ? (
                  <EmptyState template="no-records-yet" headline="No intake recorded" />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(([
                      ['Date of loss', intake.date_of_loss],
                      ['Mileage', intake.mileage],
                      ['Point of impact', intake.point_of_impact],
                      ['Driveable', intake.is_driveable ? 'Yes' : 'No'],
                      ['Towed', intake.is_towed ? 'Yes' : 'No'],
                      ['Previous estimate', intake.has_previous_estimate ? 'Yes' : 'No'],
                    ]) as [string, unknown][]).map(([label, value]) => (
                      <SummaryField key={label} label={label} value={String(value ?? '—')} />
                    ))}
                    {!!intake.damage_description && <div className="md:col-span-2 xl:col-span-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3 text-[14px] text-[var(--text-default)]">{String(intake.damage_description)}</div>}
                  </div>
                )}
              </SectionCard>
              <TabHistory entries={activity} entityType="intakes" isLoading={activityQuery.isLoading} />
            </>
          )}

          {tab === 'vehicle' && (
            <>
              <SectionCard title="Vehicle">
                {!vehicle ? (
                  <EmptyState template="no-records-yet" headline="No vehicle linked" />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ['Vehicle', vehicleLabel],
                      ['Color', vehicle.color || '—'],
                      ['VIN', vehicle.vin || '—'],
                      ['Plate', vehicle.license_plate || '—'],
                      ['Arrived', formatDate(ro.arrived_at)],
                      ['Lot position', ro.zone || '—'],
                    ].map(([label, value]) => (
                      <SummaryField key={label} label={label} value={value} />
                    ))}
                  </div>
                )}
              </SectionCard>
              <TabHistory entries={activity} entityType="vehicles" isLoading={activityQuery.isLoading} />
            </>
          )}

          {tab === 'insurance' && (
            <>
              <SectionCard title="Insurance">
                {!insurance ? (
                  <EmptyState template="no-records-yet" headline="No insurance data" />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries({
                      'First Party': insurance.first_party_company,
                      'Claim #': insurance.first_party_claim_number,
                      'Rep': insurance.first_party_rep_name,
                      'Third Party': insurance.third_party_company,
                      'Third-party Claim #': insurance.third_party_claim_number,
                      'Liability %': insurance.liability_percentage,
                    }).map(([label, value]) => (
                      <SummaryField key={label} label={label} value={String(value ?? '—')} />
                    ))}
                  </div>
                )}
              </SectionCard>
              <TabHistory entries={activity} entityType="ro_insurance" isLoading={activityQuery.isLoading} />
            </>
          )}

          {tab === 'rental' && (
            <>
              <SectionCard title="Rental">
                {!rental ? (
                  <EmptyState template="no-records-yet" headline="No rental data" />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries({
                      'Company': rental.rental_company,
                      'Approved Daily': rental.approved_daily_amount != null ? formatCurrency(Number(rental.approved_daily_amount)) : '—',
                      'Days on Policy': rental.days_on_policy,
                      'Start Date': rental.rental_start_date ? formatDate(String(rental.rental_start_date)) : '—',
                      'Due Date': rental.rental_due_date ? formatDate(String(rental.rental_due_date)) : '—',
                      'Reservation #': rental.reservation_number,
                    }).map(([label, value]) => (
                      <SummaryField key={label} label={label} value={String(value ?? '—')} />
                    ))}
                  </div>
                )}
              </SectionCard>
              <TabHistory entries={activity} entityType="rentals" isLoading={activityQuery.isLoading} />
            </>
          )}

          {tab === 'history' && (
            <SectionCard
              title="Record History"
              action={
                !activityQuery.isLoading && (activity.length > 0 || events.length > 0) ? (
                  <button
                    onClick={() => setHistoryModalOpen(true)}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent)] hover:underline"
                  >
                    <History size={13} />
                    View Full History
                  </button>
                ) : undefined
              }
            >
              {activityQuery.isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="flex gap-4">
                      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--surface-2)]" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-4 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
                        <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
                        <div className="h-16 animate-pulse rounded bg-[var(--surface-2)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activity.length === 0 && events.length === 0 ? (
                <EmptyState template="no-records-yet" headline="No history yet" />
              ) : (
                <RecordHistory
                  ro={{ job_number: ro.job_number, ro_number: ro.ro_number }}
                  onPaymentClick={setSelectedPaymentId}
                  entries={[
                    ...activity,
                    ...events.map(evt => ({
                      id: evt.id,
                      created_at: evt.created_at,
                      action_type: 'update' as const,
                      entity_type: 'repair_orders',
                      entity_name: ro.ro_number,
                      description: evt.description,
                      old_values: null,
                      new_values: null,
                      user: null,
                    })),
                  ]}
                />
              )}
            </SectionCard>
          )}
        </div>
      </div>

      {paymentOpen && (
        <AddTransactionDialog
          preselectedRo={{
            id: ro.id,
            ro_number: ro.ro_number,
            job_number: ro.job_number,
            status: ro.status,
            job_type: ro.job_type,
            priority: ro.priority,
            scheduled_out_date: ro.scheduled_out_date,
            created_at: ro.created_at,
            customer: customer?.id ? { id: customer.id, first_name: customer.first_name ?? '', last_name: customer.last_name ?? '', phone: customer.phone ?? null } : undefined,
            vehicle: vehicle ? { id: ro.vehicle_id ?? 0, year: vehicle.year ?? null, make: vehicle.make ?? null, model: vehicle.model ?? null, trim: vehicle.trim ?? null, color: vehicle.color ?? null, vin: vehicle.vin ?? null, license_plate: vehicle.license_plate ?? null } : undefined,
          }}
          onClose={() => setPaymentOpen(false)}
          onSaved={() => setPaymentOpen(false)}
        />
      )}

      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 'var(--radius-lg)', maxHeight: '90vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <div>
            <div className="text-[16px] font-semibold text-[var(--text-strong)]">Full History</div>
            <div className="text-[13px] text-[var(--text-muted)]">
              {ro.job_number ? `Job #${ro.job_number}` : ro.ro_number}
              {ro.job_number && ro.ro_number && <span className="ml-2 opacity-60">{ro.ro_number}</span>}
            </div>
          </div>
          <IconButton size="small" onClick={() => setHistoryModalOpen(false)}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {activity.length === 0 && events.length === 0 ? (
            <EmptyState template="no-records-yet" headline="No history yet" />
          ) : (
            <RecordHistory
              ro={{ job_number: ro.job_number, ro_number: ro.ro_number }}
              onPaymentClick={setSelectedPaymentId}
              entries={[
                ...activity,
                ...events.map(evt => ({
                  id: evt.id,
                  created_at: evt.created_at,
                  action_type: 'update' as const,
                  entity_type: 'repair_orders',
                  entity_name: ro.ro_number,
                  description: evt.description,
                  old_values: null,
                  new_values: null,
                  user: null,
                })),
              ]}
            />
          )}
        </DialogContent>
      </Dialog>

      <TransactionDetailsModal
        payment={payments.find(p => p.id === selectedPaymentId) ?? null}
        onClose={() => setSelectedPaymentId(null)}
      />
    </div>
  )
}
