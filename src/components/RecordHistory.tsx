import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import DocumentViewer from '@/components/DocumentViewer'
import type { CustomerDocument } from '@/types/document'

// ── Public interface ──────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number
  created_at: string
  action_type: 'create' | 'update' | 'delete' | string
  entity_type: string
  entity_id?: number | null
  entity_name: string | null
  description: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  user: {
    first_name?: string | null
    last_name?: string | null
    name?: string | null
    email?: string | null
  } | null
}

type FKResolvers = Record<string, (id: number) => string | undefined>

interface RecordHistoryProps {
  entries: AuditEntry[]
  ro?: { job_number?: string | number | null; ro_number?: string | null }
  onPaymentClick?: (paymentId: number) => void
  fkResolvers?: FKResolvers
}

interface IntakeHistoryDocument {
  id?: number
  label?: string | null
  created_at?: string | null
  file?: {
    url?: string | null
    name?: string | null
    mime?: string | null
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SKIP_FIELDS = new Set([
  'id', 'shop_id', 'created_at', 'updated_at', 'deleted_at', 'created_by',
  'customer_id', 'vehicle_id', 'repair_order_id', 'invoice_id', 'csr_id',
  'estimator_id', 'lot_location_id', 'assigned_csr_id', 'company_id',
  'received_by', 'user_id', 'payment_id', 'ro_number', 'is_success',
  'ip_address', 'dealer_ro_number', 'qbo_payment_id',
])

const MONEY_FIELDS = new Set([
  'amount', 'deductible_amount', 'approved_daily_amount', 'estimated_total',
  'actual_total', 'pd_limit', 'amount_left_in_vehicle', 'insurance_total',
])

const DATE_FIELDS = new Set([
  'arrived_at', 'delivered_at', 'scheduled_out_date',
  'rental_start_date', 'rental_due_date', 'date_added', 'date_of_loss',
])

const FIELD_LABELS: Record<string, string> = {
  // Repair Order
  status: 'Status',
  job_status: 'Job Status',
  job_type: 'Job Type',
  job_class: 'Job Class',
  priority: 'Priority',
  job_number: 'Job #',
  is_total_loss: 'Total Loss',
  insurance_authorized: 'Insurance Authorized',
  deductible_amount: 'Deductible',
  is_maxed: 'Maxed Out',
  has_room_left_in_vehicle: 'Room Left in Vehicle',
  amount_left_in_vehicle: 'Amount Left',
  rental_needed: 'Rental Needed',
  arrived_at: 'Arrived At',
  delivered_at: 'Delivered At',
  scheduled_out_date: 'Scheduled Out',
  zone: 'Zone',
  notes: 'Notes',
  // Intake
  is_towed: 'Towed',
  is_driveable: 'Driveable',
  has_wrap: 'Has Wrap',
  has_ceramic_coating: 'Ceramic Coating',
  how_accident_happened: 'How Accident Happened',
  point_of_impact: 'Point of Impact',
  date_of_loss: 'Date of Loss',
  prior_unrelated_damage: 'Prior Unrelated Damage',
  damage_description: 'Damage Description',
  customer_requests: 'Customer Requests',
  insurance_party: 'Insurance Party',
  police_report_present: 'Police Report',
  mileage: 'Mileage',
  has_previous_estimate: 'Previous Estimate',
  // Insurance
  has_first_party: 'First Party',
  first_party_company_id: '1st Party Company',
  first_party_claim_number: '1st Party Claim #',
  first_party_rep_name: '1st Party Rep',
  first_party_rep_phone: '1st Party Rep Phone',
  has_third_party: 'Third Party',
  third_party_company_id: '3rd Party Company',
  third_party_claim_number: '3rd Party Claim #',
  third_party_rep_name: '3rd Party Rep',
  third_party_rep_phone: '3rd Party Rep Phone',
  liability_percentage: 'Liability %',
  pd_limit: 'PD Limit',
  // Rental
  rental_company: 'Rental Company',
  approved_daily_amount: 'Daily Rate',
  days_on_policy: 'Days on Policy',
  reservation_number: 'Reservation #',
  contract_number: 'Contract #',
  rental_start_date: 'Start Date',
  rental_due_date: 'Due Date',
  // Payment
  amount: 'Amount',
  payment_status: 'Payment Status',
  payment_method: 'Payment Method',
  transaction_type: 'Transaction Type',
  payer_type: 'Payer',
  reference_number: 'Reference #',
  date_added: 'Date',
  // Vehicle
  year: 'Year',
  make: 'Make',
  model: 'Model',
  trim: 'Trim',
  color: 'Color',
  vin: 'VIN',
  license_plate: 'Plate',
  license_state: 'State',
  mileage_in: 'Mileage In',
  insurance_company: 'Insurance',
  insurance_policy_number: 'Policy #',
  // Customer
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  phone_secondary: 'Secondary Phone',
  preferred_contact: 'Preferred Contact',
  address_line1: 'Address',
  address_line2: 'Address 2',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  referred_by: 'Referred By',
  referrer_name: 'Referrer',
  location_attribution: 'Attribution',
}

const ENTITY_LABELS: Record<string, string> = {
  repair_orders: 'Repair Order',
  intakes: 'Intake',
  ro_insurance: 'Insurance',
  rentals: 'Rental',
  payments: 'Transaction',
  payment_events: 'Event',
  intake_documents: 'Intake Document',
  vehicles: 'Vehicle',
  customers: 'Customer',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatFieldValue(key: string, value: unknown, fkResolvers?: FKResolvers): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (fkResolvers?.[key] && typeof value === 'number') {
    const resolved = fkResolvers[key](value)
    if (resolved) return resolved
  }
  if (MONEY_FIELDS.has(key) && typeof value === 'number') return formatCurrency(value)
  if (DATE_FIELDS.has(key)) {
    if (typeof value === 'string') return formatDate(value)
    if (typeof value === 'number') return formatDate(new Date(value).toISOString())
  }
  if (typeof value === 'string') {
    // humanize snake_case enum values
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function actorName(user: AuditEntry['user']): string {
  if (!user) return 'System'
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  if (user.name) return user.name
  if (user.email) return user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return 'System'
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function intakeDocumentsFromMetadata(entry: AuditEntry): IntakeHistoryDocument[] {
  const isIntakeCreate = entry.entity_type === 'intakes' && entry.action_type === 'create'
  const isIntakeDocBatch = entry.entity_type === 'intake_documents' && entry.action_type === 'create'
  const isIntakeDocDelete = entry.entity_type === 'intake_documents' && entry.action_type === 'delete'
  if (!isIntakeCreate && !isIntakeDocBatch && !isIntakeDocDelete) return []
  const raw = entry.metadata?.intake_documents
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is IntakeHistoryDocument => typeof item === 'object' && item !== null)
}

function toViewerDocs(docs: IntakeHistoryDocument[]): CustomerDocument[] {
  return docs.map((doc, i) => ({
    id: doc.id ?? i,
    shop_id: 0,
    uploaded_by: null,
    entity_type: 'repair_order' as const,
    entity_id: 0,
    category: 'other' as const,
    label: doc.label ?? null,
    file: doc.file?.url ? {
      access: 'public',
      path: '',
      name: doc.file.name ?? 'Document',
      type: doc.file.mime?.startsWith('image/') ? 'image' : 'document',
      size: 0,
      mime: doc.file.mime ?? '',
      url: doc.file.url,
    } : null,
    created_at: doc.created_at ?? '',
    updated_at: doc.created_at ?? '',
  }))
}

// ── Field diff builders ───────────────────────────────────────────────────────

interface FieldChange {
  key: string
  label: string
  oldValue: string | null
  newValue: string | null
}

function buildCreateFields(newValues: Record<string, unknown>, fkResolvers?: FKResolvers): FieldChange[] {
  return Object.entries(newValues)
    .filter(([key, val]) => !SKIP_FIELDS.has(key) && val !== null && val !== undefined && val !== '')
    .map(([key, val]) => ({
      key,
      label: fieldLabel(key),
      oldValue: null,
      newValue: formatFieldValue(key, val, fkResolvers),
    }))
}

function buildUpdateFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  fkResolvers?: FKResolvers,
): FieldChange[] {
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)])
  return Array.from(allKeys)
    .filter(key => !SKIP_FIELDS.has(key))
    .filter(key => {
      const o = oldValues[key] ?? null
      const n = newValues[key] ?? null
      return String(o) !== String(n)
    })
    .map(key => ({
      key,
      label: fieldLabel(key),
      oldValue: formatFieldValue(key, oldValues[key] ?? null, fkResolvers),
      newValue: formatFieldValue(key, newValues[key] ?? null, fkResolvers),
    }))
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  create: { Icon: Plus, label: 'Created', color: '#10B981', bg: '#ECFDF5' },
  update: { Icon: Pencil, label: 'Updated', color: '#3B82F6', bg: '#EFF6FF' },
  delete: { Icon: Trash2, label: 'Deleted', color: '#EF4444', bg: '#FEF2F2' },
} as const

