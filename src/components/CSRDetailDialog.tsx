import { useState, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { teamApi } from '@/api/team'
import type { TeamMember } from '@/api/team'
import { customersApi } from '@/api/customers'
import { repairOrdersApi } from '@/api/repairOrders'
import type { Customer } from '@/types/customer'
import type { RepairOrderListItem, PaymentWithContext } from '@/types/repairOrder'
import { RO_STATUS_LABELS, RO_STATUS_COLORS } from '@/types/repairOrder'
import type { Role } from '@/types/auth'
import RODetailDrawer from '@/views/customer-view/components/RODetailDrawer'
import { formatDate, formatCurrency, initials } from '@/lib/utils'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import {
  X, Users, FileText, DollarSign, Activity,
  Phone, Mail, Briefcase, Car, Clock,
} from 'lucide-react'

// Lazy-load CustomerDetailDialog to avoid circular import issues
const CustomerDetailDialog = lazy(
  () => import('@/views/customers-view/components/CustomerDetailDialog')
)

// ─── Role badge colors (mirrors TeamView) ─────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:                { bg: '#FEE2E2', color: '#B91C1C' },
  upper_management:     { bg: '#FEF3C7', color: '#92400E' },
  csr_manager:          { bg: '#DBEAFE', color: '#1E40AF' },
  csr:                  { bg: '#EFF6FF', color: '#1D4ED8' },
  logistics_manager:    { bg: '#F3E8FF', color: '#6D28D9' },
  logistics:            { bg: '#FAF5FF', color: '#7C3AED' },
  production_scheduler: { bg: '#ECFDF5', color: '#065F46' },
  shop_foreman:         { bg: '#D1FAE5', color: '#065F46' },
  technician:           { bg: '#FEF9C3', color: '#854D0E' },
  painter:              { bg: '#FFF7ED', color: '#C2410C' },
  nttbe:                { bg: '#F0FDF4', color: '#166534' },
  accounting:           { bg: '#F0F9FF', color: '#0369A1' },
}

