import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { insuranceCompaniesApi } from '@/api/insuranceCompanies'
import type { InsuranceCompany } from '@/api/insuranceCompanies'
import AddInsuranceCompanyDialog from '@/components/AddInsuranceCompanyDialog'
import type { CreateInsuranceInput } from '@/api/insurance'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import { Save, Plus } from 'lucide-react'

type InsuranceField = keyof CreateInsuranceInput

// Non-company fields for each party
const FIRST_PARTY_EXTRA: { key: InsuranceField; label: string }[] = [
  { key: 'first_party_claim_number', label: 'Claim #' },
  { key: 'first_party_rep_name',     label: 'Rep Name' },
  { key: 'first_party_rep_phone',    label: 'Rep Phone' },
]

const THIRD_PARTY_EXTRA: { key: InsuranceField; label: string }[] = [
  { key: 'third_party_claim_number', label: 'Claim #' },
  { key: 'third_party_rep_name',     label: 'Rep Name' },
  { key: 'third_party_rep_phone',    label: 'Rep Phone' },
]

function sanitizeLiabilityInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  return cleaned ? cleaned : undefined
}

interface InsuranceFormProps {
  mode: 'create' | 'edit'
  value: CreateInsuranceInput
  onChange: (updates: Partial<CreateInsuranceInput>) => void
  onCancel: () => void
  onSubmit: () => void
  isSubmitting: boolean
  error?: string | null
}

// ─── Company select row ───────────────────────────────────────────────────────

