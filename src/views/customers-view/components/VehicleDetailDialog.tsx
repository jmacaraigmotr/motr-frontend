import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'
import { repairOrdersApi } from '@/api/repairOrders'
import type { Vehicle } from '@/types/vehicle'
import type { CustomerDocument } from '@/types/document'
import type { RepairOrderListItem } from '@/types/repairOrder'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS, JOB_TYPE_LABELS } from '@/types/repairOrder'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import { X, Pencil, Plus, Car, FileText, ExternalLink, Shield, Gauge, CreditCard, ClipboardList } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  registration:   'Registration',
  insurance_card: 'Insurance Card',
  other:          'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  registration:   'rgba(59,130,246,0.08)',
  insurance_card: 'rgba(16,185,129,0.08)',
  other:          'rgba(107,114,128,0.08)',
}

const CATEGORY_BORDER: Record<string, string> = {
  registration:   'rgba(59,130,246,0.22)',
  insurance_card: 'rgba(16,185,129,0.22)',
  other:          'rgba(107,114,128,0.18)',
}

function Field({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (!value && value !== 0) return null
  return (
    <Box>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: mono ? 'monospace' : undefined, letterSpacing: mono ? '0.04em' : undefined }}>
        {value}
      </Typography>
    </Box>
  )
}

// ── Details Tab ───────────────────────────────────────────────────────────────

