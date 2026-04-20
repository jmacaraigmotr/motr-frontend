import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import { repairOrdersApi } from '@/api/repairOrders'
import type { Customer, PreferredContact } from '@/types/customer'
import type { RepairOrderListItem, StaffMember } from '@/types/repairOrder'
import { RO_STATUS_LABELS, RO_STATUS_COLORS } from '@/types/repairOrder'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatCurrency } from '@/lib/utils'
import RODetailDrawer from './components/RODetailDrawer'
import NewROWizard from '@/components/NewROWizard'
import CustomerEditDialog from '@/views/customers-view/components/CustomerEditDialog'
import {
  Plus, Search, User, ChevronRight, UserPlus,
  Phone, Mail, Car, ClipboardList, Calendar, MessageSquare, DollarSign,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'

// ─── PCM Badge ────────────────────────────────────────────────────────────────

const PCM_COLORS: Record<PreferredContact, 'info' | 'success' | 'secondary'> = {
  phone: 'info',
  email: 'success',
  text:  'secondary',
}
const PCM_LABELS: Record<PreferredContact, string> = {
  phone: 'Phone',
  email: 'Email',
  text:  'Text',
}
const PCM_ICONS: Record<PreferredContact, LucideIcon> = {
  phone: Phone,
  email: Mail,
  text : MessageSquare,
}

function PcmBadge({ value }: { value: PreferredContact | null }) {
  if (!value) return null
  const Icon = PCM_ICONS[value]
  return (
    <Chip
      label={PCM_LABELS[value]}
      size="small"
      color={PCM_COLORS[value]}
      icon={<Icon size={12} />}
      sx={{
        fontSize: '0.65rem',
        height: 20,
        fontWeight: 700,
        flexShrink: 0,
        '& .MuiChip-icon': { color: 'inherit', mr: 0.3 },
      }}
    />
  )
}

function InfoStat({ icon, label, children }: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <Box sx={{ minWidth: 150 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            color: 'text.secondary',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.4 }}>
          {label}
        </Typography>
      </Box>
      {children}
    </Box>
  )
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatHistoryTitle(value?: string | null) {
  if (!value) return 'Repair Order Event'
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const INTERACTION_LABELS: Record<string, string> = {
  call      : 'Phone Call',
  email     : 'Email',
  text      : 'Text Message',
  in_person : 'In-Person Visit',
  note      : 'Note',
}

const INTERACTION_ICONS: Record<string, ReactNode> = {
  call     : <Phone size={14} />,
  email    : <Mail size={14} />,
  text     : <MessageSquare size={14} />,
  in_person: <User size={14} />,
  note     : <MessageSquare size={14} />,
}

const TIMELINE_COLORS: Record<
  HistoryItem['type'],
  { bg: string; color: string; chip: 'primary' | 'secondary' | 'warning' }
> = {
  ro_event    : { bg: 'rgba(37,99,235,0.12)', color: 'primary.main', chip: 'primary' },
  interaction : { bg: 'rgba(16,185,129,0.12)', color: 'success.main', chip: 'secondary' },
  payment     : { bg: 'rgba(249,115,22,0.12)', color: 'warning.dark', chip: 'warning' },
}

interface HistoryItem {
  id: string
  timestamp: string
  type: 'ro_event' | 'interaction' | 'payment'
  title: string
  description?: string | null
  meta?: string
  badge?: string
  user?: string | null
  icon: ReactNode
  subtext?: string | null
}

// ─── Customer Row ─────────────────────────────────────────────────────────────

function CustomerRow({ customer, selected, onClick }: {
  customer: Customer; selected: boolean; onClick: () => void
}) {
  return (
    <Box
      component="button" onClick={onClick}
      sx={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.5, textAlign: 'left', border: 'none', cursor: 'pointer',
        borderBottom: '1px solid', borderColor: 'divider',
        borderLeft: '3px solid', borderLeftColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? 'rgba(251,191,36,0.05)' : 'transparent',
        transition: 'background-color 0.15s',
        '&:hover': { bgcolor: selected ? 'rgba(251,191,36,0.07)' : 'action.hover' },
      }}
    >
      <Avatar sx={{
        width: 36, height: 36, fontSize: 13, fontWeight: 700, flexShrink: 0, borderRadius: 2,
        bgcolor: selected ? 'rgba(251,191,36,0.15)' : 'action.selected',
        color: selected ? 'primary.main' : 'text.primary',
      }}>
        {customer.first_name?.charAt(0) ?? '?'}{customer.last_name?.charAt(0) ?? ''}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Last name first — matches Tadabase */}
        <Typography variant="body2" fontWeight={600} noWrap sx={{ color: selected ? 'primary.main' : 'text.primary' }}>
          {customer.last_name}, {customer.first_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {customer.phone ?? customer.email ?? '—'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.4, flexShrink: 0 }}>
        <PcmBadge value={customer.preferred_contact} />
        {customer.active_ro_count > 0 && (
          <Chip
            label={`${customer.active_ro_count} open`}
            size="small" color="primary" variant="filled"
            sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }}
          />
        )}
      </Box>
    </Box>
  )
}

