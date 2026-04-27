import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'
import type { CSRTransactionGroup } from '@/api/reports'
import type { PaymentWithContext } from '@/types/repairOrder'
import { formatDate, formatCurrency, initials } from '@/lib/utils'
import { generateCSRPaymentReport } from '@/lib/generateCSRReport'
import RODetailDrawer from '@/views/customer-view/components/RODetailDrawer'
import CSRDetailDialog from '@/components/CSRDetailDialog'
import { useRealtime } from '@/hooks/useRealtime'
import { useAuth } from '@/hooks/useAuth'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { ArrowLeft, DollarSign, AlertCircle, Download } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  not_paid:     { bg: '#FEE2E2', color: '#B91C1C', label: 'Not Paid' },
  not_approved: { bg: '#F3F4F6', color: '#6B7280', label: 'Not Approved' },
}

const headSx = {
  fontWeight: 700,
  fontSize: '0.73rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  color: 'text.secondary',
  py: 1.25,
  bgcolor: 'rgba(0,0,0,0.02)',
}

const cellSx = { fontSize: '0.88rem', py: 1.5, color: 'text.primary' }

// ── KPI Bar ───────────────────────────────────────────────────────────────────

function KpiBar({ meta }: {
  meta: { total_outstanding: number; total_not_paid: number; transaction_count: number; csr_count: number }
}) {
  const stats = [
    { icon: <DollarSign size={13} />, value: formatCurrency(meta.total_outstanding), label: 'Total Outstanding', valueColor: '#EF4444' },
    { icon: <AlertCircle size={13} />, value: formatCurrency(meta.total_not_paid),   label: 'Not Paid',          valueColor: '#B91C1C' },
    { icon: null,                      value: String(meta.transaction_count),         label: 'Transactions',      valueColor: 'text.primary' },
    { icon: null,                      value: String(meta.csr_count),                 label: 'CSRs w/ Balances',  valueColor: 'text.primary' },
  ]

  return (
    <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
      {stats.map(({ icon, value, label, valueColor }) => (
        <Box
          key={label}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.75,
            py: 1.25,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            minWidth: 0,
          }}
        >
          {icon && (
            <Box sx={{ color: valueColor, flexShrink: 0 }}>{icon}</Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: valueColor, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              {value}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mt: 0.2 }}>
              {label}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// ── CSR Table Section ─────────────────────────────────────────────────────────

function CSRSection({
  group,
  onSelectRO,
  onSelectCSR,
}: {
  group: CSRTransactionGroup
  onSelectRO: (id: number) => void
  onSelectCSR: (id: number) => void
}) {
  const { total_outstanding, total_not_paid, total_not_approved, transaction_count } = group.metadata

  const csrId   = group.csr?.id ?? null
  const csrName = group.csr
    ? `${group.csr.first_name} ${group.csr.last_name}`.trim()
    : 'Unassigned'

  const avatarColors = csrId === null
    ? { bg: '#F3F4F6', color: '#6B7280' }
    : { bg: '#DBEAFE', color: '#1D4ED8' }

  const [firstName, lastName] = csrName.split(' ')

  return (
    <Box sx={{
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2.5,
      overflow: 'hidden',
      bgcolor: 'background.paper',
    }}>
      {/* ── CSR header ── */}
      <Box sx={{
        px: 2.5, py: 1.75,
        display: 'flex', alignItems: 'center', gap: 1.75,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'rgba(0,0,0,0.015)',
      }}>
        <Avatar sx={{
          width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700,
          bgcolor: avatarColors.bg, color: avatarColors.color, flexShrink: 0,
        }}>
          {csrId === null ? '?' : initials(firstName, lastName)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Clickable CSR name — opens user detail modal */}
          <Typography
            onClick={() => csrId && onSelectCSR(csrId)}
            sx={{
              fontWeight: 700,
              fontSize: '0.95rem',
              lineHeight: 1.2,
              cursor: csrId ? 'pointer' : 'default',
              display: 'inline-block',
              '&:hover': csrId ? {
                color: 'primary.main',
                textDecoration: 'underline',
              } : {},
            }}
          >
            {csrName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.35, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {transaction_count} transaction{transaction_count !== 1 ? 's' : ''}
            </Typography>
            {total_not_paid > 0 && (
              <Typography sx={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 600 }}>
                {formatCurrency(total_not_paid)} not paid
              </Typography>
            )}
            {total_not_approved > 0 && (
              <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600 }}>
                {formatCurrency(total_not_approved)} not approved
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#EF4444', letterSpacing: '-0.01em' }}>
            {formatCurrency(total_outstanding)}
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Outstanding
          </Typography>
        </Box>
      </Box>

      {/* ── Transactions table ── */}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headSx}>Customer Name</TableCell>
            <TableCell sx={{ ...headSx, textAlign: 'right' }}>Amount</TableCell>
            <TableCell sx={headSx}>Job #</TableCell>
            <TableCell sx={headSx}>Payment Status</TableCell>
            <TableCell sx={headSx}>Date Added</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {group.transactions.map((p: PaymentWithContext) => {
            const statusStyle = STATUS_STYLE[p.payment_status ?? ''] ?? STATUS_STYLE.not_paid
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
                <TableCell sx={cellSx}>
                  {p.customer
                    ? `${p.customer.first_name} ${p.customer.last_name}`.trim()
                    : <Typography component="span" sx={{ color: 'text.disabled', fontSize: '0.82rem' }}>—</Typography>}
                </TableCell>

                <TableCell sx={{ ...cellSx, fontWeight: 700, textAlign: 'right' }}>
                  {formatCurrency(p.amount)}
                </TableCell>

                <TableCell sx={{ ...cellSx, fontWeight: 600 }}>
                  {p.repair_order?.job_number != null
                    ? String(p.repair_order.job_number)
                    : <Typography component="span" sx={{ color: 'text.disabled', fontSize: '0.82rem' }}>—</Typography>}
                </TableCell>

                <TableCell sx={cellSx}>
                  <Box component="span" sx={{
                    px: 1, py: 0.25, borderRadius: 4,
                    fontSize: '0.7rem', fontWeight: 700,
                    bgcolor: statusStyle.bg, color: statusStyle.color,
                    display: 'inline-block', whiteSpace: 'nowrap',
                  }}>
                    {statusStyle.label}
                  </Box>
                </TableCell>

                <TableCell sx={{ ...cellSx, fontSize: '0.8rem', color: 'text.secondary' }}>
                  {formatDate(p.date_added ?? p.created_at)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* KPI bar skeleton */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {[1, 2, 3, 4].map(i => (
          <Box key={i} sx={{ flex: 1, px: 1.75, py: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="80%" height={12} />
            </Box>
          </Box>
        ))}
      </Box>

      {[1, 2, 3].map(i => (
        <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.75, display: 'flex', gap: 1.75, alignItems: 'center', bgcolor: 'rgba(0,0,0,0.015)', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="circular" width={34} height={34} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={160} height={20} />
              <Skeleton variant="text" width={100} height={16} />
            </Box>
            <Skeleton variant="text" width={80} height={24} />
          </Box>
          {[1, 2, 3, 4].map(j => (
            <Box key={j} sx={{ display: 'flex', gap: 2, px: 2, py: 1.25, borderBottom: j < 4 ? '1px solid' : 'none', borderColor: 'divider' }}>
              {[160, 60, 60, 80, 70].map((w, k) => (
                <Skeleton key={k} variant="text" width={w} height={18} />
              ))}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
}

export default function TransactionsByCSRReport({ onBack }: Props) {
  const [selectedROId,  setSelectedROId]  = useState<number | null>(null)
  const [selectedCsrId, setSelectedCsrId] = useState<number | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const qc     = useQueryClient()
  const { shop } = useAuth()
  const shopId   = shop?.id ?? null

  const { data: response, isLoading } = useQuery({
    queryKey: ['report_transactions_by_csr'],
    queryFn: () => reportsApi.transactionsByCSR(),
    staleTime: 60_000,
  })

  // Invalidate the report whenever any payment in this shop changes
  useRealtime(
    shopId ? `payments/${shopId}` : null,
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ['report_transactions_by_csr'] })
    }, [qc]),
  )

  const csrGroups = response?.csrs ?? []
  const meta      = response?.metadata

  async function handleDownload() {
    if (csrGroups.length === 0 || isDownloading) return
    setIsDownloading(true)
    try {
      await generateCSRPaymentReport(csrGroups)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Reports
          </button>

          {!isLoading && csrGroups.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={14} />}
              onClick={handleDownload}
              disabled={isDownloading}
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderColor: 'divider',
                color: 'text.secondary',
                '&:hover': { borderColor: 'text.secondary', bgcolor: 'rgba(0,0,0,0.03)' },
              }}
            >
              {isDownloading ? 'Generating…' : 'Download PDF'}
            </Button>
          )}
        </Box>

        <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary', lineHeight: 1.2 }}>
          Outstanding Transactions by CSR
        </Typography>
        <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', mt: 0.5 }}>
          Repair order transactions with status <strong>Not Paid</strong> or <strong>Not Approved</strong>
        </Typography>

        {/* ── Compact KPI bar ── */}
        {!isLoading && meta && meta.transaction_count > 0 && (
          <KpiBar meta={meta} />
        )}
      </Box>

      {/* ── Content ── */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : csrGroups.length === 0 ? (
        <Box sx={{
          py: 10, textAlign: 'center',
          border: '1px solid', borderColor: 'divider',
          borderRadius: 2.5, bgcolor: 'background.paper',
        }}>
          <DollarSign size={32} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.secondary' }}>
            No outstanding transactions
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled', mt: 0.5 }}>
            All transactions are paid or approved.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {csrGroups.map(group => (
            <CSRSection
              key={group.csr?.id ?? 'unassigned'}
              group={group}
              onSelectRO={setSelectedROId}
              onSelectCSR={setSelectedCsrId}
            />
          ))}
        </Box>
      )}

      <RODetailDrawer roId={selectedROId} onClose={() => setSelectedROId(null)} />

      <CSRDetailDialog
        memberId={selectedCsrId}
        onClose={() => setSelectedCsrId(null)}
      />
    </div>
  )
}