function DetailsTab({ v }: { v: Vehicle }) {
  const plateDisplay = [v.license_plate, v.license_state].filter(Boolean).join(' · ')
  const hasInsurance = !!v.insurance_company || !!v.insurance_policy_number

  return (
    <Stack spacing={2.5}>
      {/* Identity */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Field label="Color" value={v.color} />
        <Field label="License Plate" value={plateDisplay || null} />
        <Field label="Mileage In" value={v.mileage_in != null ? `${v.mileage_in.toLocaleString()} mi` : null} />
      </Box>

      {v.vin && (
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CreditCard size={15} style={{ opacity: 0.4, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled' }}>VIN</Typography>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{v.vin}</Typography>
          </Box>
        </Box>
      )}

      {hasInsurance && (
        <Box sx={{ p: 2, bgcolor: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Shield size={13} style={{ color: '#10b981' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981' }}>
              Insurance
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label="Company" value={v.insurance_company} />
            <Field label="Policy #" value={v.insurance_policy_number} mono />
          </Box>
        </Box>
      )}

      <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
        Added {formatDate(v.created_at)}
      </Typography>
    </Stack>
  )
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ vehicleId }: { vehicleId: number }) {
  const qc = useQueryClient()

  const { data: documents = [], isLoading } = useQuery<CustomerDocument[]>({
    queryKey: ['vehicle_documents', vehicleId],
    queryFn: () => documentsApi.list('vehicle', vehicleId),
    staleTime: 30_000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicle_documents', vehicleId] }),
  })

  if (isLoading) return (
    <Stack spacing={1}>
      {[1, 2].map(i => <Skeleton key={i} height={100} variant="rounded" />)}
    </Stack>
  )

  if (documents.length === 0) return (
    <Box sx={{ py: 5, textAlign: 'center', borderRadius: 2, border: '1.5px dashed', borderColor: 'divider' }}>
      <FileText size={26} style={{ opacity: 0.18, marginBottom: 8 }} />
      <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem' }}>No documents on file for this vehicle.</Typography>
    </Box>
  )

  // Group by category
  const byCategory = documents.reduce<Record<string, CustomerDocument[]>>((acc, doc) => {
    const key = doc.category ?? 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  return (
    <Stack spacing={2.5}>
      {Object.entries(byCategory).map(([category, docs]) => (
        <Box key={category}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
              {CATEGORY_LABELS[category] ?? 'Other'}
            </Typography>
            <Chip label={docs.length} size="small" sx={{ height: 16, fontSize: '0.65rem' }} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1 }}>
            {docs.map(doc => {
              const fileUrl = doc.file?.url ?? null
              const isImage = doc.file?.type === 'image'
              return (
                <Box
                  key={doc.id}
                  sx={{
                    position: 'relative', borderRadius: 2, overflow: 'hidden',
                    border: '1px solid', borderColor: CATEGORY_BORDER[category] ?? 'divider',
                    bgcolor: CATEGORY_COLORS[category] ?? 'action.hover',
                    aspectRatio: '16/10',
                    '&:hover .doc-overlay': { opacity: 1 },
                  }}
                >
                  {isImage && fileUrl
                    ? <Box component="img" src={fileUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={26} style={{ opacity: 0.25 }} /></Box>
                  }
                  <Box className="doc-overlay" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, opacity: 0, transition: 'opacity 0.15s' }}>
                    {fileUrl && (
                      <Tooltip title="Open">
                        <IconButton size="small" component="a" href={fileUrl} target="_blank" rel="noopener noreferrer"
                          sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' } }}>
                          <ExternalLink size={13} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton size="small" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(doc.id)}
                        sx={{ bgcolor: 'rgba(239,68,68,0.3)', color: '#fff', '&:hover': { bgcolor: 'rgba(239,68,68,0.55)' } }}>
                        <X size={13} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {doc.file?.name && (
                    <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 1, py: 0.4, bgcolor: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(2px)' }}>
                      <Typography sx={{ fontSize: '0.62rem', color: '#fff', opacity: 0.85 }} noWrap>{doc.file.name}</Typography>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  )
}

// ── Repair Orders Tab ─────────────────────────────────────────────────────────

function ROCard({ ro, onSelectRO }: { ro: RepairOrderListItem; onSelectRO?: (id: number) => void }) {
  return (
    <Box
      onClick={() => onSelectRO?.(ro.id)}
      sx={{
        p: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: 2,
        display: 'flex', alignItems: 'center', gap: 1.5,
        cursor: onSelectRO ? 'pointer' : 'default',
        '&:hover': onSelectRO ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
            {ro.ro_number}
            {ro.job_number ? ` · #${ro.job_number}` : ''}
          </Typography>
          <Chip
            label={JOB_STATUS_LABELS[ro.job_status ?? 'open']}
            color={JOB_STATUS_COLORS[ro.job_status ?? 'open']}
            size="small"
            sx={{ height: 18, fontSize: '0.65rem' }}
          />
        </Box>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
          {ro.job_type ? (JOB_TYPE_LABELS[ro.job_type] ?? ro.job_type) : 'N/A'}
          {ro.arrived_at ? ` · Arrived ${formatDate(ro.arrived_at)}` : ro.created_at ? ` · Created ${formatDate(ro.created_at)}` : ''}
        </Typography>
      </Box>
      {(ro.estimated_total != null || (ro.job_total ?? []).length > 0) && (
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.secondary', flexShrink: 0 }}>
          {formatCurrency((ro.job_total ?? []).reduce((s, p) => s + p.amount, 0) || (ro.estimated_total ?? 0))}
        </Typography>
      )}
    </Box>
  )
}

function RepairOrdersTab({ vehicleId, customerId, onSelectRO }: { vehicleId: number; customerId: number; onSelectRO?: (id: number) => void }) {
  const { data: vehicleData, isLoading } = useQuery({
    queryKey: ['vehicle_ros', vehicleId],
    queryFn: () => repairOrdersApi.list({ vehicle_id: vehicleId, per_page: 50 }),
    staleTime: 30_000,
  })

  const vehicleRos: RepairOrderListItem[] = vehicleData?.data ?? []

  const { data: customerData } = useQuery({
    queryKey: ['customer_unlinked_ros', customerId],
    queryFn: () => repairOrdersApi.list({ customer_id: customerId, per_page: 50 }),
    staleTime: 30_000,
    enabled: !isLoading && vehicleRos.length === 0,
  })

  const unlinkedRos: RepairOrderListItem[] = (customerData?.data ?? []).filter(ro => !ro.vehicle_id)

  if (isLoading) return (
    <Stack spacing={1}>
      {[1, 2, 3].map(i => <Skeleton key={i} height={64} variant="rounded" />)}
    </Stack>
  )

  if (vehicleRos.length === 0 && unlinkedRos.length === 0) return (
    <Box sx={{ py: 5, textAlign: 'center', borderRadius: 2, border: '1.5px dashed', borderColor: 'divider' }}>
      <ClipboardList size={26} style={{ opacity: 0.18, marginBottom: 8 }} />
      <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem' }}>No repair orders for this vehicle.</Typography>
    </Box>
  )

  return (
    <Stack spacing={2}>
      {vehicleRos.length > 0 && (
        <Stack spacing={1}>
          {vehicleRos.map(ro => <ROCard key={ro.id} ro={ro} onSelectRO={onSelectRO} />)}
        </Stack>
      )}

      {unlinkedRos.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled' }}>
              Not linked to a vehicle
            </Typography>
            <Chip label={unlinkedRos.length} size="small" sx={{ height: 16, fontSize: '0.65rem' }} />
          </Box>
          <Stack spacing={1}>
            {unlinkedRos.map(ro => <ROCard key={ro.id} ro={ro} onSelectRO={onSelectRO} />)}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  vehicle: Vehicle
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onNewRO: () => void
  onSelectRO?: (id: number) => void
}

export default function VehicleDetailDialog({ vehicle: v, onClose, onEdit, onDelete, onNewRO, onSelectRO }: Props) {
  const [tab, setTab] = useState(0)

  const vehicleTitle = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'
  const plateDisplay = [v.license_plate, v.license_state].filter(Boolean).join(' · ')

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose} PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box sx={{ px: 3, pt: 3, pb: 2.5, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
        >
          <X size={17} />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 2.5, display: 'flex', color: 'text.secondary' }}>
            <Car size={20} />
          </Box>
          <Box>
            <Typography fontWeight={800} fontSize="1.1rem" lineHeight={1.2}>{vehicleTitle}</Typography>
            <Typography fontSize="0.82rem" color="text.secondary" sx={{ mt: 0.25 }}>
              {[v.vin ? 'VIN' : null, v.color, plateDisplay].filter(Boolean).join(' · ') || 'Vehicle details'}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {v.color && (
            <Box sx={{ px: 1.25, py: 0.4, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary' }}>
              {v.color}
            </Box>
          )}
          {plateDisplay && (
            <Box sx={{ px: 1.25, py: 0.4, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {plateDisplay}
            </Box>
          )}
          {v.mileage_in != null && (
            <Box sx={{ px: 1.25, py: 0.4, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Gauge size={12} />{v.mileage_in.toLocaleString()} mi
            </Box>
          )}
        </Stack>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 38,
            '& .MuiTab-root': { color: 'text.secondary', minHeight: 38, fontSize: '0.8rem', fontWeight: 600, textTransform: 'none', py: 0 },
            '& .Mui-selected': { color: 'text.primary' },
            '& .MuiTabs-indicator': { bgcolor: 'text.primary', height: 2.5, borderRadius: '2px 2px 0 0' },
          }}
        >
          <Tab icon={<Car size={13} />} iconPosition="start" label="Details" />
          <Tab icon={<ClipboardList size={13} />} iconPosition="start" label="Repair Orders" />
        </Tabs>
      </Box>

      <DialogContent sx={{ pt: 2.5, pb: 3 }}>
        {tab === 0 && (
          <Stack spacing={3}>
            <DetailsTab v={v} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mb: 1.5 }}>
                Documents
              </Typography>
              <DocumentsTab vehicleId={v.id} />
            </Box>
          </Stack>
        )}
        {tab === 1 && <RepairOrdersTab vehicleId={v.id} customerId={v.customer_id} onSelectRO={onSelectRO} />}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
        <Button onClick={onEdit} variant="outlined" size="small" startIcon={<Pencil size={13} />} sx={{ fontSize: '0.78rem' }}>
          Edit
        </Button>
        <Button onClick={onNewRO} variant="contained" size="small" startIcon={<Plus size={13} />} sx={{ fontSize: '0.78rem' }}>
          New RO
        </Button>
      </DialogActions>
    </Dialog>
  )
}
