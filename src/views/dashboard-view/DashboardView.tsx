import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { repairOrdersApi } from '@/api/repairOrders'
import type { RepairOrderListItem, JobStatus } from '@/types/repairOrder'
import { JOB_STATUS_LABELS } from '@/types/repairOrder'
import type { StatusTone } from '@/ui/StatusPill'
import { formatCurrency } from '@/lib/utils'
import NewROWizard from '@/components/NewROWizard'
import RODetailDrawer from '@/views/customer-view/components/RODetailDrawer'
import { PageHeader, Button, StatusPill } from '@/ui'
import { roStatusToTone, roStatusLabel } from '@/ui/StatusPill'
import {
  Activity,
  AlertCircle,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  MapPin,
  RefreshCw,
  Plus,
  Wrench,
} from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'
import type { ReactNode } from 'react'

const OPEN_STATUSES = new Set([
  'new', 'estimate_pending', 'estimate_approved', 'pre_order',
  'parts_ordered', 'parts_partial', 'parts_complete', 'scheduled',
  'in_production', 'qa_check', 'detail', 'ready_for_pickup',
])

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'MMM d') } catch { return iso }
}

function customerName(ro: RepairOrderListItem) {
  const c = ro.customer ?? ro.customers
  if (!c) return 'Customer TBD'
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
}

function vehicleSummary(ro: RepairOrderListItem) {
  const v = ro.vehicle ?? ro.vehicles
  if (!v) return 'Vehicle TBD'
  return [v.year, v.make, v.model].filter(Boolean).join(' ')
}

function formatVehicleCount(count: number) {
  return `${count} vehicle${count === 1 ? '' : 's'}`
}

function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-default)]"
      aria-label={text}
    >
      <AlertCircle size={14} />
    </span>
  )
}

function SectionCard({
  icon,
  title,
  description,
  action,
  children,
  className = '',
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-[24px] border border-[var(--line)] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]',
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-1)] text-[var(--text-strong)]">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                {title}
              </h2>
              <InfoHint text={description} />
            </div>
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function DashboardEmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--surface-1)] px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--text-muted)] shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
        {icon}
      </div>
      <p className="text-[15px] font-semibold text-[var(--text-strong)]">{title}</p>
      <p className="mt-2 max-w-[340px] text-[14px] leading-6 text-[var(--text-muted)]">{body}</p>
    </div>
  )
}

