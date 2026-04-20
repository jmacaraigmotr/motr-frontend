import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api/team'
import type { TeamMember, EditMemberInput, CreateMemberInput } from '@/api/team'
import { shopsApi } from '@/api/shops'
import type { Role, Shop } from '@/types/auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { Search, UserCheck, UserX, Users, UserPlus } from 'lucide-react'
import { initials } from '@/lib/utils'

// ─── Status chip ──────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: TeamMember['status'] }) {
  const map = {
    active:   { label: 'Active',   color: '#166534', bg: '#DCFCE7' },
    inactive: { label: 'Inactive', color: '#991B1B', bg: '#FEE2E2' },
    pending:  { label: 'Pending',  color: '#92400E', bg: '#FEF3C7' },
  } as const
  const s = map[status] ?? map.inactive
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.7rem', height: 22 }}
    />
  )
}

// ─── Add / Edit dialog ────────────────────────────────────────────────────────
function UserDialog({
  member,
  roles,
  shops,
  onClose,
  onSave,
  onCreate,
  saving,
  error,
}: {
  member: TeamMember | null
  roles: Role[]
  shops: Shop[]
  onClose: () => void
  onSave: (input: EditMemberInput) => void
  onCreate: (input: CreateMemberInput) => void
  saving: boolean
  error: string | null
}) {
  const isEdit = member !== null
  const [firstName, setFirstName] = useState(member?.first_name ?? '')
  const [lastName,  setLastName]  = useState(member?.last_name  ?? '')
  const [email,     setEmail]     = useState(member?.email      ?? '')
  const [phone,     setPhone]     = useState(member?.phone      ?? '')
  const [jobTitle,  setJobTitle]  = useState(member?.job_title  ?? '')
  const [password,  setPassword]  = useState('')
  const [roleId,    setRoleId]    = useState<number | ''>(member?.role_id  ?? '')
  const [shopId,    setShopId]    = useState<number | ''>(member?.shop_id  ?? '')
  const [status,    setStatus]    = useState<TeamMember['status']>(member?.status ?? 'pending')

  const handleSubmit = () => {
    if (isEdit) {
      onSave({
        user_id:    member.id,
        first_name: firstName.trim() || undefined,
        last_name:  lastName.trim()  || undefined,
        email:      email.trim()     || undefined,
        phone:      phone.trim()     || undefined,
        job_title:  jobTitle.trim()  || undefined,
        role_id:    roleId  !== '' ? Number(roleId)  : undefined,
        shop_id:    shopId  !== '' ? Number(shopId)  : undefined,
        status,
      })
    } else {
      onCreate({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim(),
        password,
        phone:      phone.trim()     || undefined,
        job_title:  jobTitle.trim()  || undefined,
        role_id:    roleId  !== '' ? Number(roleId)  : undefined,
        shop_id:    shopId  !== '' ? Number(shopId)  : undefined,
        status,
      })
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEdit ? 'Edit User' : 'Add User'}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            size="small"
            fullWidth
            required
          />
        </Box>

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          size="small"
          fullWidth
          required
        />

        {!isEdit && (
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="small"
            fullWidth
            required
          />
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Job title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>

        <FormControl size="small" fullWidth>
          <InputLabel>Shop</InputLabel>
          <Select
            value={shopId}
            label="Shop"
            onChange={(e) => setShopId(e.target.value as number | '')}
          >
            <MenuItem value=""><em>No shop</em></MenuItem>
            {shops.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleId}
              label="Role"
              onChange={(e) => setRoleId(e.target.value as number | '')}
            >
              <MenuItem value=""><em>No role</em></MenuItem>
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              label="Status"
              onChange={(e) => setStatus(e.target.value as TeamMember['status'])}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {saving ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save changes' : 'Add user')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function AdminUsersView() {
  const qc = useQueryClient()
  const [search,      setSearch]      = useState('')
  const [filterShop,  setFilterShop]  = useState<number | ''>('')
  const [dialogMember, setDialogMember] = useState<TeamMember | null | 'new'>(undefined as any)
  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const { data: shops = [] } = useQuery({
    queryKey: ['shops'],
    queryFn:  () => shopsApi.list(),
    staleTime: 60_000,
  })

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['team_members', filterShop || undefined],
    queryFn:  () => teamApi.listMembers(filterShop ? { shop_id: filterShop } : undefined),
    staleTime: 30_000,
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => teamApi.listRoles(),
    staleTime: 60_000,
  })

  const editMutation = useMutation({
    mutationFn: (input: EditMemberInput) => teamApi.editMember(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
      closeDialog()
    },
    onError: (err: any) => setDialogError(err?.message ?? 'Failed to save'),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateMemberInput) => teamApi.createMember(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
      closeDialog()
    },
    onError: (err: any) => setDialogError(err?.message ?? 'Failed to create user'),
  })

  const toggleStatus = (member: TeamMember) => {
    const next: TeamMember['status'] = member.status === 'active' ? 'inactive' : 'active'
    teamApi.editMember({ user_id: member.id, status: next }).then(() => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
    })
  }

  const openEdit = (member: TeamMember) => {
    setDialogMember(member)
    setDialogError(null)
    setDialogOpen(true)
  }

  const openAdd = () => {
    setDialogMember(null)
    setDialogError(null)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setDialogMember(undefined as any)
    setDialogError(null)
  }

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]))
  const shopMap = Object.fromEntries(shops.map((s) => [s.id, s.name]))

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    return (
      !q ||
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.job_title ?? '').toLowerCase().includes(q)
    )
  })

  const isSaving = editMutation.isPending || createMutation.isPending

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Users
          </Typography>
          <Typography variant="h5" fontWeight={900} mt={0.5}>
            All Users
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Manage accounts and roles across all shops.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UserPlus size={16} />}
          onClick={openAdd}
          sx={{ mt: 1 }}
        >
          Add User
        </Button>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search by name, email, or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} style={{ opacity: 0.5 }} />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Shop</InputLabel>
          <Select
            value={filterShop}
            label="Shop"
            onChange={(e) => setFilterShop(e.target.value as number | '')}
          >
            <MenuItem value=""><em>All shops</em></MenuItem>
            {shops.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Content */}
      {loadingMembers ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 6 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading users…</Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Users size={32} style={{ opacity: 0.2 }} />
            <Typography variant="body2" color="text.disabled" mt={1}>
              {search || filterShop ? 'No users match your filters.' : 'No users found.'}
            </Typography>
          </Box>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box
            component="table"
            sx={{
              width: '100%',
              borderCollapse: 'collapse',
              '& th': {
                textAlign: 'left',
                px: 2,
                py: 1.25,
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'text.disabled',
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.50',
              },
              '& td': {
                px: 2,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                fontSize: '0.875rem',
                verticalAlign: 'middle',
              },
              '& tbody tr:last-child td': { borderBottom: 'none' },
              '& tbody tr:hover td': { bgcolor: 'action.hover' },
            }}
          >
            <thead>
              <tr>
                <th>User</th>
                <th>Shop</th>
                <th>Role</th>
                <th>Job Title</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id}>
                  <td>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
                      onClick={() => openEdit(member)}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: 'primary.main',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials(member.first_name, member.last_name)}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ lineHeight: 1.3, '&:hover': { textDecoration: 'underline' } }}
                        >
                          {[member.first_name, member.last_name].filter(Boolean).join(' ') || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                          {member.email}
                        </Typography>
                      </Box>
                    </Box>
                  </td>
                  <td>
                    <Typography variant="body2" color="text.secondary">
                      {member.shop_id ? (shopMap[member.shop_id] ?? `Shop #${member.shop_id}`) : '—'}
                    </Typography>
                  </td>
                  <td>
                    <Typography variant="body2" color="text.secondary">
                      {member.role_id ? (roleMap[member.role_id] ?? `Role #${member.role_id}`) : '—'}
                    </Typography>
                  </td>
                  <td>
                    <Typography variant="body2" color="text.secondary">
                      {member.job_title || '—'}
                    </Typography>
                  </td>
                  <td>
                    <StatusChip status={member.status} />
                  </td>
                  <td>
                    <Typography variant="body2" color="text.secondary">
                      {member.last_login
                        ? new Date(member.last_login).toLocaleDateString()
                        : '—'}
                    </Typography>
                  </td>
                  <td>
                    <Tooltip title={member.status === 'active' ? 'Deactivate' : 'Activate'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleStatus(member)}
                        sx={{
                          color: member.status === 'active' ? 'text.secondary' : 'success.main',
                          '&:hover': {
                            color: member.status === 'active' ? 'error.main' : 'success.dark',
                          },
                        }}
                      >
                        {member.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                      </IconButton>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Card>
      )}

      {dialogOpen && (
        <UserDialog
          member={dialogMember as TeamMember | null}
          roles={roles}
          shops={shops}
          onClose={closeDialog}
          onSave={(input) => editMutation.mutate(input)}
          onCreate={(input) => createMutation.mutate(input)}
          saving={isSaving}
          error={dialogError}
        />
      )}
    </Box>
  )
}