function FieldList({ changes, isCreate }: { changes: FieldChange[]; isCreate: boolean }) {
  const SHOW_LIMIT = 8
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? changes : changes.slice(0, SHOW_LIMIT)
  const hidden = changes.length - SHOW_LIMIT

  if (changes.length === 0) return null

  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3">
      <div className="space-y-2">
        {visible.map(change => (
          <div key={change.key} className="grid gap-x-3 text-[13px] sm:grid-cols-[160px_1fr]">
            <span className="font-medium text-[var(--text-muted)]">{change.label}</span>
            {isCreate ? (
              <span className="text-[var(--text-default)]">{change.newValue}</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[var(--text-muted)] line-through decoration-[var(--text-muted)]">
                  {change.oldValue}
                </span>
                <span className="text-[var(--text-muted)]">→</span>
                <span className="font-medium text-[var(--text-default)]">{change.newValue}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-default)]"
        >
          {expanded ? (
            <><ChevronUp size={13} /> Show less</>
          ) : (
            <><ChevronDown size={13} /> Show {hidden} more field{hidden > 1 ? 's' : ''}</>
          )}
        </button>
      )}
    </div>
  )
}

function HistoryEntry({ entry, isLast, ro, onPaymentClick, onViewDoc, fkResolvers }: { entry: AuditEntry; isLast: boolean; ro?: RecordHistoryProps['ro']; onPaymentClick?: (id: number) => void; onViewDoc?: (docs: CustomerDocument[], index: number) => void; fkResolvers?: FKResolvers }) {
  const actionType = (entry.action_type === 'create' || entry.action_type === 'update' || entry.action_type === 'delete')
    ? entry.action_type
    : 'update'
  const config = ACTION_CONFIG[actionType]
  const Icon = config.Icon

  const changes: FieldChange[] = (() => {
    if (entry.entity_type === 'intake_documents') return []
    if (actionType === 'create' && entry.new_values) return buildCreateFields(entry.new_values, fkResolvers)
    if (actionType === 'update' && entry.old_values && entry.new_values) return buildUpdateFields(entry.old_values, entry.new_values, fkResolvers)
    if (actionType === 'delete' && entry.old_values) return buildCreateFields(entry.old_values, fkResolvers)
    return []
  })()

  const actor = actorName(entry.user)
  const entity = entityLabel(entry.entity_type)
  const isPayment = entry.entity_type === 'payments'
  const isPaymentEvent = entry.entity_type === 'payment_events'
  const paymentEventTxId = isPaymentEvent
    ? (entry.metadata?.payment_id as number | undefined) ?? null
    : null
  const groupedIntakeDocuments = intakeDocumentsFromMetadata(entry)
  const jobLabel = (isPayment || isPaymentEvent)
    ? null
    : ro?.job_number != null ? ` — Job #${ro.job_number}` : (entry.entity_name && !/^\d+$/.test(entry.entity_name) ? ` — ${entry.entity_name}` : '')

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div
          className="absolute left-[15px] top-[32px] w-px"
          style={{ bottom: '-16px', background: 'var(--line)' }}
        />
      )}

      {/* Icon dot */}
      <div
        className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: config.bg, border: `1.5px solid ${config.color}20` }}
      >
        <Icon size={14} color={config.color} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6">
        {/* Header */}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[14px] font-semibold text-[var(--text-strong)]">{actor}</span>
          <span className="text-[14px]" style={{ color: config.color, fontWeight: 600 }}>
            {config.label}
          </span>
          <span className="text-[14px] text-[var(--text-default)]">
            {entity}
            {isPayment && entry.entity_id != null ? (
              onPaymentClick ? (
                <button
                  onClick={() => onPaymentClick(entry.entity_id!)}
                  className="ml-1 font-medium text-[var(--accent)] hover:underline"
                >
                  — Transaction #{entry.entity_id}
                </button>
              ) : (
                <span className="ml-1">— Transaction #{entry.entity_id}</span>
              )
            ) : isPaymentEvent && paymentEventTxId != null ? (
              onPaymentClick ? (
                <button
                  onClick={() => onPaymentClick(paymentEventTxId)}
                  className="ml-1 font-medium text-[var(--accent)] hover:underline"
                >
                  — Transaction #{paymentEventTxId}
                </button>
              ) : (
                <span className="ml-1">— Transaction #{paymentEventTxId}</span>
              )
            ) : (
              jobLabel
            )}
          </span>
        </div>

        {/* Timestamp + RO number subtitle */}
        <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
          {formatDateTime(entry.created_at)}
          <span className="mx-1.5 opacity-40">·</span>
          {relativeTime(entry.created_at)}
          {ro?.ro_number && (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {ro.ro_number}
            </>
          )}
        </div>

        {/* Description (if any, for non-standard entries) */}
        {entry.description && changes.length === 0 && (
          <div className="mt-2 text-[13px] text-[var(--text-muted)]">{entry.description}</div>
        )}

        {/* Intake document batch (grouped under intake create) */}
        {groupedIntakeDocuments.length > 0 && (
          <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3">
            <div className="mb-2 text-[12px] font-medium text-[var(--text-muted)]">
              Intake Documents ({groupedIntakeDocuments.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {groupedIntakeDocuments.map((doc, idx) => {
                const docLabel = doc.label || doc.file?.name || `Document ${idx + 1}`
                const fileDisplayName = doc.file?.name || doc.label || `Document ${idx + 1}`
                const fileUrl = doc.file?.url || null
                const isImage = !!doc.file?.mime?.startsWith('image/')
                const viewerDocs = toViewerDocs(groupedIntakeDocuments)

                if (!fileUrl) {
                  return (
                    <div key={`${doc.id ?? 'doc'}-${idx}`} className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-[12px] text-[var(--text-muted)]">
                      <FileText size={14} className="shrink-0 opacity-50" />
                      {fileDisplayName}
                    </div>
                  )
                }

                return (
                  <button
                    key={`${doc.id ?? 'doc'}-${idx}`}
                    onClick={() => onViewDoc?.(viewerDocs, idx)}
                    className="group overflow-hidden rounded-[10px] border border-[var(--line)] bg-white hover:border-[var(--accent)] cursor-pointer p-0"
                    title={docLabel}
                    type="button"
                  >
                    {isImage ? (
                      <img
                        src={fileUrl}
                        alt={docLabel}
                        className="h-[72px] w-[96px] object-cover"
                      />
                    ) : (
                      <div className="flex h-[72px] w-[180px] items-center gap-2 px-3 text-[12px] text-[var(--text-default)]">
                        <FileText size={16} className="shrink-0 text-[var(--text-muted)]" />
                        <span className="truncate">{fileDisplayName}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Delete notice */}
        {actionType === 'delete' && entry.entity_type !== 'intake_documents' && (
          <div
            className="mt-3 rounded-[var(--radius-md)] border px-4 py-2 text-[13px] font-medium"
            style={{ borderColor: '#EF444430', background: '#FEF2F2', color: '#EF4444' }}
          >
            This record was deleted
          </div>
        )}

        {/* Field changes */}
        <FieldList changes={changes} isCreate={actionType === 'create'} />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RecordHistory({ entries, ro, onPaymentClick, fkResolvers }: RecordHistoryProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerDocs, setViewerDocs] = useState<CustomerDocument[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)

  const handleViewDoc = (docs: CustomerDocument[], index: number) => {
    setViewerDocs(docs)
    setViewerIndex(index)
    setViewerOpen(true)
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  if (sorted.length === 0) return null

  return (
    <>
      <div className="pt-1">
        {sorted.map((entry, idx) => (
          <HistoryEntry
            key={`${entry.id}-${entry.entity_type}`}
            entry={entry}
            isLast={idx === sorted.length - 1}
            ro={ro}
            onPaymentClick={onPaymentClick}
            onViewDoc={handleViewDoc}
            fkResolvers={fkResolvers}
          />
        ))}
      </div>
      <DocumentViewer
        documents={viewerDocs}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  )
}
