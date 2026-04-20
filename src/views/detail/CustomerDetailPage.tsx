import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import { repairOrdersApi } from '@/api/repairOrders'
import { teamApi } from '@/api/team'
import type { Customer, CustomerHistory } from '@/types/customer'
import type { PaymentWithContext, RepairOrderListItem } from '@/types/repairOrder'
import type { Vehicle } from '@/types/vehicle'
import { Avatar, Button, DataTable, EmptyState, FilterPill, PageHeader, StatusPill, roStatusLabel, roStatusToTone } from '@/ui'
import { formatCurrency, formatDate, formatDateTime, initials } from '@/lib/utils'
import NewROWizard from '@/components/NewROWizard'
import CustomerEditDialog from '@/views/customers-view/components/CustomerEditDialog'
import AddVehicleDialog from '@/views/customers-view/components/AddVehicleDialog'
import AddTransactionDialog from '@/views/customers-view/components/AddTransactionDialog'
import { useAuth } from '@/hooks/useAuth'
import { ArrowLeft, Car, CreditCard, FileText, History, Mail, Phone, Plus } from 'lucide-react'

type CustomerTab = 'overview' | 'vehicles' | 'transactions' | 'history'

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-3">
      <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-[14px] text-[var(--text-default)]">{value}</div>
    </div>
  )
}

function VehicleCard({
  vehicle,
  onNewRO,
}: {
  vehicle: Vehicle
  onNewRO: (vehicle: Vehicle) => void
}) {
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
  const subtitle = [vehicle.color, vehicle.license_plate, vehicle.license_state].filter(Boolean).join(' · ')

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[var(--text-strong)]">{title || 'Vehicle'}</div>
          <div className="mt-1 text-[13px] text-[var(--text-muted)]">{subtitle || 'No plate or color on file'}</div>
          {vehicle.vin && (
            <div className="mt-2 font-mono text-[12px] tracking-[0.04em] text-[var(--text-muted)]">{vehicle.vin}</div>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => onNewRO(vehicle)} leadingIcon={<Plus size={14} />}>
          New RO
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DetailField label="Insurance" value={vehicle.insurance_company || '—'} />
        <DetailField label="Policy" value={vehicle.insurance_policy_number || '—'} />
        <DetailField label="Mileage In" value={vehicle.mileage_in != null ? `${vehicle.mileage_in.toLocaleString()} mi` : '—'} />
      </div>
    </div>
  )
}