function HeroMiniStat({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <div
      title={note}
      className="rounded-[20px] border border-white/70 bg-white/85 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur-sm"
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-1)] text-[var(--text-strong)]">
        {icon}
      </div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{value}</p>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  supporting,
  hint,
  tone = 'neutral',
}: {
  icon: ReactNode
  label: string
  value: string | number
  supporting: string
  hint: string
  tone?: 'neutral' | 'warning' | 'danger'
}) {
  const toneStyles = {
    neutral: 'border-[var(--line)] bg-white',
    warning: 'border-[rgba(245,158,11,0.22)] bg-[rgba(255,251,235,0.92)]',
    danger: 'border-[rgba(239,68,68,0.22)] bg-[rgba(254,242,242,0.92)]',
  } as const

  const iconStyles = {
    neutral: 'bg-[var(--surface-1)] text-[var(--text-strong)]',
    warning: 'bg-[rgba(245,158,11,0.12)] text-[var(--warning)]',
    danger: 'bg-[rgba(239,68,68,0.12)] text-[var(--danger)]',
  } as const

  return (
    <div className={['rounded-[22px] border p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]', toneStyles[tone]].join(' ')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
            <InfoHint text={hint} />
          </div>
          <p className="mt-3 text-[38px] font-semibold leading-none tracking-[-0.04em] text-[var(--text-strong)]">{value}</p>
        </div>
        <div className={['flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', iconStyles[tone]].join(' ')}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-[14px] font-medium text-[var(--text-default)]">{supporting}</p>
    </div>
  )
}

function LotMap({
  ros,
  onSelect,
}: {
  ros: RepairOrderListItem[]
  onSelect: (ro: RepairOrderListItem) => void
}) {
  const zones = useMemo(() => {
    const map = new Map<string, RepairOrderListItem[]>()
    for (const ro of ros) {
      if (!OPEN_STATUSES.has(ro.status)) continue
      const zone = ro.zone?.trim() || 'Lot'
      if (!map.has(zone)) map.set(zone, [])
      map.get(zone)!.push(ro)
    }
    return map
  }, [ros])

  if (zones.size === 0) {
    return (
      <DashboardEmptyState
        icon={<Car size={24} />}
        title="No cars are currently on the lot"
        body="As vehicles arrive for active repair orders, they will appear here by zone."
      />
    )
  }

  return (
    <div className="space-y-4">
      {Array.from(zones.entries()).map(([zone, zoneRos]) => (
        <div key={zone} className="rounded-[18px] border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[var(--text-muted)]">
                <MapPin size={14} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[var(--text-strong)]">{zone}</p>
                <p className="text-[12px] text-[var(--text-muted)]">{formatVehicleCount(zoneRos.length)} parked here</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {zoneRos.map(ro => {
              const tone = roStatusToTone(ro.status)
              const statusClasses: Record<string, string> = {
                neutral: 'border-[var(--line)] bg-white',
                success: 'border-[rgba(34,197,94,0.18)] bg-[rgba(240,253,244,0.92)]',
                warning: 'border-[rgba(245,158,11,0.18)] bg-[rgba(255,251,235,0.92)]',
                danger: 'border-[rgba(239,68,68,0.18)] bg-[rgba(254,242,242,0.92)]',
                info: 'border-[rgba(59,130,246,0.18)] bg-[rgba(239,246,255,0.92)]',
                secondary: 'border-[var(--line)] bg-white',
                new: 'border-[var(--line)] bg-white',
                default: 'border-[var(--line)] bg-white',
              }
              const v = ro.vehicle ?? ro.vehicles
              return (
                <button
                  key={ro.id}
                  onClick={() => onSelect(ro)}
                  className={[
                    'rounded-[16px] border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]',
                    statusClasses[tone] ?? statusClasses.default,
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] font-semibold text-[var(--text-strong)]">
                        {ro.job_number ? `#${ro.job_number}` : ro.ro_number}
                      </p>
                      <p className="mt-1 truncate text-[13px] font-medium text-[var(--text-default)]">
                        {v ? `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim() : 'Vehicle TBD'}
                      </p>
                    </div>
                    <StatusPill label={roStatusLabel(ro.status)} tone={tone} />
                  </div>
                  <p className="mt-2 truncate text-[12px] text-[var(--text-muted)]">{customerName(ro)}</p>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function jobStatusToTone(s: JobStatus | null | undefined): StatusTone {
  if (s === 'waiting_for_payment') return 'waiting'
  if (s === 'closed') return 'done'
  return 'in-progress'
}

function OpenROsTable({
  ros,
  onSelect,
}: {
  ros: RepairOrderListItem[]
  onSelect: (ro: RepairOrderListItem) => void
}) {
  const rows = ros.slice(0, 10)

  if (rows.length === 0) {
    return (
      <DashboardEmptyState
        icon={<ClipboardList size={24} />}
        title="No active repair orders right now"
        body="New repair orders will show up here as soon as work is opened in the shop."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--line)]">
      <div className="hidden grid-cols-[1.1fr_1.1fr_1.4fr_0.9fr_0.8fr] gap-4 border-b border-[var(--line)] bg-[var(--surface-1)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] md:grid">
        <div>Job / RO</div>
        <div>Customer</div>
        <div>Vehicle</div>
        <div>Job Status</div>
        <div className="text-right">Due Out</div>
      </div>

      <div className="divide-y divide-[var(--line)]">
        {rows.map(ro => {
          const tone = jobStatusToTone(ro.job_status)
          const overdueOut = ro.scheduled_out_date && isPast(parseISO(ro.scheduled_out_date)) && ro.job_status !== 'closed'

          return (
            <button
              key={ro.id}
              onClick={() => onSelect(ro)}
              className="grid w-full items-center gap-4 bg-white px-5 py-4 text-left transition-colors hover:bg-[var(--surface-1)] md:grid-cols-[1.1fr_1.1fr_1.4fr_0.9fr_0.8fr]"
            >
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-strong)]">
                  {ro.job_number ? `#${ro.job_number}` : '—'}
                </p>
                <p className="mt-1 font-mono text-[12px] text-[var(--text-muted)]">{ro.ro_number}</p>
              </div>

              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[var(--text-default)]">{customerName(ro)}</p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)] md:hidden">{vehicleSummary(ro)}</p>
              </div>

              <div className="hidden min-w-0 md:block">
                <p className="truncate text-[14px] text-[var(--text-default)]">{vehicleSummary(ro)}</p>
              </div>

              <div className="flex items-center">
                <StatusPill label={JOB_STATUS_LABELS[ro.job_status ?? 'open']} tone={tone} />
              </div>

              <div className="flex items-center justify-between md:justify-end">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] md:hidden">Due Out</span>
                <span className={['text-[13px] font-medium', overdueOut ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'].join(' ')}>
                  {fmtDateShort(ro.scheduled_out_date)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DashboardView() {
  const { shop, user } = useAuth()
  const qc = useQueryClient()
  const [selectedROId, setSelectedROId] = useState<number | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['dashboard_repair_orders', shop?.id],
    queryFn: () => repairOrdersApi.list({ shop_id: shop?.id, per_page: 200 }),
    enabled: !!shop?.id,
    staleTime: 30_000,
  })

  const ros = (data?.data ?? []) as RepairOrderListItem[]
  const today = todayStr()

  const openRos = useMemo(
    () => ros.filter(ro => !ro.deleted_at && OPEN_STATUSES.has(ro.status)),
    [ros],
  )

  const waitingPayment = useMemo(
    () => openRos.filter(ro => ro.job_status === 'waiting_for_payment'),
    [openRos],
  )

  const waitingPaymentTotal = useMemo(
    () => waitingPayment.reduce((sum, ro) => sum + (ro.outstanding_balance?.[0]?.amount ?? 0), 0),
    [waitingPayment],
  )

  const promisedToday = useMemo(
    () => openRos.filter(ro => {
      if (!ro.scheduled_out_date) return false
      try { return format(new Date(ro.scheduled_out_date), 'yyyy-MM-dd') === today } catch { return false }
    }),
    [openRos, today],
  )

  const inPossession = useMemo(
    () => openRos.filter(ro => ro.arrived_at),
    [openRos],
  )

  const oldestRo = useMemo(() => {
    const withDate = openRos.filter(ro => ro.created_at)
    if (!withDate.length) return null
    return withDate.reduce((oldest, ro) => (ro.created_at < oldest.created_at ? ro : oldest))
  }, [openRos])

  const oldestDays = oldestRo
    ? Math.floor((Date.now() - new Date(oldestRo.created_at).getTime()) / 86_400_000)
    : null

  const zoneGroups = useMemo(() => {
    const m = new Map<string, number>()
    for (const ro of inPossession) {
      const z = ro.zone?.trim() || 'Lot'
      m.set(z, (m.get(z) ?? 0) + 1)
    }
    return m
  }, [inPossession])

  const lotCaption = Array.from(zoneGroups.entries())
    .map(([z, n]) => `${n} on ${z}`)
    .join(' · ')

  const todayBlocked = useMemo(
    () => promisedToday.filter(ro => ['estimate_pending', 'parts_ordered', 'parts_partial'].includes(ro.status)),
    [promisedToday],
  )

  const overdueDueOut = useMemo(
    () => openRos.filter(ro =>
      !!ro.scheduled_out_date &&
      isPast(parseISO(ro.scheduled_out_date)) &&
      format(parseISO(ro.scheduled_out_date), 'yyyy-MM-dd') < today,
    ),
    [openRos, today],
  )

  const needsAttentionToday = todayBlocked.length + overdueDueOut.length

  const arrivedToday = useMemo(
    () => ros.filter(ro => {
      if (!ro.arrived_at) return false
      try { return format(new Date(ro.arrived_at), 'yyyy-MM-dd') === today } catch { return false }
    }),
    [ros, today],
  )

  const deliveredToday = useMemo(
    () => ros.filter(ro => {
      if (!ro.delivered_at) return false
      try { return format(new Date(ro.delivered_at), 'yyyy-MM-dd') === today } catch { return false }
    }),
    [ros, today],
  )

  const totalWipValue = useMemo(
    () => ros
      .filter(ro => !ro.deleted_at && ro.job_status === 'open')
      .reduce((sum, ro) => sum + (ro.job_total?.[0]?.amount ?? ro.actual_total ?? ro.estimated_total ?? 0), 0),
    [ros],
  )

  const dateLabel = format(new Date(), 'EEEE, MMM d')
  const firstName = user?.first_name ?? ''
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const activeRepairsSupporting = openRos.length === 0
    ? 'No active repairs in progress'
    : `${formatVehicleCount(openRos.length)} moving through the shop`

  const activeRepairsHint = oldestDays == null
    ? 'New repair orders will appear here.'
    : oldestDays === 0
      ? 'Oldest active job was opened today.'
      : oldestDays === 1
        ? 'Oldest active job has been open for 1 day.'
        : `Oldest active job has been open for ${oldestDays} days.`

  const lotSupporting = inPossession.length === 0
    ? 'No cars are currently checked in'
    : `${formatVehicleCount(inPossession.length)} currently on site`

  const lotHint = inPossession.length === 0
    ? 'Vehicles will appear here once they arrive.'
    : lotCaption || 'Vehicles are grouped by their assigned lot zone.'

  const waitingPaymentSupporting = waitingPayment.length === 0
    ? 'Nothing is waiting on payment'
    : `${formatVehicleCount(waitingPayment.length)} ready for collection`

  const waitingPaymentHint = waitingPayment.length === 0
    ? 'No repair orders are blocked by unpaid balance.'
    : `${formatCurrency(waitingPaymentTotal)} still outstanding.`

  const dueOutSupporting = promisedToday.length === 0
    ? 'No vehicles due out today'
    : `${formatVehicleCount(promisedToday.length)} scheduled to leave today`

  const dueOutHint = promisedToday.length === 0
    ? 'The delivery board is clear for today.'
    : todayBlocked.length > 0
      ? `${todayBlocked.length} due out today need attention before delivery.`
      : 'All due-outs are currently on track.'

  const attentionSupporting = needsAttentionToday === 0
    ? 'Nothing urgent is flagged'
    : `${needsAttentionToday} job${needsAttentionToday === 1 ? '' : 's'} need follow-up`

  const attentionHint = needsAttentionToday === 0
    ? 'No blocked due-outs or overdue promised dates right now.'
    : [
        todayBlocked.length > 0 ? `${todayBlocked.length} due out today at risk` : null,
        overdueDueOut.length > 0 ? `${overdueDueOut.length} already overdue` : null,
      ].filter(Boolean).join(' · ')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Operations Dashboard"
        description={[shop?.name, dateLabel].filter(Boolean).join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              aria-label="Refresh dashboard"
              disabled={isFetching}
              className="rounded-[var(--radius-md)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-default)] disabled:opacity-40"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            </button>
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus size={16} />}
              onClick={() => setWizardOpen(true)}
            >
              New RO
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-0)]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-6">
          <section className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.25fr_0.95fr] xl:px-8 xl:py-7">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                Shop status at a glance
                </p>
                <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-[38px]">
                  {firstName ? `${greeting}, ${firstName} 👋` : 'Good day 👋'}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <div className="rounded-full border border-[var(--line)] bg-white/85 px-3.5 py-2 text-[13px] text-[var(--text-default)]">
                    <span className="font-semibold text-[var(--text-strong)]">{openRos.length}</span> active repairs
                  </div>
                  <div className="rounded-full border border-[var(--line)] bg-white/85 px-3.5 py-2 text-[13px] text-[var(--text-default)]">
                    <span className="font-semibold text-[var(--text-strong)]">{needsAttentionToday}</span> need attention
                  </div>
                  <div className="rounded-full border border-[var(--line)] bg-white/85 px-3.5 py-2 text-[13px] text-[var(--text-default)]">
                    <span className="font-semibold text-[var(--text-strong)]">{promisedToday.length}</span> due out today
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <HeroMiniStat
                  icon={<DollarSign size={18} />}
                  label="Total WIP Value"
                  value={isLoading ? '—' : formatCurrency(totalWipValue)}
                  note={openRos.length === 0 ? 'No active repair value in progress.' : 'Current active repair value across the shop.'}
                />
                <HeroMiniStat
                  icon={<Activity size={18} />}
                  label="Arrived Today"
                  value={isLoading ? '—' : String(arrivedToday.length)}
                  note={arrivedToday.length === 0 ? 'No arrivals yet today.' : `${formatVehicleCount(arrivedToday.length)} checked in today.`}
                />
                <HeroMiniStat
                  icon={<CheckCircle2 size={18} />}
                  label="Delivered Today"
                  value={isLoading ? '—' : String(deliveredToday.length)}
                  note={deliveredToday.length === 0 ? 'No deliveries completed today.' : `${formatVehicleCount(deliveredToday.length)} delivered today.`}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Operational Summary</p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-strong)]">Key metrics</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={<Car size={20} />}
                label="Cars on Lot"
                value={isLoading ? '—' : inPossession.length}
                supporting={lotSupporting}
                hint={lotHint}
              />
              <MetricCard
                icon={<Wrench size={20} />}
                label="Active Repairs"
                value={isLoading ? '—' : openRos.length}
                supporting={activeRepairsSupporting}
                hint={activeRepairsHint}
              />
              <MetricCard
                icon={<AlertCircle size={20} />}
                label="Needs Attention Today"
                value={isLoading ? '—' : needsAttentionToday}
                supporting={attentionSupporting}
                hint={attentionHint}
                tone={needsAttentionToday > 0 ? 'danger' : 'neutral'}
              />
              <MetricCard
                icon={<CreditCard size={20} />}
                label="Waiting for Payment"
                value={isLoading ? '—' : waitingPayment.length}
                supporting={waitingPaymentSupporting}
                hint={waitingPaymentHint}
                tone={waitingPayment.length > 0 ? 'warning' : 'neutral'}
              />
              <MetricCard
                icon={<CalendarDays size={20} />}
                label="Due Out Today"
                value={isLoading ? '—' : promisedToday.length}
                supporting={dueOutSupporting}
                hint={dueOutHint}
                tone={todayBlocked.length > 0 ? 'danger' : promisedToday.length > 0 ? 'warning' : 'neutral'}
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.9fr)]">
            <SectionCard
              icon={<ClipboardList size={20} />}
              title="Open Repair Orders"
              description="Your active repair queue, ordered for quick scanning. Open any row to review the full repair order without leaving the dashboard."
              className="min-w-0"
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <div className="rounded-full border border-[var(--line)] bg-[var(--surface-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)]">
                  {formatVehicleCount(openRos.length)} active
                </div>
                <div className="rounded-full border border-[var(--line)] bg-[var(--surface-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)]">
                  {promisedToday.length === 0 ? 'No due-outs today' : `${promisedToday.length} due out today`}
                </div>
                <div className="rounded-full border border-[var(--line)] bg-[var(--surface-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)]">
                  {waitingPayment.length === 0 ? 'No payment holds' : `${waitingPayment.length} waiting on payment`}
                </div>
              </div>

              <OpenROsTable
                ros={openRos}
                onSelect={ro => setSelectedROId(ro.id)}
              />

              {openRos.length > 10 && (
                <div className="mt-4 flex justify-end">
                  <button className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--accent-fg)] transition-colors hover:text-[var(--text-strong)]">
                    Showing 10 of {openRos.length} active repair orders
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<MapPin size={20} />}
              title="Lot Snapshot"
              description="See where active vehicles are currently staged so the front office and production team stay aligned."
            >
              <LotMap
                ros={ros}
                onSelect={ro => setSelectedROId(ro.id)}
              />
            </SectionCard>
          </div>
        </div>
      </div>

      <NewROWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(_n, roId) => {
          setWizardOpen(false)
          qc.invalidateQueries({ queryKey: ['dashboard_repair_orders'] })
          setSelectedROId(roId)
        }}
      />
      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />
    </div>
  )
}