function CompanySelect({
  label,
  companyId,
  companies,
  onChange,
  onAddNew,
}: {
  label: string
  companyId: number | undefined
  companies: InsuranceCompany[]
  onChange: (company: InsuranceCompany | null) => void
  onAddNew: () => void
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <TextField
        select
        label={label}
        size="small"
        fullWidth
        value={companyId ?? ''}
        onChange={e => {
          const id = e.target.value ? Number(e.target.value) : null
          const match = id ? (companies.find(c => c.id === id) ?? null) : null
          onChange(match)
        }}
      >
        <MenuItem value=""><em>None</em></MenuItem>
        {companies.map(c => (
          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
        ))}
      </TextField>
      <Button
        size="small"
        variant="outlined"
        onClick={onAddNew}
        sx={{ whiteSpace: 'nowrap', minWidth: 'unset', px: 1.5, height: 40, flexShrink: 0 }}
        title="Add new insurance company"
      >
        <Plus size={15} />
      </Button>
    </Box>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function InsuranceForm({
  mode,
  value,
  onChange,
  onCancel,
  onSubmit,
  isSubmitting,
  error,
}: InsuranceFormProps) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const [addCompanyFor, setAddCompanyFor] = useState<'first_party' | 'third_party' | null>(null)
  const addCompanyForRef = useRef<'first_party' | 'third_party' | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data: companies = [] } = useQuery({
    queryKey: ['insurance_companies', shop?.id],
    queryFn: () => insuranceCompaniesApi.list(shop?.id),
    staleTime: 5 * 60 * 1000,
  })

  const hasFirstParty = !!value.has_first_party
  const hasThirdParty = !!value.has_third_party
  const liabilityInput = value.liability_percentage ?? ''
  const pdLimitDisplay = value.pd_limit != null ? (value.pd_limit / 100).toString() : ''

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Validate: company required when party is enabled
    if (hasFirstParty && !value.first_party_company_id) {
      setValidationError('1st Party company is required when 1st Party is enabled.')
      return
    }
    if (hasThirdParty && !value.third_party_company_id) {
      setValidationError('3rd Party company is required when 3rd Party is enabled.')
      return
    }
    setValidationError(null)
    onSubmit()
  }

  function openAddCompanyDialog(party: 'first_party' | 'third_party') {
    addCompanyForRef.current = party
    setAddCompanyFor(party)
  }

  function handleCompanyCreated(company: InsuranceCompany) {
    qc.invalidateQueries({ queryKey: ['insurance_companies'] })
    const repPatch = {
      ...(company.rep_name  ? { rep_name:  company.rep_name }  : {}),
      ...(company.rep_phone ? { rep_phone: company.rep_phone } : {}),
    }
    // Use ref to avoid stale closure — state may not reflect latest value in async callbacks
    const party = addCompanyForRef.current
    if (party === 'first_party') {
      onChange({ first_party_company_id: company.id, first_party_rep_name: repPatch.rep_name, first_party_rep_phone: repPatch.rep_phone })
    } else if (party === 'third_party') {
      onChange({ third_party_company_id: company.id, third_party_rep_name: repPatch.rep_name, third_party_rep_phone: repPatch.rep_phone })
    }
    addCompanyForRef.current = null
    setAddCompanyFor(null)
  }

  return (
    <>
      <Box component="form" onSubmit={handleSubmit}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={2}>
          {mode === 'edit' ? 'Edit Insurance' : 'Add Insurance'}
        </Typography>

        {(validationError || error) && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{validationError ?? error}</Alert>
        )}

        <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={hasFirstParty}
                onChange={(e) => onChange({ has_first_party: e.target.checked })}
              />
            }
            label={<Typography variant="caption">1st Party</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={hasThirdParty}
                onChange={(e) => onChange({ has_third_party: e.target.checked })}
              />
            }
            label={<Typography variant="caption">3rd Party</Typography>}
          />
        </Box>

        {/* ── 1st Party ──────────────────────────────────────────────────── */}
        {hasFirstParty && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="primary.main" display="block" mb={1}>
              1st Party
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <CompanySelect
                  label="Company"
                  companyId={value.first_party_company_id}
                  companies={companies}
                  onChange={(co) => onChange({
                    first_party_company_id: co?.id ?? undefined,
                    first_party_rep_name:  co?.rep_name  ?? undefined,
                    first_party_rep_phone: co?.rep_phone ?? undefined,
                  })}
                  onAddNew={() => openAddCompanyDialog('first_party')}
                />
              </Grid>
              {FIRST_PARTY_EXTRA.map(({ key, label }) => (
                <Grid item xs={6} key={key}>
                  <TextField
                    label={label}
                    size="small"
                    fullWidth
                    value={(value[key] as string | undefined) ?? ''}
                    onChange={(e) => onChange({ [key]: e.target.value || undefined })}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* ── 3rd Party ──────────────────────────────────────────────────── */}
        {hasThirdParty && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="secondary.main" display="block" mb={1}>
              3rd Party
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <CompanySelect
                  label="Company"
                  companyId={value.third_party_company_id}
                  companies={companies}
                  onChange={(co) => onChange({
                    third_party_company_id: co?.id ?? undefined,
                    third_party_rep_name:  co?.rep_name  ?? undefined,
                    third_party_rep_phone: co?.rep_phone ?? undefined,
                  })}
                  onAddNew={() => openAddCompanyDialog('third_party')}
                />
              </Grid>
              {THIRD_PARTY_EXTRA.map(({ key, label }) => (
                <Grid item xs={6} key={key}>
                  <TextField
                    label={label}
                    size="small"
                    fullWidth
                    value={(value[key] as string | undefined) ?? ''}
                    onChange={(e) => onChange({ [key]: e.target.value || undefined })}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Liability %"
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              value={liabilityInput}
              onChange={(e) => onChange({ liability_percentage: sanitizeLiabilityInput(e.target.value) })}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="PD Limit ($)"
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={pdLimitDisplay}
              onChange={(e) => {
                const raw = e.target.value
                if (!raw) { onChange({ pd_limit: undefined }); return }
                const numeric = Number.parseFloat(raw)
                onChange({ pd_limit: Number.isFinite(numeric) ? Math.round(numeric * 100) : undefined })
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={value.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value || undefined })}
            />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={onCancel} disabled={isSubmitting} sx={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
            sx={{ flex: 1 }}
          >
            Save Insurance
          </Button>
        </Box>
      </Box>

      <AddInsuranceCompanyDialog
        open={addCompanyFor !== null}
        onClose={() => setAddCompanyFor(null)}
        onCreated={handleCompanyCreated}
      />
    </>
  )
}
