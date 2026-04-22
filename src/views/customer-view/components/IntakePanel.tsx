import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { intakesApi } from '@/api/intakes'
import { documentsApi } from '@/api/documents'
import type { CreateIntakeInput, UpdateIntakeInput } from '@/api/intakes'
import type { Intake, JobType } from '@/types/repairOrder'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import type { CustomerDocument } from '@/types/document'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import { Save, Edit, Trash2, X, Upload, Camera, FileText, User, Car, ClipboardList, ChevronDown, Truck, Navigation, Layers, Sparkles, FileSearch, Receipt } from 'lucide-react'

interface ROSummary {
  jobNumber?: number | null
  roNumber?: string
  customerName?: string | null
  vehicleLabel?: string | null
  jobType?: string | null
}

interface Props {
  roId: number
  jobType?: JobType | null
  dealerClaimType?: string | null
  roSummary?: ROSummary
}

// ─── Field visibility config ──────────────────────────────────────────────────

type FieldConfig = {
  wrap: boolean
  ceramic: boolean
  howAccident: boolean
  pointOfImpact: boolean
  dateOfLoss: boolean
  upd: boolean
  customerRequests: boolean
  damageDescription: boolean
  policeReport: boolean
  policeReportUpload: boolean
  intakePhotos: boolean
  priorEstimate: boolean
}

// Dealer claim types that involve physical damage / insurance (get full insurance-like fields)
const DEALER_INSURANCE_CLAIM_TYPES = ['Lot', 'Used']

const INSURANCE_CONFIG: FieldConfig = {
  wrap: true, ceramic: true, howAccident: true, pointOfImpact: true,
  dateOfLoss: true, upd: true, customerRequests: true, damageDescription: false,
  policeReport: true, policeReportUpload: true, intakePhotos: true, priorEstimate: false,
}

// Dealer base — fields shown for ALL dealer claim types
const DEALER_BASE_CONFIG: FieldConfig = {
  wrap: true, ceramic: true, howAccident: false, pointOfImpact: true,
  dateOfLoss: false, upd: true, customerRequests: true, damageDescription: false,
  policeReport: false, policeReportUpload: false, intakePhotos: true, priorEstimate: false,
}

// Dealer with insurance-related claim type (Lot / Used) — adds insurance fields
const DEALER_INSURANCE_CONFIG: FieldConfig = {
  wrap: true, ceramic: true, howAccident: true, pointOfImpact: true,
  dateOfLoss: true, upd: true, customerRequests: true, damageDescription: false,
  policeReport: true, policeReportUpload: true, intakePhotos: true, priorEstimate: true,
}

const FIELD_CONFIGS: Partial<Record<JobType | 'default', FieldConfig>> = {
  insurance: INSURANCE_CONFIG,
  self_pay: {
    wrap: true, ceramic: true, howAccident: false, pointOfImpact: true,
    dateOfLoss: false, upd: true, customerRequests: true, damageDescription: true,
    policeReport: true, policeReportUpload: true, intakePhotos: true, priorEstimate: false,
  },
  fleet: {
    wrap: true, ceramic: true, howAccident: false, pointOfImpact: true,
    dateOfLoss: false, upd: true, customerRequests: true, damageDescription: true,
    policeReport: true, policeReportUpload: true, intakePhotos: true, priorEstimate: false,
  },
  redo: {
    wrap: false, ceramic: false, howAccident: false, pointOfImpact: false,
    dateOfLoss: false, upd: true, customerRequests: true, damageDescription: false,
    policeReport: false, policeReportUpload: false, intakePhotos: true, priorEstimate: false,
  },
  police_tow: {
    wrap: false, ceramic: false, howAccident: false, pointOfImpact: false,
    dateOfLoss: false, upd: false, customerRequests: false, damageDescription: false,
    policeReport: true, policeReportUpload: true, intakePhotos: true, priorEstimate: false,
  },
  default: {
    wrap: true, ceramic: true, howAccident: false, pointOfImpact: false,
    dateOfLoss: false, upd: true, customerRequests: true, damageDescription: false,
    policeReport: false, policeReportUpload: false, intakePhotos: true, priorEstimate: false,
  },
}

