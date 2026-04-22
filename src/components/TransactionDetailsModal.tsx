import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { repairOrdersApi } from '@/api/repairOrders'
import type { Payment, PaymentEvent } from '@/types/repairOrder'
import type { Customer } from '@/types/customer'
import type { Vehicle } from '@/types/vehicle'
import { TRANSACTION_TYPES, PAYMENT_STATUSES } from '@/lib/transactionConstants'
import { formatCurrency, formatDate, formatDateTime, initials } from '@/lib/utils'
import RecordHistory from '@/components/RecordHistory'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import { X, DollarSign, Calendar, User, Car, Hash, Pencil, Trash2, Send, Check, MessageSquarePlus, History, Edit } from 'lucide-react'

const CustomerDetailDialog = lazy(() => import('@/views/customers-view/components/CustomerDetailDialog'))
const VehicleDetailDialog  = lazy(() => import('@/views/customers-view/components/VehicleDetailDialog'))
const RODetailDrawer       = lazy(() => import('@/views/customer-view/components/RODetailDrawer'))

interface Props {
  payment: Payment | null
  onClose: () => void
  onEdit?: (payment: Payment) => void
  onDelete?: (payment: Payment) => void
}

const DRAWER_WIDTH = 580

export default function TransactionDetailsModal({ payment, onClose, onEdit, onDelete }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [noteText, setNoteText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [roOpen, setRoOpen] = useState(false)

  useEffect(() => {
    setNoteText('')
    setEditingId(null)
    setEditText('')
    setDeleteTarget(null)
    setHistoryOpen(false)
  }, [payment?.id])

  // Re-fetch payments list to get enriched data (received_by_user join)
  const { data: enrichedPayment } = useQuery({
    queryKey: ['payments', payment?.repair_order_id],
    queryFn: () => repairOrdersApi.listPayments(payment!.repair_order_id),
    select: (list) => list.find(p => p.id === payment!.id) ?? null,
    enabled: Boolean(payment),
    staleTime: 30_000,
  })

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['payment_events', payment?.id],
    queryFn: () => repairOrdersApi.listPaymentEvents(payment!.id),
    enabled: Boolean(payment),
  })

  const { data: roData, isLoading: roLoading } = useQuery({
    queryKey: ['repair_order_detail', payment?.repair_order_id],
    queryFn: () => repairOrdersApi.get(payment!.repair_order_id),
    enabled: Boolean(payment?.repair_order_id),
    staleTime: 60_000,
  })

  const { data: txHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['repair_order_activity', payment?.repair_order_id],
    queryFn: () => repairOrdersApi.activity(payment!.repair_order_id),
    enabled: Boolean(payment) && historyOpen,
    staleTime: 60_000,
  })

  const ro         = roData?.ro as { id: number; job_number?: number | null; ro_number?: string; created_at: string } | null
  const roCustomer = roData?.customer as Customer | null
  const roVehicle  = roData?.vehicle as Vehicle | null

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['payment_events', payment?.id] })
    qc.invalidateQueries({ queryKey: ['payments', payment?.repair_order_id] })
    qc.invalidateQueries({ queryKey: ['repair_order_activity', payment?.repair_order_id] })
    qc.invalidateQueries({ queryKey: ['repair_order_activity_page', payment?.repair_order_id] })
    qc.invalidateQueries({ queryKey: ['transactions_all'] })
    qc.invalidateQueries({ queryKey: ['customer_transactions'] })
  }

  const createMut = useMutation({
    mutationFn: repairOrdersApi.createPaymentEvent,
    onSuccess: () => { invalidate(); setNoteText('') },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      repairOrdersApi.updatePaymentEvent(id, notes),
    onSuccess: () => { invalidate(); setEditingId(null); setEditText('') },
  })

  const deleteMut = useMutation({
    mutationFn: repairOrdersApi.deletePaymentEvent,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  if (!payment) return null

  const p       = enrichedPayment ?? payment
  const txType  = TRANSACTION_TYPES.find(t => t.value === p.transaction_type)
  const status  = PAYMENT_STATUSES.find(s => s.value === p.payment_status)
  const dateLabel = formatDateTime(p.date_added ?? p.created_at)
  const employee  = p.received_by_user
    ? `${p.received_by_user.first_name} ${p.received_by_user.last_name}`.trim()
    : null

  const customerName = roCustomer
    ? `${roCustomer.first_name ?? ''} ${roCustomer.last_name ?? ''}`.trim() || '—'
    : '—'
  const vehicleLabel = roVehicle
    ? [roVehicle.year, roVehicle.make, roVehicle.model].filter(Boolean).join(' ') || '—'
    : '—'

  // Audit log entries for this payment's field changes only
  const paymentAuditEntries = (txHistory as Array<{ entity_type: string; entity_id?: number | null } & Record<string, unknown>>)
    .filter(e => e.entity_type === 'payments' && e.entity_id === payment.id)

  // Convert PaymentEvents → AuditEntry shape for the history timeline.
  // Use a Set of IDs already covered by the audit log to avoid duplicates
  // for events created after the backend audit logging was added.
  const auditedEventIds = new Set(
    (txHistory as Array<{ entity_type: string; entity_id?: number | null }>)
      .filter(e => e.entity_type === 'payment_events')
      .map(e => e.entity_id)
  )
  const eventAuditEntries = (events as PaymentEvent[])
    .filter(ev => !auditedEventIds.has(ev.id))
    .map(ev => ({
      id: ev.id,
      created_at: ev.created_at,
      action_type: 'create' as const,
      entity_type: 'payment_events',
      entity_id: ev.id,
      entity_name: ev.notes ?? null,
      description: ev.notes ?? null,
      old_values: null,
      new_values: null,
      metadata: { payment_id: payment.id },
      user: ev.user ?? null,
    }))

  // Audit log entries for payment_events (created after backend logging was added)
  const auditedEventEntries = (txHistory as Array<{ entity_type: string; entity_id?: number | null } & Record<string, unknown>>)
    .filter(e => e.entity_type === 'payment_events')

  const paymentHistory = [...paymentAuditEntries, ...eventAuditEntries, ...auditedEventEntries]

  function handleAddNote() {
    const trimmed = noteText.trim()
    if (!trimmed || createMut.isPending) return
    createMut.mutate({ payment_id: payment!.id, notes: trimmed })
  }

  function startEdit(ev: PaymentEvent) {
    setEditingId(ev.id)
    setEditText(ev.notes ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  function submitEdit(id: number) {
    const trimmed = editText.trim()
    if (!trimmed || updateMut.isPending) return
    updateMut.mutate({ id, notes: trimmed })
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={Boolean(payment)}
        onClose={onClose}
        sx={{ zIndex: 1400 }}
        PaperProps={{
          sx: {
            width: DRAWER_WIDTH,
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <Box
          sx={{
            px: 2.5, py: 2,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            borderBottom: '1px solid', borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              Transaction Details
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 0.75, fontWeight: 500 }}>
              Transaction #{payment.id}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>
                {formatCurrency(p.amount)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              {status && (
                <Chip
                  label={status.label}
                  size="small"
                  sx={{ bgcolor: `${status.color}22`, color: status.color, fontWeight: 700, fontSize: '0.7rem', height: 22 }}
                />
              )}
              {txType && (
                <Box component="span" sx={{
                  display: 'inline-block', px: 1.25, py: 0.2, borderRadius: 5,
                  fontSize: '0.72rem', fontWeight: 700,
                  bgcolor: `${txType.color}22`, color: txType.color,
                  whiteSpace: 'nowrap',
                }}>
                  {txType.label}
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
            <Tooltip title="Edit History">
              <IconButton size="small" onClick={() => setHistoryOpen(true)}>
                <History size={16} />
              </IconButton>
            </Tooltip>
            {onEdit && (
              <Tooltip title="Edit Transaction">
                <IconButton size="small" onClick={() => onEdit(p)}>
                  <Edit size={16} />
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title="Delete Transaction">
                <IconButton size="small" color="error" onClick={() => { onDelete(p); onClose() }}>
                  <Trash2 size={16} />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </Box>
        </Box>

        {/* ── Meta grid ───────────────────────────────────────────────────────── */}
        <Box
          sx={{
            px: 2.5, py: 1.75,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 2,
            borderBottom: '1px solid', borderColor: 'divider',
            flexShrink: 0,
            bgcolor: 'grey.50',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
            <Calendar size={13} style={{ opacity: 0.4, marginTop: 2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                Date Added
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{dateLabel}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
            <User size={13} style={{ opacity: 0.4, marginTop: 2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                Added By
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                {employee ?? '—'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
            <Hash size={13} style={{ opacity: 0.4, marginTop: 2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                Transaction ID
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>#{payment.id}</Typography>
            </Box>
          </Box>

          {txType && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
              <DollarSign size={13} style={{ opacity: 0.4, marginTop: 2 }} />
              <Box>
                <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Type
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{txType.label}</Typography>
              </Box>
            </Box>
          )}

          {p.insurance_total != null && p.insurance_total > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
              <DollarSign size={13} style={{ opacity: 0.4, marginTop: 2 }} />
              <Box>
                <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Insurance DED
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{formatCurrency(p.insurance_total)}</Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Customer / Vehicle / RO card ─────────────────────────────────────── */}
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          {roLoading ? (
            <Stack spacing={0.75}>
              <Skeleton variant="text" width="60%" height={18} />
              <Skeleton variant="text" width="80%" height={18} />
            </Stack>
          ) : (
            <>
              {/* Customer + Vehicle row */}
              <Box sx={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                border: '1px solid', borderColor: 'divider', borderRadius: 2,
                overflow: 'hidden', mb: 1.25,
              }}>
                {/* Customer */}
                <Box
                  onClick={() => roCustomer && setCustomerOpen(true)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.75, py: 1.25,
                    borderRight: '1px solid', borderColor: 'divider',
                    cursor: roCustomer ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                    '&:hover': roCustomer ? { bgcolor: 'action.hover' } : {},
                  }}
                >
                  <Box sx={{
                    width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
                    bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <User size={15} color="white" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Customer
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }} noWrap>
                      {customerName}
                    </Typography>
                    {roCustomer?.phone && (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                        {roCustomer.phone}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Vehicle */}
                <Box
                  onClick={() => roVehicle && setVehicleOpen(true)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.75, py: 1.25,
                    cursor: roVehicle ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                    '&:hover': roVehicle ? { bgcolor: 'action.hover' } : {},
                  }}
                >
                  <Box sx={{
                    width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
                    bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Car size={15} color="white" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Vehicle
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }} noWrap>
                      {vehicleLabel}
                    </Typography>
                    {roVehicle?.color && (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{roVehicle.color}</Typography>
                    )}
                  </Box>
                </Box>
              </Box>

              {/* RO row */}
              {ro && (
                <Box
                  onClick={() => setRoOpen(true)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1.75, py: 1,
                    border: '1px solid', borderColor: 'divider', borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Hash size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                  <Box sx={{ display: 'flex', gap: 2, flex: 1, minWidth: 0 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Repair Order
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'primary.main' }}>
                        {ro.job_number != null ? `Job #${ro.job_number}` : ro.ro_number ?? '—'}
                        {ro.job_number != null && ro.ro_number && (
                          <Typography component="span" sx={{ ml: 1, fontSize: '0.72rem', color: 'text.secondary', fontWeight: 400 }}>
                            {ro.ro_number}
                          </Typography>
                        )}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Created
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {formatDate(ro.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'primary.main', fontWeight: 600, flexShrink: 0 }}>
                    View →
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* ── Events section (scrollable) ──────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageSquarePlus size={15} style={{ opacity: 0.5 }} />
            <Typography variant="subtitle2" fontWeight={700}>
              Events
              {(events as PaymentEvent[]).length > 0 && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: '0.72rem', color: 'text.disabled', fontWeight: 500 }}>
                  {(events as PaymentEvent[]).length}
                </Typography>
              )}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, px: 2.5, pb: 2 }}>
            {eventsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={22} />
              </Box>
            ) : (events as PaymentEvent[]).length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <MessageSquarePlus size={28} style={{ opacity: 0.15, marginBottom: 8 }} />
                <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem' }}>No events yet.</Typography>
                <Typography sx={{ color: 'text.disabled', fontSize: '0.78rem', mt: 0.5 }}>
                  Add an event below to get started.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={0} divider={<Divider />}>
                {(events as PaymentEvent[]).map((ev) => {
                  const authorName = ev.user
                    ? `${ev.user.first_name} ${ev.user.last_name}`.trim()
                    : ev.user_id
                    ? `User #${ev.user_id}`
                    : 'Unknown'
                  const authorInitials = ev.user
                    ? initials(ev.user.first_name, ev.user.last_name)
                    : ev.user_id
                    ? String(ev.user_id).slice(0, 2)
                    : '?'
                  const isEditing = editingId === ev.id
                  const isDeleting = deleteMut.isPending && deleteTarget === ev.id

                  return (
                    <Box key={ev.id} sx={{ py: 1.75, display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                      <Avatar sx={{ width: 30, height: 30, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'primary.main', flexShrink: 0, mt: 0.125 }}>
                        {authorInitials}
                      </Avatar>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{authorName}</Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                            {formatDate(ev.created_at)}
                          </Typography>
                        </Box>

                        {isEditing ? (
                          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
                            <TextField
                              size="small" fullWidth multiline maxRows={6} autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(ev.id) }
                                if (e.key === 'Escape') cancelEdit()
                              }}
                            />
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="Save">
                                <IconButton size="small" color="primary" onClick={() => submitEdit(ev.id)} disabled={!editText.trim() || updateMut.isPending}>
                                  {updateMut.isPending ? <CircularProgress size={14} /> : <Check size={14} />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel">
                                <IconButton size="small" onClick={cancelEdit}><X size={14} /></IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.primary', lineHeight: 1.55 }}>
                            {ev.notes}
                          </Typography>
                        )}
                      </Box>

                      {!isEditing && (
                        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0, mt: 0.125 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => startEdit(ev)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                              <Pencil size={13} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => { setDeleteTarget(ev.id); deleteMut.mutate(ev.id) }} disabled={isDeleting} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                              {isDeleting ? <CircularProgress size={13} color="inherit" /> : <Trash2 size={13} />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </Box>
                  )
                })}
              </Stack>
            )}
          </Box>
        </Box>

        {/* ── Add note input ───────────────────────────────────────────────────── */}
        <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              inputRef={inputRef}
              size="small" fullWidth multiline maxRows={4}
              placeholder="Add an event… (Enter to send)"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote() }
              }}
            />
            <IconButton
              color="primary"
              onClick={handleAddNote}
              disabled={!noteText.trim() || createMut.isPending}
              sx={{
                flexShrink: 0,
                bgcolor: noteText.trim() ? 'primary.main' : 'action.disabledBackground',
                color: noteText.trim() ? '#fff' : 'action.disabled',
                '&:hover': { bgcolor: noteText.trim() ? 'primary.dark' : undefined },
                borderRadius: 1.5, width: 36, height: 36,
              }}
            >
              {createMut.isPending ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
            </IconButton>
          </Box>
        </Box>
      </Drawer>

      {/* ── Edit History Modal ──────────────────────────────────────────────── */}
      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        fullWidth maxWidth="sm"
        PaperProps={{ sx: { maxHeight: '85vh', borderRadius: 3 } }}
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Transaction Edit History</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Transaction #{payment.id}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setHistoryOpen(false)}><X size={16} /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : paymentHistory.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <History size={28} style={{ opacity: 0.15, marginBottom: 8 }} />
              <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>No edit history yet.</Typography>
            </Box>
          ) : (
            <RecordHistory entries={paymentHistory as Parameters<typeof RecordHistory>[0]['entries']} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Customer Detail ─────────────────────────────────────────────────── */}
      {customerOpen && roCustomer && (
        <Suspense fallback={null}>
          <CustomerDetailDialog
            customer={roCustomer}
            onClose={() => setCustomerOpen(false)}
            onEdit={() => setCustomerOpen(false)}
            onNewRO={() => setCustomerOpen(false)}
            zIndex={1500}
          />
        </Suspense>
      )}

      {/* ── Vehicle Detail ──────────────────────────────────────────────────── */}
      {vehicleOpen && roVehicle && (
        <Suspense fallback={null}>
          <VehicleDetailDialog
            vehicle={roVehicle}
            onClose={() => setVehicleOpen(false)}
            onEdit={() => setVehicleOpen(false)}
            onDelete={() => setVehicleOpen(false)}
            onNewRO={() => setVehicleOpen(false)}
            zIndex={1500}
          />
        </Suspense>
      )}

      {/* ── RO Detail Drawer ────────────────────────────────────────────────── */}
      {roOpen && ro && (
        <Suspense fallback={null}>
          <RODetailDrawer
            roId={ro.id}
            onClose={() => setRoOpen(false)}
            zIndex={1500}
          />
        </Suspense>
      )}
    </>
  )
}
