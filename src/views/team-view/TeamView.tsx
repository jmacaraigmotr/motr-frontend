import { useState, useMemo, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api/team'
import type { TeamMember, UpdateRoleInput, CreateMemberInput, EditMemberInput } from '@/api/team'
import type { Role } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Divider from '@mui/material/Divider'
import { Users, RefreshCw, Pencil, ShieldCheck, ShieldAlert, UserPlus } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_VIEWS: { value: string; label: string }[] = [
  { value: 'dashboard-view',      label: 'Dashboard' },
  { value: 'customer-view',       label: 'Customers' },
  { value: 'repair-orders-view',  label: 'Repair Orders' },
  { value: 'accounting-view',     label: 'Transactions' },
  { value: 'logistics-view',      label: 'Logistics' },
  { value: 'production-view',     label: 'Production' },
  { value: 'technician-view',     label: 'Technician' },
  { value: 'nttbe-view',          label: 'NTTBE' },
  { value: 'team-view',           label: 'Team' },
]

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

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

function memberInitials(m: TeamMember) {
  if (m.first_name && m.last_name) return (m.first_name[0] + m.last_name[0]).toUpperCase()
  const parts = (m.name ?? '').split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (m.name ?? '?').slice(0, 2).toUpperCase()
}

function useRoleMap(roles: Role[]) {
  return useMemo(() => new Map(roles.map(r => [r.id, r])), [roles])
}

// ─── Edit Member Dialog (full) ────────────────────────────────────────────────

interface EditMemberDialogProps {
  member: TeamMember
  roles: Role[]
  onClose: () => void
}

function EditMemberDialog({ member, roles, onClose }: EditMemberDialogProps) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name : member.first_name ?? '',
    last_name  : member.last_name  ?? '',
    email      : member.email,
    phone      : member.phone      ?? '',
    job_title  : member.job_title  ?? '',
    role_id    : member.role_id    ?? ('' as number | ''),
    status     : member.status     ?? 'active',
    is_archived: member.is_archived ?? false,
  })

  const mut = useMutation({
    mutationFn: (input: EditMemberInput) => teamApi.editMember(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
      showToast(`${form.first_name} ${form.last_name} updated`, 'success')
      onClose()
    },
    onError: (err: { message?: string }) => setError(err.message ?? 'Failed to update member'),
  })

  function f<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(p => ({ ...p, [key]: value }))
  }

  function handleSave() {
    mut.mutate({
      user_id    : member.id,
      first_name : form.first_name.trim() || undefined,
      last_name  : form.last_name.trim()  || undefined,
      email      : form.email.trim()      || undefined,
      phone      : form.phone.trim()      || undefined,
      job_title  : form.job_title.trim()  || undefined,
      role_id    : form.role_id !== '' ? (form.role_id as number) : undefined,
      status     : form.status as EditMemberInput['status'],
      is_archived: form.is_archived,
    })
  }

  const canSave = form.first_name.trim() && form.last_name.trim() && form.email.trim()
  const inputSx = { '& .MuiInputBase-input': { fontSize: '0.9rem' }, '& .MuiInputLabel-root': { fontSize: '0.9rem' } }
  const defaultViewLabelId = useId()
  const roleLabelId = useId()
  const statusLabelId = useId()

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 38, height: 38, fontSize: '0.88rem', bgcolor: 'primary.main' }}>
            {memberInitials(member)}
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>Edit Team Member</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{member.email}</Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3.5, overflow: 'visible', px: 3, pb: 1.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1, py: 1 }}>
          {/* Name row */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2.5 }}>
            <TextField
              label="First Name" fullWidth autoFocus sx={inputSx}
              value={form.first_name}
              onChange={e => f('first_name', e.target.value)}
            />
            <TextField
              label="Last Name" fullWidth sx={inputSx}
              value={form.last_name}
              onChange={e => f('last_name', e.target.value)}
            />
          </Box>

          {/* Email */}
          <TextField
            label="Email Address" fullWidth type="email" sx={inputSx}
            value={form.email}
            onChange={e => f('email', e.target.value)}
          />

          {/* Phone + Job Title */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Phone" fullWidth type="tel" sx={inputSx}
              value={form.phone}
              onChange={e => f('phone', e.target.value)}
            />
            <TextField
              label="Job Title" fullWidth sx={inputSx}
              value={form.job_title}
              onChange={e => f('job_title', e.target.value)}
            />
          </Box>

          <Divider />

          {/* Role + Status */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel id={roleLabelId} sx={{ fontSize: '0.9rem' }}>Role</InputLabel>
              <Select
                labelId={roleLabelId}
                label="Role"
                value={form.role_id}
                onChange={e => f('role_id', e.target.value as number | '')}
                sx={{ fontSize: '0.9rem' }}
              >
                <MenuItem value=""><em>No role</em></MenuItem>
                {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id={statusLabelId} sx={{ fontSize: '0.9rem' }}>Status</InputLabel>
              <Select
                labelId={statusLabelId}
                label="Status"
                value={form.status}
                onChange={e => f('status', e.target.value as typeof form['status'])}
                sx={{ fontSize: '0.9rem' }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider />

          {/* Archive toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={form.is_archived}
                onChange={e => f('is_archived', e.target.checked)}
                color="warning"
              />
            }
            label={
              <Box>
                <Typography fontSize="0.9rem" fontWeight={600}>Archived</Typography>
                <Typography fontSize="0.78rem" color="text.secondary">
                  Archived members cannot log in and are hidden from most views.
                </Typography>
              </Box>
            }
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mut.isPending || !canSave}
          onClick={handleSave}
          sx={{ borderRadius: 2, minWidth: 120 }}
        >
          {mut.isPending ? <CircularProgress size={16} color="inherit" /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Edit Role Dialog ─────────────────────────────────────────────────────────

interface EditRoleDialogProps {
  role: Role
  onClose: () => void
}

function EditRoleDialog({ role, onClose }: EditRoleDialogProps) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: role.name,
    description: role.description ?? '',
    default_view: role.default_view ?? '',
    is_active: role.is_active ?? true,
  })
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (data: UpdateRoleInput) => teamApi.updateRole(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles_list'] })
      showToast(`Role "${form.name}" updated`, 'success')
      onClose()
    },
    onError: (err: { message?: string }) => setError(err.message ?? 'Failed to update role'),
  })

  function f(key: keyof typeof form, value: string | boolean) {
    setForm(p => ({ ...p, [key]: value }))
  }

  const inputSx = { '& .MuiInputBase-input': { fontSize: '0.9rem' }, '& .MuiInputLabel-root': { fontSize: '0.9rem' } }
  const defaultViewLabelId = useId()

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography fontWeight={800} fontSize="1.1rem">Edit Role</Typography>
          <Typography fontSize="0.8rem" color="text.secondary" sx={{ mt: 0.25 }}>
            Code: <Box component="span" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 0.75, py: 0.2, borderRadius: 1 }}>{role.code}</Box>
          </Typography>
        </Box>
        <RoleBadge role={role} />
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Display Name" fullWidth required sx={inputSx}
            value={form.name}
            onChange={(e) => f('name', e.target.value)}
          />
          <TextField
            label="Description" fullWidth multiline rows={2} sx={inputSx}
            value={form.description}
            onChange={(e) => f('description', e.target.value)}
            placeholder="What does this role do?"
          />
          <FormControl fullWidth>
            <InputLabel id={defaultViewLabelId} sx={{ fontSize: '0.9rem' }}>Default View on Login</InputLabel>
            <Select
              labelId={defaultViewLabelId}
              label="Default View on Login"
              value={form.default_view}
              onChange={(e) => f('default_view', e.target.value)}
              sx={{ fontSize: '0.9rem' }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {AVAILABLE_VIEWS.map(v => (
                <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Divider />
          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                onChange={(e) => f('is_active', e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography fontSize="0.9rem" fontWeight={600}>Active</Typography>
                <Typography fontSize="0.78rem" color="text.secondary">
                  Inactive roles cannot be assigned to new members
                </Typography>
              </Box>
            }
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mut.isPending || !form.name.trim()}
          onClick={() => mut.mutate({
            role_id: role.id,
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            default_view: form.default_view || undefined,
            is_active: form.is_active,
          })}
          sx={{ borderRadius: 2, minWidth: 120 }}
        >
          {mut.isPending ? <CircularProgress size={16} color="inherit" /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Add Member Dialog ────────────────────────────────────────────────────────

const EMPTY_MEMBER: CreateMemberInput = {
  first_name: '', last_name: '', email: '', password: '',
  phone: '', job_title: '', role_id: undefined,
}

interface AddMemberDialogProps {
  roles: Role[]
  onClose: () => void
}

function AddMemberDialog({ roles, onClose }: AddMemberDialogProps) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [form, setForm] = useState<CreateMemberInput>(EMPTY_MEMBER)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: teamApi.createMember,
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
      showToast(`${m.name} added to the team`, 'success')
      onClose()
    },
    onError: (err: { message?: string }) => setError(err.message ?? 'Failed to add team member'),
  })

  function f(key: keyof CreateMemberInput, value: string | number | undefined) {
    setForm(p => ({ ...p, [key]: value }))
  }

  const canSubmit = form.first_name.trim() && form.last_name.trim() && form.email.trim() && form.password.trim()
  const inputSx = { '& .MuiInputBase-input': { fontSize: '0.9rem' }, '& .MuiInputLabel-root': { fontSize: '0.9rem' } }
  const roleLabelId = useId()

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1 }}>Add Team Member</DialogTitle>
      <DialogContent sx={{ pt: 3.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="First Name" required fullWidth autoFocus sx={inputSx}
              value={form.first_name}
              onChange={(e) => f('first_name', e.target.value)}
            />
            <TextField
              label="Last Name" required fullWidth sx={inputSx}
              value={form.last_name}
              onChange={(e) => f('last_name', e.target.value)}
            />
          </Box>
          <TextField
            label="Email Address" required fullWidth type="email" sx={inputSx}
            value={form.email}
            onChange={(e) => f('email', e.target.value)}
          />
          <TextField
            label="Password" required fullWidth sx={inputSx}
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => f('password', e.target.value)}
            helperText="Member will use this to log in. They can change it later."
            InputProps={{
              endAdornment: (
                <Button
                  size="small"
                  onClick={() => setShowPassword(p => !p)}
                  sx={{ fontSize: '0.75rem', minWidth: 'unset', color: 'text.secondary' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              ),
            }}
          />
          <Divider />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Phone" fullWidth type="tel" sx={inputSx}
              value={form.phone ?? ''}
              onChange={(e) => f('phone', e.target.value)}
            />
            <TextField
              label="Job Title" fullWidth sx={inputSx}
              value={form.job_title ?? ''}
              onChange={(e) => f('job_title', e.target.value)}
            />
          </Box>
          <FormControl fullWidth>
            <InputLabel id={roleLabelId} sx={{ fontSize: '0.9rem' }}>Role</InputLabel>
            <Select
              labelId={roleLabelId}
              label="Role"
              value={form.role_id ?? ''}
              onChange={(e) => f('role_id', e.target.value ? Number(e.target.value) : undefined)}
              sx={{ fontSize: '0.9rem' }}
            >
              <MenuItem value=""><em>Assign later</em></MenuItem>
              {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mut.isPending || !canSubmit}
          onClick={() => mut.mutate(form)}
          startIcon={mut.isPending ? <CircularProgress size={16} color="inherit" /> : <UserPlus size={16} />}
          sx={{ borderRadius: 2, minWidth: 140 }}
        >
          {mut.isPending ? 'Adding…' : 'Add Member'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ roles, onAddMember }: { roles: Role[]; onAddMember: () => void }) {
  const { user, isAdmin } = useAuth()
  const roleMap = useRoleMap(roles)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [filterRoleId, setFilterRoleId] = useState<number | ''>('')

  const { data: members, isLoading, isError } = useQuery<TeamMember[]>({
    queryKey: ['team_members'],
    queryFn: () => teamApi.listMembers(),
    staleTime: 30_000,
  })

  const visibleMembers = useMemo<TeamMember[]>(() => {
    if (!members) return []
    if (!filterRoleId) return members
    return members.filter((m: TeamMember) => m.role_id === filterRoleId)
  }, [members, filterRoleId])

  const headSx = {
    fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', color: 'text.secondary', bgcolor: 'background.paper',
    whiteSpace: 'nowrap' as const, py: 1.5,
  }
  const cellSx = { fontSize: '0.95rem', py: 2, color: 'text.primary' }
  const roleFilterLabelId = useId()

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        {/* Role filter */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id={roleFilterLabelId} sx={{ fontSize: '0.875rem' }}>Filter by Role</InputLabel>
          <Select
            labelId={roleFilterLabelId}
            label="Filter by Role"
            value={filterRoleId}
            onChange={(e) => setFilterRoleId(e.target.value as number | '')}
            sx={{ fontSize: '0.875rem', borderRadius: 2 }}
          >
            <MenuItem value=""><em>All Roles</em></MenuItem>
            {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />

        {isAdmin ? (
          <Button
            variant="contained"
            size="medium"
            startIcon={<UserPlus size={16} />}
            onClick={onAddMember}
            sx={{ borderRadius: 2.5, fontWeight: 700, px: 2.5 }}
          >
            Add Member
          </Button>
        ) : (
          <Alert severity="info" icon={<ShieldCheck size={18} />} sx={{ borderRadius: 2 }}>
            Only admins can add or change team member roles.
          </Alert>
        )}
      </Box>

      {isError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>Failed to load team members.</Alert>
      ) : (
        <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Member</TableCell>
                <TableCell sx={headSx}>Email</TableCell>
                <TableCell sx={headSx}>Phone</TableCell>
                <TableCell sx={headSx}>Role</TableCell>
                <TableCell sx={headSx}>Joined</TableCell>
                {isAdmin && <TableCell sx={{ ...headSx, textAlign: 'right' }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: isAdmin ? 6 : 5 }).map((_, j) => (
                      <TableCell key={j} sx={cellSx}><Skeleton variant="text" width={j === 0 ? 160 : 120} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    {filterRoleId ? 'No members with that role.' : 'No team members found.'}
                  </TableCell>
                </TableRow>
              ) : visibleMembers.map((m: TeamMember, idx: number) => (
                <TableRow
                  key={m.id}
                  sx={{
                    bgcolor: idx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent',
                    '&:last-child td': { border: 0 },
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <TableCell sx={cellSx}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
                        {memberInitials(m)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                          {m.name || `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()}
                          {m.id === user?.id && (
                            <Chip label="You" size="small" sx={{ ml: 1, height: 18, fontSize: '0.68rem', fontWeight: 700 }} />
                          )}
                        </Typography>
                        {m.job_title && (
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{m.job_title}</Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={cellSx}>{m.email}</TableCell>
                  <TableCell sx={{ ...cellSx, color: m.phone ? 'text.primary' : 'text.disabled' }}>{m.phone ?? '—'}</TableCell>
                  <TableCell sx={cellSx}>
                    <RoleBadge role={m.role_id != null ? roleMap.get(m.role_id) : null} />
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: 'text.secondary', fontSize: '0.88rem' }}>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell sx={{ ...cellSx, textAlign: 'right' }}>
                      {m.id !== user?.id && (
                        <Tooltip title="Edit Member">
                          <IconButton size="small" onClick={() => setEditingMember(m)} sx={{ color: 'text.secondary' }}>
                            <Pencil size={15} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editingMember && (
        <EditMemberDialog
          member={editingMember}
          roles={roles}
          onClose={() => setEditingMember(null)}
        />
      )}
    </>
  )
}

// ─── Roles Tab ────────────────────────────────────────────────────────────────

function RolesTab({ roles, isLoading }: { roles: Role[]; isLoading: boolean }) {
  const { isAdmin } = useAuth()
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  const headSx = {
    fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', color: 'text.secondary', bgcolor: 'background.paper',
    whiteSpace: 'nowrap' as const, py: 1.5,
  }
  const cellSx = { fontSize: '0.95rem', py: 2, color: 'text.primary' }

  return (
    <>
      {!isAdmin && (
        <Alert severity="info" icon={<ShieldAlert size={18} />} sx={{ borderRadius: 2, mb: 2 }}>
          Only admins can edit roles.
        </Alert>
      )}

      <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>Role</TableCell>
              <TableCell sx={headSx}>Code</TableCell>
              <TableCell sx={headSx}>Description</TableCell>
              <TableCell sx={headSx}>Default View</TableCell>
              <TableCell sx={headSx}>Status</TableCell>
              {isAdmin && <TableCell sx={{ ...headSx, textAlign: 'right' }}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: isAdmin ? 6 : 5 }).map((_, j) => (
                    <TableCell key={j} sx={cellSx}><Skeleton variant="text" width={j === 0 ? 140 : 100} /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                  No roles found.
                </TableCell>
              </TableRow>
            ) : roles.map((r) => {
              const viewLabel = AVAILABLE_VIEWS.find(v => v.value === r.default_view)?.label
              return (
                <TableRow key={r.id} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell sx={cellSx}>
                    <RoleBadge role={r} />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.82rem', bgcolor: 'action.hover', px: 0.75, py: 0.3, borderRadius: 1 }}>
                      {r.code}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: r.description ? 'text.primary' : 'text.disabled', maxWidth: 220 }}>
                    <Typography sx={{ fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: viewLabel ? 'text.primary' : 'text.disabled', fontSize: '0.88rem' }}>
                    {viewLabel ?? '—'}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Chip
                      label={r.is_active !== false ? 'Active' : 'Inactive'}
                      size="small"
                      color={r.is_active !== false ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', height: 22, fontWeight: 700 }}
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell sx={{ ...cellSx, textAlign: 'right' }}>
                      <Tooltip title="Edit Role">
                        <IconButton size="small" onClick={() => setEditingRole(r)} sx={{ color: 'text.secondary' }}>
                          <Pencil size={15} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {editingRole && (
        <EditRoleDialog role={editingRole} onClose={() => setEditingRole(null)} />
      )}
    </>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function TeamView() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['roles_list'],
    queryFn: () => teamApi.listRoles(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: members } = useQuery<TeamMember[]>({
    queryKey: ['team_members'],
    queryFn: () => teamApi.listMembers(),
    staleTime: 30_000,
  })

  function handleRefresh() {
    if (tab === 0) qc.invalidateQueries({ queryKey: ['team_members'] })
    else qc.invalidateQueries({ queryKey: ['roles_list'] })
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

      {/* Header */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>Team</Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.25 }}>
              Manage team members and roles
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={handleRefresh} sx={{ color: 'text.secondary' }}>
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>
            {tab === 0 && members && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Users size={15} style={{ opacity: 0.6 }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.secondary' }}>
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
            {tab === 1 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                <ShieldCheck size={15} style={{ opacity: 0.6 }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.secondary' }}>
                  {roles.length} role{roles.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40 }}>
          <Tab label="Members" sx={{ fontWeight: 700, fontSize: '0.9rem', minHeight: 40, textTransform: 'none' }} />
          <Tab
            label="Roles"
            sx={{ fontWeight: 700, fontSize: '0.9rem', minHeight: 40, textTransform: 'none' }}
            disabled={!isAdmin}
          />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 1.5, sm: 3 }, py: 2 }}>
        {tab === 0 && <MembersTab roles={roles} onAddMember={() => setAddMemberOpen(true)} />}
        {tab === 1 && <RolesTab roles={roles} isLoading={rolesLoading} />}

        {addMemberOpen && (
          <AddMemberDialog roles={roles} onClose={() => setAddMemberOpen(false)} />
        )}
      </Box>
    </Box>
  )
}