function getFields(jobType?: JobType | null, dealerClaimType?: string | null): FieldConfig {
  if (!jobType) return FIELD_CONFIGS.default!
  if (jobType === 'dealer') {
    return dealerClaimType && DEALER_INSURANCE_CLAIM_TYPES.includes(dealerClaimType)
      ? DEALER_INSURANCE_CONFIG
      : DEALER_BASE_CONFIG
  }
  return FIELD_CONFIGS[jobType] ?? FIELD_CONFIGS.default!
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyIntake(roId: number): CreateIntakeInput {
  return {
    repair_order_id: roId,
    is_driveable: true,
    is_towed: false,
    has_wrap: false,
    has_ceramic_coating: false,
    police_report_present: false,
    has_previous_estimate: false,
  }
}

function BoolCell({ label, value, border }: { label: string; value: boolean; border?: boolean }) {
  return (
    <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: border ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: value ? 'success.main' : 'text.disabled' }}>
        {value ? 'Yes' : 'No'}
      </Typography>
    </Box>
  )
}

function TextSection({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{value}</Typography>
    </Box>
  )
}

// ─── File Upload Section (view + upload) ──────────────────────────────────────

function FileSection({
  label,
  docs,
  uploading,
  onUpload,
  onDelete,
  icon,
}: {
  label: string
  docs: CustomerDocument[]
  uploading: boolean
  onUpload: (file: File) => void
  onDelete: (id: number) => void
  icon: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={12} /> : <Upload size={12} />}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          sx={{ ml: 'auto', fontSize: '0.72rem', py: 0.3, px: 1, minWidth: 0 }}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            files.forEach(file => onUpload(file))
            e.target.value = ''
          }}
        />
      </Box>
      {docs.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, px: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, color: 'text.disabled' }}>
          {icon}
          <Typography variant="caption">No files uploaded yet</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {docs.map(doc => {
            const isImage = doc.file?.mime?.startsWith('image/')
            return (
              <Box
                key={doc.id}
                sx={{
                  position: 'relative', borderRadius: 1.5, overflow: 'hidden',
                  border: '1px solid', borderColor: 'divider',
                  '&:hover .delete-btn': { opacity: 1 },
                }}
              >
                {isImage && doc.file?.url ? (
                  <Box
                    component="img"
                    src={doc.file.url}
                    alt={doc.label ?? 'file'}
                    sx={{ width: 80, height: 80, objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                    onClick={() => window.open(doc.file!.url, '_blank')}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 110, height: 80, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 0.5,
                      bgcolor: 'action.hover', cursor: 'pointer', px: 1,
                    }}
                    onClick={() => doc.file?.url && window.open(doc.file.url, '_blank')}
                  >
                    <FileText size={20} style={{ opacity: 0.5, flexShrink: 0 }} />
                    <Typography sx={{
                      fontSize: '0.6rem', color: 'text.disabled', textAlign: 'center',
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-all', lineHeight: 1.3,
                    }}>
                      {doc.file?.name ?? 'File'}
                    </Typography>
                  </Box>
                )}
                <IconButton
                  className="delete-btn"
                  size="small"
                  onClick={() => onDelete(doc.id)}
                  sx={{
                    position: 'absolute', top: 2, right: 2, opacity: 0,
                    bgcolor: 'rgba(0,0,0,0.6)', color: '#fff',
                    transition: 'opacity 0.15s',
                    width: 20, height: 20,
                    '&:hover': { bgcolor: 'error.main' },
                  }}
                >
                  <X size={10} />
                </IconButton>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function IntakePanel({ roId, jobType, dealerClaimType, roSummary }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<CreateIntakeInput | UpdateIntakeInput | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [uploadingPoliceReport, setUploadingPoliceReport] = useState(false)
  const [uploadingIntakePhoto, setUploadingIntakePhoto]   = useState(false)

  const fields = getFields(jobType, dealerClaimType)

  const { data: intakeData, isLoading } = useQuery({
    queryKey: ['intake', roId],
    queryFn: () => intakesApi.getByRO(roId),
  })

  const intake         = intakeData?.intake         ?? null
  const creator        = intakeData?.creator        ?? null
  const deletedIntake  = intakeData?.deleted_intake ?? null

  const { data: docs = [] } = useQuery<CustomerDocument[]>({
    queryKey: ['ro_documents', roId],
    queryFn: () => documentsApi.list('repair_order', roId),
    staleTime: 30_000,
  })

  const policeReportDocs = docs.filter(d => d.label === 'Police Report')
  const intakePhotoDocs  = docs.filter(d => d.label === 'Intake Photo')

  function invalidateIntake() {
    qc.invalidateQueries({ queryKey: ['intake', roId] })
    qc.invalidateQueries({ queryKey: ['repair_order_activity', roId] })
    qc.invalidateQueries({ queryKey: ['repair_order_activity_page', roId] })
  }

  const createMut = useMutation({
    mutationFn: intakesApi.create,
    onSuccess: () => { invalidateIntake(); setEditing(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save intake'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateIntakeInput }) => intakesApi.update(id, data),
    onSuccess: () => { invalidateIntake(); setEditing(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to save intake'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => intakesApi.delete(id),
    onSuccess: () => { invalidateIntake(); setConfirmDelete(false); setApiError(null) },
    onError: (err: { message?: string }) => setApiError(err.message ?? 'Failed to delete'),
  })

  const deleteDocMut = useMutation({
    mutationFn: (id: number) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ro_documents', roId] }),
  })

  async function uploadFile(file: File, label: string, setUploading: (v: boolean) => void) {
    setUploading(true)
    try {
      await documentsApi.upload({ entityType: 'repair_order', entityId: roId, file, category: 'other', label })
      qc.invalidateQueries({ queryKey: ['ro_documents', roId] })
    } finally {
      setUploading(false)
    }
  }

  function startEdit() {
    setForm(intake ? { ...intake } as unknown as UpdateIntakeInput : emptyIntake(roId))
    setEditing(true)
  }

  function handleSave() {
    if (!form) return
    if (intake) updateMut.mutate({ id: intake.id, data: form as UpdateIntakeInput })
    else         createMut.mutate(form as CreateIntakeInput)
  }

  function setField<K extends keyof CreateIntakeInput>(key: K, val: CreateIntakeInput[K]) {
    setForm(prev => prev ? ({ ...prev, [key]: val }) : prev)
  }

  const isPending = createMut.isPending || updateMut.isPending || deleteMut.isPending
  const f = form as CreateIntakeInput | null

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
  }

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
          {intake ? 'Intake Record' : 'No Intake Record Yet'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {intake && (
            <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button size="small" startIcon={<Edit size={14} />} onClick={startEdit}>
            {intake ? 'Edit' : 'Create Intake'}
          </Button>
        </Box>
      </Box>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={confirmDelete} onClose={() => !isPending && setConfirmDelete(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ p: 0.75, bgcolor: 'error.light', borderRadius: 1.5, display: 'flex', color: 'error.main' }}>
              <Trash2 size={16} />
            </Box>
            Delete Intake Record?
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete the intake record. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button fullWidth variant="outlined" onClick={() => setConfirmDelete(false)} disabled={isPending}>Cancel</Button>
          <Button
            fullWidth variant="contained" color="error"
            onClick={() => intake && deleteMut.mutate(intake.id)}
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={12} color="inherit" /> : <Trash2 size={14} />}
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Deleted intake notice (admin only) ── */}
      {!intake && deletedIntake && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          A previous intake record was deleted on{' '}
          <strong>{new Date(deletedIntake.deleted_at!).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>.
          {' '}Only admins can see this notice.
        </Alert>
      )}

      {/* ── View Mode ── */}
      {intake ? (
        <Accordion
          defaultExpanded
          disableGutters
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
        >
          <AccordionSummary
            expandIcon={<ChevronDown size={15} />}
            sx={{ px: 2, minHeight: 0, '& .MuiAccordionSummary-content': { my: 1.25, alignItems: 'center', gap: 1 } }}
          >
            <ClipboardList size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
            <Typography variant="caption" fontWeight={700}>Intake Record</Typography>
            <Box sx={{ flex: 1 }} />
            {creator && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                by {creator.name}
              </Typography>
            )}
            <Typography variant="caption" color="text.disabled">
              {new Date(intake.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
          {/* Bool flags — chip row. Show chip only when true; Driveable always shown since Not Driveable is critical. */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {intake.is_towed && (
              <Chip size="small" label="Towed" icon={<Truck size={12} />} color="warning" variant="filled" />
            )}
            <Chip
              size="small"
              label={intake.is_driveable ? 'Driveable' : 'Not Driveable'}
              icon={<Navigation size={12} />}
              color={intake.is_driveable ? 'success' : 'error'}
              variant="filled"
            />
            {fields.wrap && intake.has_wrap && (
              <Chip size="small" label="Has Wrap" icon={<Layers size={12} />} color="info" variant="filled" />
            )}
            {fields.ceramic && intake.has_ceramic_coating && (
              <Chip size="small" label="Ceramic Coating" icon={<Sparkles size={12} />} color="info" variant="filled" />
            )}
            {fields.policeReport && intake.police_report_present && (
              <Chip size="small" label="Police Report" icon={<FileSearch size={12} />} color="secondary" variant="filled" />
            )}
            {fields.priorEstimate && intake.has_previous_estimate && (
              <Chip size="small" label="Prior Estimate" icon={<Receipt size={12} />} color="secondary" variant="filled" />
            )}
          </Box>

          {/* Mileage row */}
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
            <Box sx={{ display: 'flex' }}>
              <Box sx={{ flex: 1, px: 2, py: 1.25 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Mileage</Typography>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: intake.mileage != null ? 'text.primary' : 'text.disabled' }}>
                  {intake.mileage != null ? intake.mileage.toLocaleString() : '—'}
                </Typography>
              </Box>
              {fields.dateOfLoss && (
                <Box sx={{ flex: 1, px: 2, py: 1.25, borderLeft: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Date of Loss</Typography>
                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: intake.date_of_loss ? 'text.primary' : 'text.disabled' }}>{intake.date_of_loss ?? '—'}</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Text fields — conditional by job type */}
          {fields.howAccident  && <TextSection label="How Accident Happened"  value={intake.how_accident_happened} />}
          {fields.pointOfImpact && <TextSection label="Point of Impact"        value={intake.point_of_impact} />}
          {fields.upd          && <TextSection label="Prior Unrelated Damage (UPD)" value={intake.prior_unrelated_damage} />}
          {fields.customerRequests && <TextSection label="Customer Requests"   value={intake.customer_requests} />}
          {fields.damageDescription && <TextSection label="Damage Description" value={intake.damage_description} />}
          <TextSection label="Other Notes" value={intake.notes} />

          {/* File uploads — inline even in view mode */}
          {fields.policeReportUpload && intake.police_report_present && (
            <FileSection
              label="Police Report File"
              docs={policeReportDocs}
              uploading={uploadingPoliceReport}
              onUpload={file => uploadFile(file, 'Police Report', setUploadingPoliceReport)}
              onDelete={id => deleteDocMut.mutate(id)}
              icon={<FileText size={16} />}
            />
          )}
          {fields.intakePhotos && (
            <FileSection
              label="Intake Photos"
              docs={intakePhotoDocs}
              uploading={uploadingIntakePhoto}
              onUpload={file => uploadFile(file, 'Intake Photo', setUploadingIntakePhoto)}
              onDelete={id => deleteDocMut.mutate(id)}
              icon={<Camera size={16} />}
            />
          )}

          {/* Created at / Created by metadata */}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Created At</Typography>
              <Typography variant="caption" fontWeight={600}>
                {new Date(intake.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>Created By</Typography>
              <Typography variant="caption" fontWeight={600}>{creator?.name ?? '—'}</Typography>
            </Box>
          </Box>
          </AccordionDetails>
        </Accordion>
      ) : (
        <Box>
          <Typography variant="body2" color="text.disabled">
            No intake record yet. Create one to capture vehicle condition at arrival.
          </Typography>
        </Box>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog
        open={editing}
        onClose={() => { if (!isPending) { setEditing(false); setApiError(null) } }}
        fullWidth maxWidth="md"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ p: 0.75, bgcolor: 'primary.main', borderRadius: 1.5, display: 'flex', color: '#fff' }}>
              <ClipboardList size={16} />
            </Box>
            <Typography component="div" fontWeight={800} fontSize="1.1rem">
              {intake ? 'Edit Intake' : 'Create Intake'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => { if (!isPending) { setEditing(false); setApiError(null) } }} disabled={isPending}>
            <X size={16} />
          </IconButton>
        </DialogTitle>

        {f && (
          <>
            <DialogContent dividers>
              {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}

              {/* ── RO Summary Banner ── */}
              {roSummary && (
                <Box sx={{ mb: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex' }}>
                    {/* Customer */}
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={16} color="white" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                          Customer
                        </Typography>
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3, color: roSummary.customerName ? 'text.primary' : 'text.disabled' }} noWrap>
                          {roSummary.customerName ?? '—'}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    {/* Vehicle */}
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, bgcolor: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Car size={16} color="white" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                          Vehicle
                        </Typography>
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, mt: 0.3, color: roSummary.vehicleLabel ? 'text.primary' : 'text.disabled' }} noWrap>
                          {roSummary.vehicleLabel ?? '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  {/* RO details row */}
                  <Box sx={{ display: 'flex', borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ px: 2, py: 1, borderRight: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.2 }}>Job</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>
                        {roSummary.jobNumber != null ? `#${roSummary.jobNumber}` : '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ px: 2, py: 1, borderRight: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.2 }}>RO #</Typography>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'text.secondary' }}>
                        {roSummary.roNumber ?? '—'}
                      </Typography>
                    </Box>
                    {roSummary.jobType && (
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4 }}>Job Type</Typography>
                        <Box sx={{
                          display: 'inline-block',
                          px: 1, py: 0.25,
                          borderRadius: 1,
                          bgcolor: 'primary.main',
                          color: 'white',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                          lineHeight: 1.4,
                        }}>
                          {roSummary.jobType.replace(/_/g, ' ')}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {/* ── Bool toggles ── */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
                <FormControlLabel
                  control={<Switch size="small" checked={f.is_towed ?? false} onChange={e => setField('is_towed', e.target.checked)} />}
                  label={<Typography variant="caption" fontWeight={600}>Towed In</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" checked={f.is_driveable ?? false} onChange={e => setField('is_driveable', e.target.checked)} />}
                  label={<Typography variant="caption" fontWeight={600}>Driveable</Typography>}
                />
                {fields.wrap && (
                  <FormControlLabel
                    control={<Switch size="small" checked={f.has_wrap ?? false} onChange={e => setField('has_wrap', e.target.checked)} />}
                    label={<Typography variant="caption" fontWeight={600}>Has Wrap</Typography>}
                  />
                )}
                {fields.ceramic && (
                  <FormControlLabel
                    control={<Switch size="small" checked={f.has_ceramic_coating ?? false} onChange={e => setField('has_ceramic_coating', e.target.checked)} />}
                    label={<Typography variant="caption" fontWeight={600}>Ceramic Coating</Typography>}
                  />
                )}
                {fields.policeReport && (
                  <FormControlLabel
                    control={<Switch size="small" checked={f.police_report_present ?? false} onChange={e => setField('police_report_present', e.target.checked)} />}
                    label={<Typography variant="caption" fontWeight={600}>Police Report Present</Typography>}
                  />
                )}
                {fields.priorEstimate && (
                  <FormControlLabel
                    control={<Switch size="small" checked={f.has_previous_estimate ?? false} onChange={e => setField('has_previous_estimate', e.target.checked)} />}
                    label={<Typography variant="caption" fontWeight={600}>Previous Estimate</Typography>}
                  />
                )}
              </Box>

              {/* ── Text / numeric fields ── */}
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Mileage" type="number" size="small" fullWidth
                    value={f.mileage ?? ''}
                    onChange={e => setField('mileage', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </Grid>
                {fields.dateOfLoss && (
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Date of Loss" type="date" size="small" fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={f.date_of_loss ?? ''}
                      onChange={e => setField('date_of_loss', e.target.value || undefined)}
                    />
                  </Grid>
                )}
                {fields.howAccident && (
                  <Grid item xs={12}>
                    <TextField
                      label="How did the accident happen?" size="small" fullWidth multiline rows={3}
                      value={f.how_accident_happened ?? ''}
                      onChange={e => setField('how_accident_happened', e.target.value || undefined)}
                    />
                  </Grid>
                )}
                {fields.pointOfImpact && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Point of Impact" size="small" fullWidth
                      value={f.point_of_impact ?? ''}
                      onChange={e => setField('point_of_impact', e.target.value || undefined)}
                    />
                  </Grid>
                )}
                {fields.upd && (
                  <Grid item xs={12}>
                    <TextField
                      label="Prior Unrelated Damage (UPD)" size="small" fullWidth multiline rows={2}
                      value={f.prior_unrelated_damage ?? ''}
                      onChange={e => setField('prior_unrelated_damage', e.target.value || undefined)}
                    />
                  </Grid>
                )}
                {fields.customerRequests && (
                  <Grid item xs={12}>
                    <TextField
                      label="Customer Requests" size="small" fullWidth multiline rows={2}
                      value={f.customer_requests ?? ''}
                      onChange={e => setField('customer_requests', e.target.value || undefined)}
                    />
                  </Grid>
                )}
                {fields.damageDescription && (
                  <Grid item xs={12}>
                    <TextField
                      label="Damage Description" size="small" fullWidth multiline rows={3}
                      value={f.damage_description ?? ''}
                      onChange={e => setField('damage_description', e.target.value || undefined)}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <TextField
                    label="Other Notes" size="small" fullWidth multiline rows={2}
                    value={f.notes ?? ''}
                    onChange={e => setField('notes', e.target.value || undefined)}
                  />
                </Grid>
              </Grid>

              {/* ── File uploads ── */}
              {(fields.policeReportUpload || fields.intakePhotos) && (
                <>
                  <Divider sx={{ my: 2.5 }} />
                  {fields.policeReportUpload && f.police_report_present && (
                    <FileSection
                      label="Police Report File"
                      docs={policeReportDocs}
                      uploading={uploadingPoliceReport}
                      onUpload={file => uploadFile(file, 'Police Report', setUploadingPoliceReport)}
                      onDelete={id => deleteDocMut.mutate(id)}
                      icon={<FileText size={16} />}
                    />
                  )}
                  {fields.intakePhotos && (
                    <FileSection
                      label="Intake Photos"
                      docs={intakePhotoDocs}
                      uploading={uploadingIntakePhoto}
                      onUpload={file => uploadFile(file, 'Intake Photo', setUploadingIntakePhoto)}
                      onDelete={id => deleteDocMut.mutate(id)}
                      icon={<Camera size={16} />}
                    />
                  )}
                </>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setEditing(false)} disabled={isPending}>Cancel</Button>
              <Button
                variant="contained" onClick={handleSave} disabled={isPending}
                startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
              >
                Save Intake
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