// ─── Details Tab ──────────────────────────────────────────────────────────────

function DetailsTab({ customer }: { customer: Customer }) {
  const address = [customer.address_line1, customer.address_line2].filter(Boolean).join(', ')
  const cityStateZip = [customer.city, customer.state, customer.zip].filter(Boolean).join(', ')

  const fields = [
    { label: 'First Name',  value: customer.first_name },
    { label: 'Last Name',   value: customer.last_name },
    { label: 'Company',     value: customer.company?.name },
    { label: 'Phone',       value: customer.phone,           href: customer.phone ? `tel:${customer.phone}` : undefined },
    { label: 'Alt Phone',   value: customer.phone_secondary, href: customer.phone_secondary ? `tel:${customer.phone_secondary}` : undefined },
    { label: 'Email',       value: customer.email,           href: customer.email ? `mailto:${customer.email}` : undefined },
    { label: 'Mailing Address', value: address || null },
    { label: 'City / State / ZIP', value: cityStateZip || null },
    { label: 'Referred By', value: customer.referred_by ?? customer.referrer_name },
    { label: 'How They Found Us', value: customer.location_attribution },
    { label: 'Customer Since', value: formatDate(customer.created_at) },
  ].filter(f => f.value)

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {fields.map(({ label, value, href }) => (
          <Card key={label} variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ py: '10px !important', px: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{label}</Typography>
              {href ? (
                <Typography
                  component="a" href={href} variant="body2" fontWeight={500}
                  sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
                >
                  {value}
                </Typography>
              ) : (
                <Typography variant="body2" fontWeight={500}>{value}</Typography>
              )}
            </CardContent>
          </Card>
        ))}

        {customer.preferred_contact && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ py: '10px !important', px: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Preferred Contact Method
              </Typography>
              <PcmBadge value={customer.preferred_contact} />
            </CardContent>
          </Card>
        )}
      </Box>

      {customer.notes && (
        <Card variant="outlined" sx={{ borderRadius: 3, mt: 1.5, bgcolor: 'rgba(251,191,36,0.03)' }}>
          <CardContent sx={{ py: '10px !important', px: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Notes</Typography>
            <Typography variant="body2" fontWeight={500} sx={{ whiteSpace: 'pre-wrap' }}>{customer.notes}</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────

function VehiclesTab({ customer, onCreateRO }: { customer: Customer; onCreateRO: () => void }) {
  if (customer.vehicle_count === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, bgcolor: 'action.hover', borderRadius: 3 }}>
        <Car size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
        <Typography variant="body2" color="text.disabled" display="block">No vehicles on file.</Typography>
        <Button size="small" variant="contained" startIcon={<Plus size={13} />} onClick={onCreateRO} sx={{ mt: 2, borderRadius: 100 }}>
          Create RO to Add Vehicle
        </Button>
      </Box>
    )
  }
  return (
    <Box sx={{ textAlign: 'center', py: 6, bgcolor: 'action.hover', borderRadius: 3 }}>
      <Car size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
      <Typography variant="body2" color="text.disabled">
        {customer.vehicle_count} vehicle{customer.vehicle_count !== 1 ? 's' : ''} — visible in Repair Orders
      </Typography>
    </Box>
  )
}

// ─── Repair Orders Tab ────────────────────────────────────────────────────────

function RepairOrdersTab({ customer, onSelectRO, onCreateRO }: {
  customer: Customer; onSelectRO: (id: number) => void; onCreateRO: () => void
}) {
  const { shop } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['repair_orders', { customer_id: customer.id }],
    queryFn: () => repairOrdersApi.list({ shop_id: shop?.id, customer_id: customer.id }),
    enabled: !!customer.id,
  })
  const ros = (data?.data ?? []) as RepairOrderListItem[]

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
  }

  if (ros.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, bgcolor: 'action.hover', borderRadius: 3 }}>
        <ClipboardList size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
        <Typography variant="body2" color="text.disabled" display="block">No repair orders yet.</Typography>
        <Button size="small" variant="contained" startIcon={<Plus size={13} />} onClick={onCreateRO} sx={{ mt: 2, borderRadius: 100 }}>
          Create First RO
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {ros.map((ro) => (
        <Card key={ro.id} variant="outlined" sx={{ borderRadius: 3, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
          <CardActionArea onClick={() => onSelectRO(ro.id)} sx={{ p: 0 }}>
            <CardContent sx={{ py: '12px !important', px: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={700}>{ro.ro_number}</Typography>
                    <Chip label={RO_STATUS_LABELS[ro.status]} size="small" color={RO_STATUS_COLORS[ro.status]} />
                    {ro.priority !== 'normal' && (
                      <Chip label={ro.priority.toUpperCase()} size="small" color={ro.priority === 'rush' ? 'error' : 'warning'} variant="outlined" />
                    )}
                  </Box>
                  {ro.vehicles && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      <Car size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                      {ro.vehicles.year} {ro.vehicles.make} {ro.vehicles.model}
                      {ro.vehicles.color ? ` · ${ro.vehicles.color}` : ''}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.disabled" display="block">
                    {formatDate(ro.created_at)}
                    {ro.scheduled_out_date && ` · Out: ${formatDate(ro.scheduled_out_date)}`}
                    {ro.estimated_total ? ` · Est: $${ro.estimated_total.toLocaleString()}` : ''}
                  </Typography>
                </Box>
                <ChevronRight size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
              </Box>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  )
}

function HistoryTab({ customerId, staffList }: { customerId: number; staffList: StaffMember[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer_history', customerId],
    queryFn: () => customersApi.history(customerId),
    enabled: !!customerId,
    staleTime: 60_000,
  })

  const staffMap = useMemo(() => {
    const map = new Map<number, StaffMember>()
    staffList.forEach((s) => map.set(s.id, s))
    return map
  }, [staffList])

  const items = useMemo<HistoryItem[]>(() => {
    const timeline: HistoryItem[] = []

    data?.ro_events?.forEach((evt) => {
      const meta = (evt as { metadata?: Record<string, unknown> }).metadata
      const description = (meta?.note as string | undefined) ?? (meta?.description as string | undefined) ?? evt.description
      timeline.push({
        id: `ro-event-${evt.id}`,
        timestamp: evt.created_at ?? '',
        type: 'ro_event',
        title: evt.description ?? formatHistoryTitle(evt.type),
        description,
        meta: evt.repair_orders?.ro_number ? `RO #${evt.repair_orders.ro_number}` : undefined,
        badge: evt.repair_orders?.job_number ? `Job ${evt.repair_orders.job_number}` : undefined,
        user: evt.user_id ? (staffMap.get(evt.user_id)?.name ?? `User #${evt.user_id}`) : 'System',
        icon: <ClipboardList size={14} />,
      })
    })

    data?.customer_interactions?.forEach((log) => {
      const direction = log.direction ? log.direction.charAt(0).toUpperCase() + log.direction.slice(1) : null
      const typeLabel = INTERACTION_LABELS[log.type] ?? 'Interaction'
      timeline.push({
        id: `interaction-${log.id}`,
        timestamp: log.created_at ?? '',
        type: 'interaction',
        title: log.subject || typeLabel,
        description: log.body,
        meta: log.repair_orders?.ro_number ? `RO #${log.repair_orders.ro_number}` : undefined,
        badge: direction ? `${direction} ${typeLabel}` : typeLabel,
        user: log.user_id ? (staffMap.get(log.user_id)?.name ?? `User #${log.user_id}`) : null,
        icon: INTERACTION_ICONS[log.type] ?? <MessageSquare size={14} />,
      })
    })

    data?.payments?.forEach((payment) => {
      const method = payment.payment_method
        ? payment.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : null
      const payer = payment.payer_type
        ? payment.payer_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : null
      const details = [
        payer ? `Payer: ${payer}` : null,
        payment.reference_number ? `Ref #${payment.reference_number}` : null,
      ].filter(Boolean).join(' · ') || null

      timeline.push({
        id: `payment-${payment.id}`,
        timestamp: payment.created_at ?? '',
        type: 'payment',
        title: 'Payment Received',
        description: formatCurrency(payment.amount),
        meta: payment.repair_orders?.ro_number ? `RO #${payment.repair_orders.ro_number}` : undefined,
        badge: method ?? 'Payment',
        user: payment.received_by ? (staffMap.get(payment.received_by)?.name ?? `User #${payment.received_by}`) : null,
        icon: <DollarSign size={14} />,
        subtext: payment.notes ?? details,
      })
    })

    return timeline.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return bTime - aTime
    })
  }, [data, staffMap])

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
  }

  if (!items.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
        <Typography variant="body2">No history recorded for this customer yet.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {items.map((item) => {
        const palette = TIMELINE_COLORS[item.type]
        return (
          <Box key={item.id} sx={{ display: 'flex', gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: palette.bg,
                color: palette.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </Box>
            <Box sx={{ flex: 1, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">{formatDateTime(item.timestamp)}</Typography>
              <Typography variant="body2" fontWeight={600}>{item.title}</Typography>
              {item.meta && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>
                  {item.meta}
                </Typography>
              )}
              {item.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {item.description}
                </Typography>
              )}
              {item.subtext && (
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.4 }}>
                  {item.subtext}
                </Typography>
              )}
              {(item.badge || item.user) && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.8 }}>
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      color={palette.chip}
                      sx={{ fontSize: '0.65rem', height: 22 }}
                    />
                  )}
                  {item.user && (
                    <Chip
                      label={item.user}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 22 }}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// ─── Customer Detail Panel ─────────────────────────────────────────────────────

function CustomerDetailPanel({ customer, onCreateRO, onSelectRO }: {
  customer: Customer; onCreateRO: () => void; onSelectRO: (id: number) => void
}) {
  const [tab, setTab] = useState(0)
  const { data: staffList = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ['staff-list'],
    queryFn: () => repairOrdersApi.staffList(),
    staleTime: 300_000,
  })
  const assignedCsr = customer.assigned_csr_id != null
    ? staffList.find((member) => member.id === customer.assigned_csr_id) ?? null
    : null
  const assignedCsrLabel = customer.assigned_csr_id != null
    ? (assignedCsr?.name ?? (staffLoading ? 'Loading...' : `User #${customer.assigned_csr_id}`))
    : 'Unassigned'
  const PreferredContactIcon = customer.preferred_contact
    ? PCM_ICONS[customer.preferred_contact]
    : MessageSquare

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        {/* Breadcrumb */}
        <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: 'block' }}>
          Customers &rsaquo; Customer Details
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{
              width: 52, height: 52, fontSize: 18, fontWeight: 700, borderRadius: 3,
              bgcolor: 'rgba(251,191,36,0.12)', color: 'primary.main',
            }}>
              {customer.first_name?.charAt(0)}{customer.last_name?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                {customer.last_name}, {customer.first_name}
              </Typography>
              {customer.company?.name && (
                <Typography variant="body2" color="text.secondary">{customer.company.name}</Typography>
              )}
            </Box>
          </Box>
          <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={onCreateRO} sx={{ borderRadius: 100 }}>
            New RO
          </Button>
        </Box>

        {/* Quick info bar — mirrors Tadabase layout */}
        <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
          {customer.phone && (
            <InfoStat icon={<Phone size={13} />} label="Phone">
              <Typography
                component="a" href={`tel:${customer.phone}`} variant="body2" fontWeight={600}
                sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
              >
                {customer.phone}
              </Typography>
            </InfoStat>
          )}

          {customer.email && (
            <InfoStat icon={<Mail size={13} />} label="Email">
              <Typography
                component="a" href={`mailto:${customer.email}`} variant="body2" fontWeight={600}
                sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
              >
                {customer.email}
              </Typography>
            </InfoStat>
          )}

          <InfoStat icon={<PreferredContactIcon size={13} />} label="Preferred Contact">
            {customer.preferred_contact ? (
              <PcmBadge value={customer.preferred_contact} />
            ) : (
              <Typography variant="body2" fontWeight={500} color="text.secondary">
                Not specified
              </Typography>
            )}
          </InfoStat>

          <InfoStat icon={<User size={13} />} label="Assigned CSR">
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ color: assignedCsr ? 'text.primary' : 'text.secondary' }}
            >
              {assignedCsrLabel}
            </Typography>
          </InfoStat>

          <InfoStat icon={<Car size={13} />} label="Vehicles">
            <Typography variant="body2" fontWeight={600}>{customer.vehicle_count}</Typography>
          </InfoStat>

          <InfoStat icon={<ClipboardList size={13} />} label="Open ROs">
            <Typography variant="body2" fontWeight={600} sx={{ color: customer.active_ro_count > 0 ? 'primary.main' : 'text.primary' }}>
              {customer.active_ro_count}
            </Typography>
          </InfoStat>

          <InfoStat icon={<Calendar size={13} />} label="Customer Since">
            <Typography variant="body2" fontWeight={600}>{formatDate(customer.created_at)}</Typography>
          </InfoStat>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, minHeight: 44, '& .MuiTab-root': { minHeight: 44, fontSize: '0.82rem' } }}>
          <Tab label="Details" />
          <Tab label={`Vehicles${customer.vehicle_count > 0 ? ` (${customer.vehicle_count})` : ''}`} />
          <Tab label={`Repair Orders${customer.active_ro_count > 0 ? ` · ${customer.active_ro_count} open` : ''}`} />
          <Tab label="History" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {tab === 0 && <DetailsTab customer={customer} />}
        {tab === 1 && <VehiclesTab customer={customer} onCreateRO={onCreateRO} />}
        {tab === 2 && <RepairOrdersTab customer={customer} onSelectRO={onSelectRO} onCreateRO={onCreateRO} />}
        {tab === 3 && <HistoryTab customerId={customer.id} staffList={staffList} />}
      </Box>
    </Box>
  )
}