export default function CustomerDetailPage() {
  const navigate = useNavigate()
  const { shop } = useAuth()
  const { id } = useParams()
  const customerId = Number(id)
  const [tab, setTab] = useState<CustomerTab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [wizardCustomer, setWizardCustomer] = useState<Customer | null>(null)
  const [wizardVehicle, setWizardVehicle] = useState<Vehicle | null>(null)

  const customerQuery = useQuery({
    queryKey: ['customer_detail_page', customerId],
    queryFn: () => customersApi.get(customerId),
    enabled: Number.isFinite(customerId),
    staleTime: 30_000,
  })

  const historyQuery = useQuery({
    queryKey: ['customer_history_page', customerId],
    queryFn: () => customersApi.history(customerId),
    enabled: Number.isFinite(customerId) && tab === 'history',
    staleTime: 60_000,
  })

  const paymentsQuery = useQuery({
    queryKey: ['customer_transactions_page', customerId],
    queryFn: () => repairOrdersApi.listAllPayments({ customer_id: customerId, per_page: 200 }),
    enabled: Number.isFinite(customerId),
    staleTime: 30_000,
  })

  const teamQuery = useQuery({
    queryKey: ['team_members', shop?.id],
    queryFn: () => teamApi.listMembers(shop?.id ? { shop_id: shop.id } : undefined),
    enabled: !!shop?.id,
    staleTime: 5 * 60_000,
  })

  const detail = customerQuery.data
  const customer = detail?.customer
  const vehicles = detail?.vehicles ?? []
  const openRos = detail?.open_ros ?? []
  const documents = detail?.documents ?? []
  const payments = (paymentsQuery.data?.data ?? []) as PaymentWithContext[]
  const history = historyQuery.data as CustomerHistory | undefined

  const assignedCSR = useMemo(() => {
    if (!customer?.assigned_csr_id) return null
    return (teamQuery.data ?? []).find(member => member.id === customer.assigned_csr_id) ?? null
  }, [customer?.assigned_csr_id, teamQuery.data])

  const totalPaid = payments
    .filter(payment => payment.payment_status === 'paid' || payment.payment_status === 'approved')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const totalOutstanding = payments
    .filter(payment => payment.payment_status === 'not_paid')
    .reduce((sum, payment) => sum + payment.amount, 0)

  const historyItems = useMemo(() => {
    if (!history) return []

    return [
      ...history.ro_events.map(evt => ({
        id: `ro-${evt.id}`,
        when: evt.created_at,
        title: evt.description || 'Repair order event',
        body: evt.metadata?.note ? String(evt.metadata.note) : null,
      })),
      ...history.customer_interactions.map(evt => ({
        id: `interaction-${evt.id}`,
        when: evt.created_at,
        title: evt.subject || evt.type.replace(/_/g, ' '),
        body: evt.body,
      })),
      ...history.payments.map(evt => ({
        id: `payment-${evt.id}`,
        when: evt.created_at ?? '',
        title: `Payment ${formatCurrency(evt.amount)}`,
        body: evt.notes ?? evt.reference_number ?? null,
      })),
    ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
  }, [history])

  if (customerQuery.isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6">
        <EmptyState
          template="no-results"
          headline="Customer not found"
          action={{ label: 'Back to customers', onClick: () => navigate('/') }}
        />
      </div>
    )
  }

  const customerName = `${customer.first_name} ${customer.last_name}`.trim()

  return (
    <div className="flex h-full flex-col bg-[var(--surface-0)]">
      <PageHeader
        title={customerName}
        description={`Customer profile · ${customer.company?.name || 'Personal account'}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} leadingIcon={<ArrowLeft size={14} />}>
              Back
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="primary" size="sm" onClick={() => { setWizardCustomer(customer); setWizardVehicle(null) }} leadingIcon={<Plus size={14} />}>
              New RO
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-6">
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <Avatar initials={initials(customer.first_name, customer.last_name)} size="lg" />
                <div className="min-w-0">
                  <div className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-strong)]">{customerName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-4 text-[14px] text-[var(--text-muted)]">
                    {customer.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{customer.phone}</span>}
                    {customer.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{customer.email}</span>}
                    <span>Preferred contact: {customer.preferred_contact || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 text-[14px]">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.04em] text-[var(--text-muted)]">Total Paid</div>
                  <div className="mt-1 text-[20px] font-semibold text-[var(--text-strong)]">{formatCurrency(totalPaid)}</div>
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-[0.04em] text-[var(--text-muted)]">Outstanding</div>
                  <div className="mt-1 text-[20px] font-semibold text-[var(--danger-fg)]">{formatCurrency(totalOutstanding)}</div>
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-[0.04em] text-[var(--text-muted)]">Open ROs</div>
                  <div className="mt-1 text-[20px] font-semibold text-[var(--text-strong)]">{openRos.length}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailField label="Assigned CSR" value={assignedCSR?.name || 'Unassigned'} />
              <DetailField label="Customer Since" value={formatDate(customer.created_at)} />
              <DetailField label="Vehicles" value={vehicles.length} />
              <DetailField label="Referred By" value={customer.referred_by || customer.referrer_name || '—'} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterPill label="Overview" selected={tab === 'overview'} onClick={() => setTab('overview')} />
            <FilterPill label="Vehicles" selected={tab === 'vehicles'} count={vehicles.length} onClick={() => setTab('vehicles')} />
            <FilterPill label="Transactions" selected={tab === 'transactions'} count={payments.length} onClick={() => setTab('transactions')} />
            <FilterPill label="History" selected={tab === 'history'} count={historyItems.length || undefined} onClick={() => setTab('history')} />
          </div>

          {tab === 'overview' && (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                  <div className="mb-4 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Customer details</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailField label="Company" value={customer.company?.name || '—'} />
                    <DetailField label="Preferred Contact" value={customer.preferred_contact || '—'} />
                    <DetailField label="Address" value={[customer.address_line1, customer.address_line2].filter(Boolean).join(', ') || '—'} />
                    <DetailField label="City / State / ZIP" value={[customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || '—'} />
                    <DetailField label="Pickup Address" value={[customer.pickup_address_line1, customer.pickup_city, customer.pickup_state, customer.pickup_zip].filter(Boolean).join(', ') || '—'} />
                    <DetailField label="Attribution" value={customer.location_attribution || '—'} />
                  </div>
                  {customer.notes && (
                    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3 text-[14px] text-[var(--text-default)]">
                      {customer.notes}
                    </div>
                  )}
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Open Repair Orders</div>
                    <Button variant="secondary" size="sm" onClick={() => { setWizardCustomer(customer); setWizardVehicle(null) }} leadingIcon={<Plus size={14} />}>
                      New RO
                    </Button>
                  </div>
                  <DataTable<RepairOrderListItem>
                    columns={[
                      {
                        key: 'job',
                        header: 'Job / RO',
                        render: ro => (
                          <div>
                            <div className="font-semibold text-[var(--text-strong)]">{ro.job_number != null ? `#${ro.job_number}` : '—'}</div>
                            <div className="font-mono text-[12px] text-[var(--text-muted)]">{ro.ro_number}</div>
                          </div>
                        ),
                      },
                      {
                        key: 'vehicle',
                        header: 'Vehicle',
                        render: ro => [ro.vehicle?.year ?? ro.vehicles?.year, ro.vehicle?.make ?? ro.vehicles?.make, ro.vehicle?.model ?? ro.vehicles?.model].filter(Boolean).join(' ') || '—',
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        render: ro => <StatusPill label={roStatusLabel(ro.status)} tone={roStatusToTone(ro.status)} />,
                      },
                      {
                        key: 'billing',
                        header: 'Billing',
                        align: 'right',
                        render: ro => (
                          <div>
                            {ro.job_total?.[0]?.amount != null && <div className="font-mono text-[13px]">{formatCurrency(ro.job_total[0].amount)}</div>}
                            {ro.outstanding_balance?.[0]?.amount != null && ro.outstanding_balance[0].amount > 0 && (
                              <div className="font-mono text-[12px] text-[var(--danger-fg)]">{formatCurrency(ro.outstanding_balance[0].amount)} owed</div>
                            )}
                          </div>
                        ),
                      },
                    ]}
                    rows={openRos}
                    getRowKey={ro => ro.id}
                    onRowClick={ro => navigate(`/ros/${ro.id}`)}
                    emptyTemplate="no-records-yet"
                    emptyHeadline="No open repair orders"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                  <div className="mb-4 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Driver’s license photos</div>
                  {documents.filter(doc => doc.category === 'drivers_license' && doc.file?.url).length === 0 ? (
                    <EmptyState template="no-records-yet" headline="No license documents" body="Uploaded license images will appear here." />
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {documents
                        .filter(doc => doc.category === 'drivers_license' && doc.file?.url)
                        .map(doc => (
                          <a key={doc.id} href={doc.file?.url ?? '#'} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)]">
                            <img src={doc.file?.url ?? ''} alt="Driver license" className="h-[88px] w-full object-cover" />
                          </a>
                        ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Vehicles</div>
                    <Button variant="secondary" size="sm" onClick={() => setVehicleOpen(true)} leadingIcon={<Plus size={14} />}>
                      Add Vehicle
                    </Button>
                  </div>
                  {vehicles.length === 0 ? (
                    <EmptyState template="no-records-yet" headline="No vehicles on file" />
                  ) : (
                    <div className="space-y-3">
                      {vehicles.slice(0, 3).map(vehicle => (
                        <VehicleCard key={vehicle.id} vehicle={vehicle} onNewRO={(selectedVehicle) => { setWizardCustomer(customer); setWizardVehicle(selectedVehicle) }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'vehicles' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setVehicleOpen(true)} leadingIcon={<Plus size={14} />}>
                  Add Vehicle
                </Button>
              </div>
              {vehicles.length === 0 ? (
                <EmptyState template="no-records-yet" headline="No vehicles on file" />
              ) : (
                vehicles.map(vehicle => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} onNewRO={(selectedVehicle) => { setWizardCustomer(customer); setWizardVehicle(selectedVehicle) }} />
                ))
              )}
            </div>
          )}

          {tab === 'transactions' && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Transactions</div>
                <Button variant="primary" size="sm" onClick={() => setTransactionOpen(true)} leadingIcon={<Plus size={14} />}>
                  Add Transaction
                </Button>
              </div>
              <DataTable<PaymentWithContext>
                columns={[
                  {
                    key: 'date',
                    header: 'Date',
                    render: payment => <span className="font-mono text-[12px] text-[var(--text-muted)]">{formatDate(payment.date_added ?? payment.created_at)}</span>,
                  },
                  {
                    key: 'job',
                    header: 'Job',
                    render: payment => payment.repair_order?.job_number != null ? `#${payment.repair_order.job_number}` : payment.repair_order?.ro_number || '—',
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
                onRowClick={payment => payment.repair_order?.id && navigate(`/ros/${payment.repair_order.id}`)}
                emptyTemplate="no-records-yet"
                emptyHeadline="No transactions yet"
              />
            </div>
          )}

          {tab === 'history' && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
              <div className="mb-4 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Customer history</div>
              {historyQuery.isLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
              ) : historyItems.length === 0 ? (
                <EmptyState template="no-records-yet" headline="No history yet" />
              ) : (
                <div className="space-y-4">
                  {historyItems.map(item => (
                    <div key={item.id} className="grid gap-1 border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0 md:grid-cols-[180px_1fr]">
                      <div className="font-mono text-[12px] text-[var(--text-muted)]">{formatDateTime(item.when)}</div>
                      <div>
                        <div className="text-[14px] font-medium text-[var(--text-strong)]">{item.title}</div>
                        {item.body && <div className="mt-1 text-[13px] text-[var(--text-muted)]">{item.body}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <CustomerEditDialog
          customer={customer}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}

      {vehicleOpen && (
        <AddVehicleDialog
          customer={customer}
          onClose={() => setVehicleOpen(false)}
          onSaved={() => setVehicleOpen(false)}
        />
      )}

      {transactionOpen && (
        <AddTransactionDialog
          customer={customer}
          onClose={() => setTransactionOpen(false)}
          onSaved={() => setTransactionOpen(false)}
        />
      )}

      <NewROWizard
        open={wizardCustomer !== null}
        preselectedCustomer={wizardCustomer}
        preselectedVehicle={wizardVehicle}
        onClose={() => {
          setWizardCustomer(null)
          setWizardVehicle(null)
        }}
        onSuccess={(_roNumber, roId) => {
          setWizardCustomer(null)
          setWizardVehicle(null)
          navigate(`/ros/${roId}`)
        }}
      />
    </div>
  )
}
