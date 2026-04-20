import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { repairOrdersApi } from '@/api/repairOrders'
import type { Payment, PaymentEvent } from '@/types/repairOrder'
import { TRANSACTION_TYPES, PAYMENT_STATUSES } from '@/lib/transactionConstants'
import { formatCurrency, formatDate, initials } from '@/lib/utils'
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
import { X, DollarSign, Calendar, User, Car, Hash, Pencil, Trash2, Send, Check, MessageSquarePlus } from 'lucide-react'

interface Props {
  payment: Payment | null
  onClose: () => void
}

const DRAWER_WIDTH = 560

export default function TransactionDetailsModal({ payment, onClose }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── New note ────────────────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState('')

  // ── Inline edit ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  // ── Delete ───────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  // Reset state when payment changes
  useEffect(() => {
    setNoteText('')
    setEditingId(null)
    setEditText('')
    setDeleteTarget(null)
  }, [payment?.id])

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
  const ro         = roData?.ro
  const roCustomer = roData?.customer as { first_name?: string; last_name?: string } | null
  const roVehicle  = roData?.vehicle as { year?: number | null; make?: string | null; model?: string | null; color?: string | null } | null

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['payment_events', payment?.id] })
    qc.invalidateQueries({ queryKey: ['payments', payment?.repair_order_id] })
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

  const txType  = TRANSACTION_TYPES.find(t => t.value === payment.transaction_type)
  const status  = PAYMENT_STATUSES.find(s => s.value === payment.payment_status)
  const dateLabel = payment.date_added ? formatDate(payment.date_added) : formatDate(payment.created_at)
  const employee  = payment.received_by_user
    ? `${payment.received_by_user.first_name} ${payment.received_by_user.last_name}`.trim()
    : null

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
          <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.75 }}>
            Transaction Details
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>
              {formatCurrency(payment.amount)}
            </Typography>
          </Box>

          {/* Badges row */}
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
            {payment.insurance_total != null && payment.insurance_total > 0 && (
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500 }}>
                Ins. DED: <strong>{formatCurrency(payment.insurance_total)}</strong>
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ mt: 0.25 }}>
          <X size={16} />
        </IconButton>
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

        {payment.insurance_total != null && payment.insurance_total > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
            <DollarSign size={13} style={{ opacity: 0.4, marginTop: 2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                Insurance DED
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{formatCurrency(payment.insurance_total)}</Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
          <DollarSign size={13} style={{ opacity: 0.4, marginTop: 2 }} />
          <Box>
            <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
              Timeline
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {(payment.total_events ?? 0) > 0 ? payment.total_events : '0'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Repair Order details ────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5, py: 1.75,
          borderBottom: '1px solid', borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25 }}>
          Repair Order
        </Typography>

        {roLoading ? (
          <Stack spacing={0.75}>
            <Skeleton variant="text" width="60%" height={18} />
            <Skeleton variant="text" width="80%" height={18} />
          </Stack>
        ) : ro ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>

            {/* Customer */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
              <User size={13} style={{ opacity: 0.4, marginTop: 2, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Customer
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {roCustomer
                    ? `${roCustomer.first_name ?? ''} ${roCustomer.last_name ?? ''}`.trim() || '—'
                    : '—'}
                </Typography>
              </Box>
            </Box>

            {/* Job # */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
              <Hash size={13} style={{ opacity: 0.4, marginTop: 2, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Job #
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {(ro as { job_number?: number | null; ro_number?: string }).job_number
                    ?? (ro as { job_number?: number | null; ro_number?: string }).ro_number
                    ?? '—'}
                </Typography>
              </Box>
            </Box>

            {/* Vehicle */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
              <Car size={13} style={{ opacity: 0.4, marginTop: 2, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Vehicle
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {roVehicle
                    ? [roVehicle.year, roVehicle.make, roVehicle.model].filter(Boolean).join(' ') || '—'
                    : '—'}
                </Typography>
                {roVehicle?.color && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{roVehicle.color}</Typography>
                )}
              </Box>
            </Box>

            {/* RO Created */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
              <Calendar size={13} style={{ opacity: 0.4, marginTop: 2, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  RO Created
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {formatDate((ro as { created_at: string }).created_at)}
                </Typography>
              </Box>
            </Box>

          </Box>
        ) : null}
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
                Add a note below to get started.
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
                    <Avatar
                      sx={{
                        width: 30, height: 30,
                        fontSize: '0.65rem', fontWeight: 700,
                        bgcolor: 'primary.main', flexShrink: 0, mt: 0.125,
                      }}
                    >
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
                            size="small"
                            fullWidth
                            multiline
                            maxRows={6}
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(ev.id) }
                              if (e.key === 'Escape') cancelEdit()
                            }}
                          />
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Save">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => submitEdit(ev.id)}
                                disabled={!editText.trim() || updateMut.isPending}
                              >
                                {updateMut.isPending ? <CircularProgress size={14} /> : <Check size={14} />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={cancelEdit}>
                                <X size={14} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.primary', lineHeight: 1.55 }}
                        >
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
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => { setDeleteTarget(ev.id); deleteMut.mutate(ev.id) }}
                            disabled={isDeleting}
                            sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                          >
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

      {/* ── Add note input (sticky bottom) ───────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5, py: 2,
          borderTop: '1px solid', borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            inputRef={inputRef}
            size="small"
            fullWidth
            multiline
            maxRows={4}
            placeholder="Add an internal note… (Enter to send)"
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
              borderRadius: 1.5,
              width: 36, height: 36,
            }}
          >
            {createMut.isPending ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  )
}
