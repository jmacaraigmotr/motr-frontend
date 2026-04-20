import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { insuranceCompaniesApi } from '@/api/insuranceCompanies'
import type { InsuranceCompany } from '@/api/insuranceCompanies'
import AddInsuranceCompanyDialog from '@/components/AddInsuranceCompanyDialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import { Plus, Search, Pencil, Trash2, ShieldCheck, Phone, Mail, User } from 'lucide-react'

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  company,
  onConfirm,
  onCancel,
  isPending,
}: {
  company: InsuranceCompany
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <Dialog open fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>
        Delete Insurance Company?
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Are you sure you want to delete <strong>{company.name}</strong>? This cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onCancel} disabled={isPending} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
          sx={{ borderRadius: 2 }}
        >
          {isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function InsuranceCompaniesView() {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<InsuranceCompany | null>(null)
  const [deleteCompany, setDeleteCompany] = useState<InsuranceCompany | null>(null)
  const [mutError, setMutError] = useState<string | null>(null)

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['insurance_companies', shop?.id],
    queryFn: () => insuranceCompaniesApi.list(shop?.id),
    staleTime: 2 * 60 * 1000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => insuranceCompaniesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance_companies'] })
      setDeleteCompany(null)
      setMutError(null)
    },
    onError: (err: { message?: string }) => setMutError(err.message ?? 'Failed to delete company.'),
  })

  const filtered = companies.filter(c =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      {/* ── Page header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShieldCheck size={24} style={{ opacity: 0.7 }} />
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
              Insurance Companies
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage insurance companies and their representative contacts
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setAddOpen(true)}
          sx={{ borderRadius: 2.5, px: 2.5 }}
        >
          Add Company
        </Button>
      </Box>

      {mutError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setMutError(null)}>
          {mutError}
        </Alert>
      )}

      {/* ── Search ── */}
      <TextField
        placeholder="Search companies…"
        size="small"
        value={search}
        onChange={e => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><Search size={16} style={{ opacity: 0.45 }} /></InputAdornment>
          ),
        }}
        sx={{ mb: 2.5, width: 320 }}
      />

      {/* ── Table ── */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company Phone
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Representative
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Rep Contact
                </TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <ShieldCheck size={32} style={{ opacity: 0.2, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    <Typography color="text.secondary" fontSize="0.95rem">
                      {search ? 'No companies match your search.' : 'No insurance companies yet. Add one to get started.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((co, idx) => (
                  <TableRow key={co.id} hover sx={{ bgcolor: idx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                    {/* Company name */}
                    <TableCell>
                      <Typography fontWeight={700} fontSize="0.9rem">{co.name}</Typography>
                    </TableCell>

                    {/* Company phone */}
                    <TableCell>
                      {co.phone ? (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Phone size={13} style={{ opacity: 0.5 }} />
                          <Typography fontSize="0.875rem">{co.phone}</Typography>
                        </Stack>
                      ) : (
                        <Typography fontSize="0.85rem" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    {/* Rep name */}
                    <TableCell>
                      {co.rep_name ? (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <User size={13} style={{ opacity: 0.5 }} />
                          <Typography fontSize="0.875rem">{co.rep_name}</Typography>
                        </Stack>
                      ) : (
                        <Typography fontSize="0.85rem" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    {/* Rep contact */}
                    <TableCell>
                      <Stack spacing={0.5}>
                        {co.rep_phone && (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Phone size={12} style={{ opacity: 0.45 }} />
                            <Typography fontSize="0.82rem">{co.rep_phone}</Typography>
                          </Stack>
                        )}
                        {co.rep_email && (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Mail size={12} style={{ opacity: 0.45 }} />
                            <Typography fontSize="0.82rem">{co.rep_email}</Typography>
                          </Stack>
                        )}
                        {!co.rep_phone && !co.rep_email && (
                          <Typography fontSize="0.85rem" color="text.disabled">—</Typography>
                        )}
                      </Stack>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" onClick={() => setEditCompany(co)} title="Edit">
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteCompany(co)} title="Delete">
                          <Trash2 size={15} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <Box sx={{ px: 2.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.015)' }}>
            <Typography fontSize="0.78rem" color="text.disabled">
              {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
              {search ? ` matching "${search}"` : ''}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* ── Add / Edit dialog ── */}
      <AddInsuranceCompanyDialog
        open={addOpen || editCompany !== null}
        company={editCompany}
        onClose={() => { setAddOpen(false); setEditCompany(null) }}
        onCreated={() => { setAddOpen(false); setEditCompany(null) }}
      />

      {/* ── Delete confirm ── */}
      {deleteCompany && (
        <DeleteConfirmDialog
          company={deleteCompany}
          onConfirm={() => deleteMut.mutate(deleteCompany.id)}
          onCancel={() => setDeleteCompany(null)}
          isPending={deleteMut.isPending}
        />
      )}
    </Box>
  )
}