// ─── Customer View ─────────────────────────────────────────────────────────────

export default function CustomerView() {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedROId, setSelectedROId] = useState<number | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardCustomer, setWizardCustomer] = useState<Customer | null>(null)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { shop_id: shop?.id, search: debouncedSearch }],
    queryFn: () => customersApi.list({ shop_id: shop?.id, search: debouncedSearch || undefined }),
    staleTime: 30_000,
  })

  const customers = data?.data ?? []
  const totalCount = data?.pagination?.total ?? customers.length

  function openWizard(customer?: Customer) {
    setWizardCustomer(customer ?? null)
    setWizardOpen(true)
  }

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <Box sx={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Customers</Typography>
            {totalCount > 0 && (
              <Tooltip title="Total customers">
                <Chip label={`${totalCount} total`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Button
              variant="outlined" startIcon={<UserPlus size={15} />}
              onClick={() => setAddCustomerOpen(true)} fullWidth
              sx={{ py: 1, fontSize: '0.8rem', borderRadius: 2 }}
            >
              Add Customer
            </Button>
            <Button
              variant="contained" startIcon={<Plus size={15} />}
              onClick={() => openWizard()} fullWidth
              sx={{ py: 1, fontSize: '0.8rem', borderRadius: 2 }}
            >
              New RO
            </Button>
          </Box>
          <TextField
            fullWidth size="small" placeholder="Search by name, phone, email…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={15} style={{ opacity: 0.5 }} /></InputAdornment> }}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : customers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <User size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
              <Typography variant="body2" color="text.secondary" display="block">
                {search ? 'No customers match your search.' : 'No customers yet.'}
              </Typography>
              {!search && (
                <Button size="small" variant="outlined" sx={{ mt: 1.5, borderRadius: 100 }} onClick={() => setAddCustomerOpen(true)}>
                  Add first customer
                </Button>
              )}
            </Box>
          ) : (
            customers.map((c) => (
              <CustomerRow
                key={c.id} customer={c}
                selected={selectedCustomer?.id === c.id}
                onClick={() => setSelectedCustomer(c)}
              />
            ))
          )}
        </Box>
      </Box>

      {/* Main panel */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedCustomer ? (
          <CustomerDetailPanel
            customer={selectedCustomer}
            onCreateRO={() => openWizard(selectedCustomer)}
            onSelectRO={(id) => setSelectedROId(id)}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.disabled', gap: 2 }}>
            <User size={48} style={{ opacity: 0.2 }} />
            <Typography variant="body2">Select a customer to view details</Typography>
            <Button variant="outlined" size="small" startIcon={<Plus size={14} />} onClick={() => openWizard()} sx={{ borderRadius: 100 }}>
              New Repair Order
            </Button>
          </Box>
        )}
      </Box>

      {/* RO Detail Drawer */}
      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />

      {/* Add Customer */}
      {addCustomerOpen && (
        <CustomerEditDialog
          customer={null}
          onClose={() => setAddCustomerOpen(false)}
          onSaved={(customer) => { setSelectedCustomer(customer); setAddCustomerOpen(false) }}
        />
      )}

      {/* New RO Wizard */}
      <NewROWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        preselectedCustomer={wizardCustomer}
        onSuccess={(_roNumber, roId) => {
          setWizardOpen(false)
          qc.invalidateQueries({ queryKey: ['customers'] })
          qc.invalidateQueries({ queryKey: ['repair_orders'] })
          if (selectedCustomer) {
            qc.invalidateQueries({ queryKey: ['repair_orders', { customer_id: selectedCustomer.id }] })
          }
          setSelectedROId(roId)
        }}
        onViewRO={(roId) => {
          setWizardOpen(false)
          setSelectedROId(roId)
        }}
      />
    </Box>
  )
}