function RoleBadge({ role }: { role: Role | null | undefined }) {
  if (!role) return <Typography sx={{ color: 'text.disabled', fontSize: '0.82rem' }}>—</Typography>
  const colors = ROLE_COLORS[role.code] ?? { bg: '#F3F4F6', color: '#374151' }
  return (
    <Box component="span" sx={{
      px: 1.25, py: 0.3, borderRadius: 5,
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
      bgcolor: colors.bg, color: colors.color, whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {role.name}
    </Box>
  )
}

function StatusBadge({ status }: { status: TeamMember['status'] }) {
  const map: Record<TeamMember['status'], { bg: string; color: string; label: string }> = {
    active:   { bg: '#DCFCE7', color: '#15803D', label: 'Active' },
    inactive: { bg: '#F3F4F6', color: '#6B7280', label: 'Inactive' },
    pending:  { bg: '#FEF9C3', color: '#854D0E', label: 'Pending' },
  }
  const s = map[status] ?? map.inactive
  return (
    <Box component="span" sx={{
      px: 1.25, py: 0.3, borderRadius: 5,
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
      bgcolor: s.bg, color: s.color, whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {s.label}
    </Box>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2.5 }}>{children}</Box> : null
}

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      {icon && <Box sx={{ mb: 1.5, color: 'text.disabled', display: 'flex', justifyContent: 'center' }}>{icon}</Box>}
      <Typography sx={{ color: 'text.secondary', fontSize: '0.92rem' }}>{message}</Typography>
    </Box>
  )
}

const headSx = {
  fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' as const,
  letterSpacing: '0.07em', color: 'text.secondary', py: 1.5,
}
const cellSx = { fontSize: '0.9rem', py: 1.75, color: 'text.primary' }

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  member,
  role,
  customersCount,
  activeRosCount,
  closedRosCount,
}: {
  member: TeamMember
  role: Role | null | undefined
  customersCount: number
  activeRosCount: number
  closedRosCount: number
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── Stats row ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        {[
          { label: 'Assigned Customers', value: customersCount, color: 'primary.main' },
          { label: 'Active ROs',         value: activeRosCount,  color: '#10B981' },
          { label: 'Closed ROs',         value: closedRosCount,  color: 'text.secondary' },
        ].map(({ label, value, color }) => (
          <Box key={label} sx={{
            p: 2.5, borderRadius: 2.5, textAlign: 'center',
            border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
          }}>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {value}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mt: 0.5 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Profile details ── */}
      <Box sx={{
        p: 2.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'text.disabled' }}>
          Profile
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {member.email && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Mail size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Email</Typography>
                <Typography sx={{ fontSize: '0.88rem' }}>{member.email}</Typography>
              </Box>
            </Box>
          )}
          {member.phone && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Phone size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Phone</Typography>
                <Typography sx={{ fontSize: '0.88rem' }}>{member.phone}</Typography>
              </Box>
            </Box>
          )}
          {member.job_title && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Briefcase size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Job Title</Typography>
                <Typography sx={{ fontSize: '0.88rem' }}>{member.job_title}</Typography>
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Clock size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Member Since</Typography>
              <Typography sx={{ fontSize: '0.88rem' }}>
                {member.created_at
                  ? new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'}
              </Typography>
            </Box>
          </Box>
          {member.last_login && (
            <Box>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Last Login</Typography>
              <Typography sx={{ fontSize: '0.88rem' }}>{formatDate(member.last_login)}</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab({
  customers,
  isLoading,
  onSelectCustomer,
}: {
  customers: Customer[]
  isLoading: boolean
  onSelectCustomer: (c: Customer) => void
}) {
  if (!isLoading && customers.length === 0) {
    return <EmptyState icon={<Users size={28} />} message="No customers assigned to this CSR." />
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={headSx}>Customer</TableCell>
          <TableCell sx={headSx}>Phone</TableCell>
          <TableCell sx={headSx}>Email</TableCell>
          <TableCell sx={headSx} align="center">Vehicles</TableCell>
          <TableCell sx={headSx} align="center">Active ROs</TableCell>
          <TableCell sx={headSx}>Since</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {isLoading ? (
          <SkeletonRows cols={6} />
        ) : (
          customers.map((c) => (
            <TableRow
              key={c.id}
              hover
              sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
              onClick={() => onSelectCustomer(c)}
            >
              <TableCell sx={cellSx}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Avatar sx={{ width: 30, height: 30, fontSize: '0.72rem', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    {initials(c.first_name, c.last_name)}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
                      {c.first_name} {c.last_name}
                    </Typography>
                    {c.company?.name && (
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{c.company.name}</Typography>
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell sx={{ ...cellSx, color: c.phone ? 'text.primary' : 'text.disabled' }}>
                {c.phone ?? '—'}
              </TableCell>
              <TableCell sx={{ ...cellSx, color: c.email ? 'text.primary' : 'text.disabled' }}>
                {c.email ?? '—'}
              </TableCell>
              <TableCell sx={cellSx} align="center">
                <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.vehicle_count}</Typography>
              </TableCell>
              <TableCell sx={cellSx} align="center">
                {c.active_ro_count > 0 ? (
                  <Chip label={c.active_ro_count} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 28 }} />
                ) : (
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled' }}>0</Typography>
                )}
              </TableCell>
              <TableCell sx={{ ...cellSx, color: 'text.secondary', fontSize: '0.82rem' }}>
                {formatDate(c.created_at)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

// ─── Repair Orders Tab ────────────────────────────────────────────────────────

const INACTIVE_STATUSES = new Set(['delivered', 'closed'])

function RepairOrdersTab({
  ros,
  isLoading,
  onSelectRO,
}: {
  ros: RepairOrderListItem[]
  isLoading: boolean
  onSelectRO: (id: number) => void
}) {
  if (!isLoading && ros.length === 0) {
    return <EmptyState icon={<FileText size={28} />} message="No repair orders assigned to this CSR." />
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={headSx}>Job #</TableCell>
          <TableCell sx={headSx}>RO #</TableCell>
          <TableCell sx={headSx}>Customer</TableCell>
          <TableCell sx={headSx}>Vehicle</TableCell>
          <TableCell sx={headSx}>Status</TableCell>
          <TableCell sx={headSx}>Type</TableCell>
          <TableCell sx={headSx}>Arrived</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {isLoading ? (
          <SkeletonRows cols={7} />
        ) : (
          ros.map((ro) => {
            const v = ro.vehicle ?? ro.vehicles
            const vehicleLabel = v ? [v.year, v.make, v.model].filter(Boolean).join(' ') : '—'
            const customerName = ro.customer
              ? `${ro.customer.first_name} ${ro.customer.last_name}`.trim()
              : ro.customers
              ? `${ro.customers.first_name} ${ro.customers.last_name}`.trim()
              : '—'
            const isInactive = INACTIVE_STATUSES.has(ro.status)

            return (
              <TableRow
                key={ro.id}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { border: 0 },
                  opacity: isInactive ? 0.65 : 1,
                }}
                onClick={() => onSelectRO(ro.id)}
              >
                <TableCell sx={{ ...cellSx, fontWeight: 700 }}>{ro.job_number ?? '—'}</TableCell>
                <TableCell sx={{ ...cellSx, fontFamily: 'monospace', fontSize: '0.82rem' }}>{ro.ro_number}</TableCell>
                <TableCell sx={cellSx}>{customerName}</TableCell>
                <TableCell sx={{ ...cellSx, color: v ? 'text.primary' : 'text.disabled' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {v && <Car size={13} style={{ opacity: 0.45, flexShrink: 0 }} />}
                    {vehicleLabel}
                  </Box>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Chip
                    label={RO_STATUS_LABELS[ro.status] ?? ro.status}
                    color={RO_STATUS_COLORS[ro.status] ?? 'default'}
                    size="small"
                    sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell sx={{ ...cellSx, textTransform: 'capitalize', fontSize: '0.82rem', color: 'text.secondary' }}>
                  {ro.job_type?.replace('_', ' ') ?? '—'}
                </TableCell>
                <TableCell sx={{ ...cellSx, fontSize: '0.82rem', color: 'text.secondary' }}>
                  {formatDate(ro.arrived_at ?? ro.created_at)}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  initial:           'Initial',
  deductible:        'Deductible',
  supplement:        'Supplement',
  tow:               'Tow',
  self_pay:          'Self-Pay',
  employee:          'Employee',
  total_loss_fees:   'Total Loss Fees',
  customer_pay:      'Customer Pay',
}

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  paid:         { bg: '#DCFCE7', color: '#15803D', label: 'Paid' },
  not_paid:     { bg: '#FEE2E2', color: '#B91C1C', label: 'Not Paid' },
  approved:     { bg: '#DBEAFE', color: '#1E40AF', label: 'Approved' },
  not_approved: { bg: '#F3F4F6', color: '#6B7280', label: 'Not Approved' },
}

function TransactionsTab({
  payments,
  isLoading,
  onSelectRO,
}: {
  payments: PaymentWithContext[]
  isLoading: boolean
  onSelectRO: (id: number) => void
}) {
  if (!isLoading && payments.length === 0) {
    return <EmptyState icon={<DollarSign size={28} />} message="No transactions found for this CSR's customers." />
  }

  const totalPaid = payments.filter(p => p.payment_status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalOutstanding = payments.filter(p => p.payment_status === 'not_paid').reduce((s, p) => s + p.amount, 0)

  return (
    <Box>
      {/* Summary row */}
      {!isLoading && payments.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
          <Box sx={{ flex: 1, p: 1.75, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: 'success.main', letterSpacing: '-0.01em' }}>
              {formatCurrency(totalPaid)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total Collected
            </Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1.75, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: totalOutstanding > 0 ? '#EF4444' : 'text.disabled', letterSpacing: '-0.01em' }}>
              {formatCurrency(totalOutstanding)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Outstanding
            </Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1.75, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {payments.length}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total Transactions
            </Typography>
          </Box>
        </Box>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headSx}>Date</TableCell>
            <TableCell sx={headSx}>Customer</TableCell>
            <TableCell sx={headSx}>RO / Job #</TableCell>
            <TableCell sx={headSx}>Type</TableCell>
            <TableCell sx={headSx} align="right">Amount</TableCell>
            <TableCell sx={headSx}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <SkeletonRows cols={6} />
          ) : (
            payments.map((p) => {
              const statusStyle = PAYMENT_STATUS_COLORS[p.payment_status ?? ''] ?? PAYMENT_STATUS_COLORS.not_paid
              const roId = p.repair_order?.id

              return (
                <TableRow
                  key={p.id}
                  hover
                  sx={{
                    cursor: roId ? 'pointer' : 'default',
                    '&:last-child td': { border: 0 },
                  }}
                  onClick={() => roId && onSelectRO(roId)}
                >
                  <TableCell sx={{ ...cellSx, fontSize: '0.82rem', color: 'text.secondary' }}>
                    {formatDate(p.date_added ?? p.created_at)}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {p.customer
                      ? `${p.customer.first_name} ${p.customer.last_name}`.trim()
                      : '—'}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {p.repair_order
                      ? (
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                            {p.repair_order.job_number ? `Job #${p.repair_order.job_number}` : `RO #${p.repair_order.ro_number}`}
                          </Typography>
                          {p.repair_order.job_number && (
                            <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontFamily: 'monospace' }}>
                              RO #{p.repair_order.ro_number}
                            </Typography>
                          )}
                        </Box>
                      )
                      : '—'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, fontSize: '0.82rem' }}>
                    {TRANSACTION_TYPE_LABELS[p.transaction_type ?? ''] ?? p.transaction_type ?? '—'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, fontWeight: 700, textAlign: 'right' }}>
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Box component="span" sx={{
                      px: 1, py: 0.25, borderRadius: 4,
                      fontSize: '0.7rem', fontWeight: 700,
                      bgcolor: statusStyle.bg, color: statusStyle.color,
                      display: 'inline-block',
                    }}>
                      {statusStyle.label}
                    </Box>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </Box>
  )
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({
  ros,
  isLoading,
  onSelectRO,
}: {
  ros: RepairOrderListItem[]
  isLoading: boolean
  onSelectRO: (id: number) => void
}) {
  if (!isLoading && ros.length === 0) {
    return <EmptyState icon={<Activity size={28} />} message="No recent activity for this CSR." />
  }

  // Sort by most recently created/updated
  const sorted = [...ros].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {isLoading
        ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={72} variant="rounded" sx={{ borderRadius: 2 }} />)
        : sorted.map((ro) => {
            const v = ro.vehicle ?? ro.vehicles
            const vehicleLabel = v ? [v.year, v.make, v.model].filter(Boolean).join(' ') : null
            const customerName = ro.customer
              ? `${ro.customer.first_name} ${ro.customer.last_name}`.trim()
              : ro.customers
              ? `${ro.customers.first_name} ${ro.customers.last_name}`.trim()
              : null

            return (
              <Box
                key={ro.id}
                onClick={() => onSelectRO(ro.id)}
                sx={{
                  p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2.5,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                  bgcolor: 'background.paper',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {ro.job_number ? `Job #${ro.job_number}` : `RO #${ro.ro_number}`}
                    </Typography>
                    <Chip
                      label={RO_STATUS_LABELS[ro.status] ?? ro.status}
                      color={RO_STATUS_COLORS[ro.status] ?? 'default'}
                      size="small"
                      sx={{ fontSize: '0.68rem', fontWeight: 600, height: 20 }}
                    />
                    {ro.job_type && (
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'capitalize' }}>
                        {ro.job_type.replace('_', ' ')}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                    {[customerName, vehicleLabel].filter(Boolean).join(' · ') || 'No details'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
                    {formatDate(ro.arrived_at ?? ro.created_at)}
                  </Typography>
                  {ro.has_outstanding_payment && (
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#EF4444', mt: 0.25 }}>
                      Outstanding
                    </Typography>
                  )}
                </Box>
              </Box>
            )
          })
      }

      {!isLoading && (
        <Alert severity="info" sx={{ borderRadius: 2, mt: 1, fontSize: '0.82rem' }}>
          Showing {ros.length} repair order{ros.length !== 1 ? 's' : ''} assigned to this CSR, sorted by most recent.
          Open any RO to see detailed event history in its Activity tab.
        </Alert>
      )}
    </Box>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  memberId: number | null
  onClose: () => void
}

function memberInitials(m: TeamMember) {
  if (m.first_name && m.last_name) return (m.first_name[0] + m.last_name[0]).toUpperCase()
  const parts = (m.name ?? '').split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (m.name ?? '?').slice(0, 2).toUpperCase()
}

const TABS = [
  { label: 'Overview',      icon: <Briefcase size={14} /> },
  { label: 'Customers',     icon: <Users     size={14} /> },
  { label: 'Repair Orders', icon: <FileText  size={14} /> },
  { label: 'Transactions',  icon: <DollarSign size={14} /> },
  { label: 'Activity',      icon: <Activity  size={14} /> },
]

export default function CSRDetailDialog({ memberId, onClose }: Props) {
  const [tab, setTab] = useState(0)
  const [selectedROId, setSelectedROId] = useState<number | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // ── Fetch team members (cached) ──
  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['team_members'],
    queryFn: () => teamApi.listMembers(),
    staleTime: 60_000,
    enabled: !!memberId,
  })

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles_list'],
    queryFn: () => teamApi.listRoles(),
    staleTime: 120_000,
    enabled: !!memberId,
  })

  const member = members.find(m => m.id === memberId) ?? null
  const role = member?.role_id != null ? roles.find(r => r.id === member.role_id) : null

  // ── Fetch customers assigned to this CSR ──
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers_by_csr', memberId],
    queryFn: () => customersApi.list({ assigned_csr_id: memberId!, per_page: 200 }),
    enabled: !!memberId,
    staleTime: 30_000,
  })
  const rawCustomers: Customer[] = customersData?.data ?? []
  const customers: Customer[] = rawCustomers
  const customersTotal = customersData?.pagination?.total ?? customers.length

  // ── Fetch ROs for this CSR ──
  const { data: rosData, isLoading: rosLoading } = useQuery({
    queryKey: ['ros_by_csr', memberId],
    queryFn: () => repairOrdersApi.list({ csr_id: memberId!, per_page: 200 }),
    enabled: !!memberId,
    staleTime: 30_000,
  })
  const ros: RepairOrderListItem[] = rosData?.data ?? []

  const activeRosCount = ros.filter(r => !INACTIVE_STATUSES.has(r.status)).length
  const closedRosCount = ros.filter(r => INACTIVE_STATUSES.has(r.status)).length

  // ── Fetch transactions for customers of this CSR ──
  // Only fetch when the Transactions tab is active
  const customerIds = new Set(customers.map(c => c.id))
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments_by_csr', memberId],
    queryFn: () => repairOrdersApi.listAllPayments({ per_page: 500 }),
    enabled: !!memberId && tab === 3 && customers.length > 0,
    staleTime: 60_000,
  })
  const payments: PaymentWithContext[] = (paymentsData?.data ?? []).filter(
    p => p.customer?.id != null && customerIds.has(p.customer.id)
  )

  const isLoading = membersLoading

  return (
    <>
      <Dialog
        open={memberId !== null}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 0,
            height: '100vh',
            maxHeight: '100vh',
            ml: 'auto',
            mr: 0,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* ── Header ── */}
        <Box sx={{ flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', borderTop: '3px solid #0EA5E9' }}>
          {/* Identity row */}
          <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              {isLoading || !member ? (
                <>
                  <Skeleton variant="circular" width={48} height={48} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width={180} height={26} />
                    <Skeleton variant="text" width={120} height={18} />
                  </Box>
                </>
              ) : (
                <>
                  <Avatar sx={{
                    width: 48, height: 48, fontSize: '1rem', fontWeight: 700,
                    bgcolor: '#E0F2FE', color: '#0284C7', flexShrink: 0,
                  }}>
                    {memberInitials(member)}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                      {member.name || `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Unknown Member'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4, flexWrap: 'wrap' }}>
                      {member.job_title && (
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{member.job_title}</Typography>
                      )}
                      <RoleBadge role={role} />
                      <StatusBadge status={member.status} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.75, flexWrap: 'wrap' }}>
                      {member.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Mail size={12} style={{ opacity: 0.4 }} />
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{member.email}</Typography>
                        </Box>
                      )}
                      {member.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Phone size={12} style={{ opacity: 0.4 }} />
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{member.phone}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <IconButton size="small" onClick={onClose} sx={{ flexShrink: 0, color: 'text.secondary' }}>
                    <X size={16} />
                  </IconButton>
                </>
              )}
            </Box>

            {/* Stats strip */}
            {member && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                {[
                  { value: customersTotal, label: 'Customers', color: '#0EA5E9' },
                  { value: activeRosCount, label: 'Active ROs', color: '#10B981' },
                  { value: closedRosCount, label: 'Closed',     color: 'text.disabled' },
                ].map(({ value, label, color }) => (
                  <Box key={label} sx={{
                    flex: 1, py: 1, textAlign: 'center',
                    borderRadius: 1.5,
                    bgcolor: 'rgba(0,0,0,0.03)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {value}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mt: 0.3 }}>
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* ── Pill-style tabs on light bg ── */}
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              TabIndicatorProps={{ style: { display: 'none' } }}
              sx={{
                minHeight: 32,
                '& .MuiTabs-flexContainer': { gap: 0.25 },
                '& .MuiTab-root': {
                  minHeight: 30,
                  borderRadius: 5,
                  py: 0.4,
                  px: 1.5,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  color: 'text.secondary',
                  gap: 0.5,
                  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                  '&.Mui-selected': {
                    bgcolor: '#E0F2FE',
                    color: '#0284C7',
                  },
                },
              }}
            >
              {TABS.map((t, i) => (
                <Tab key={t.label} label={t.label} icon={t.icon} iconPosition="start" value={i} />
              ))}
            </Tabs>
          </Box>
        </Box>

        {/* ── Content ── */}
        <DialogContent sx={{ flex: 1, overflowY: 'auto', pt: 2.5, px: 3, pb: 3 }}>
          <TabPanel value={tab} index={0}>
            {member && (
              <OverviewTab
                member={member}
                role={role}
                customersCount={customersTotal}
                activeRosCount={activeRosCount}
                closedRosCount={closedRosCount}
              />
            )}
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <CustomersTab
              customers={customers}
              isLoading={customersLoading}
              onSelectCustomer={setSelectedCustomer}
            />
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <RepairOrdersTab
              ros={ros}
              isLoading={rosLoading}
              onSelectRO={setSelectedROId}
            />
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <TransactionsTab
              payments={payments}
              isLoading={paymentsLoading}
              onSelectRO={setSelectedROId}
            />
          </TabPanel>

          <TabPanel value={tab} index={4}>
            <ActivityTab
              ros={ros}
              isLoading={rosLoading}
              onSelectRO={setSelectedROId}
            />
          </TabPanel>
        </DialogContent>
      </Dialog>

      {/* ── Sub-modals ── */}
      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />

      {selectedCustomer && (
        <Suspense fallback={
          <Dialog open fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, p: 4, textAlign: 'center' } }}>
            <CircularProgress />
          </Dialog>
        }>
          <CustomerDetailDialog
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            onEdit={() => setSelectedCustomer(null)}
            onNewRO={() => setSelectedCustomer(null)}
          />
        </Suspense>
      )}
    </>
  )
}
