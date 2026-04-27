import type { UseMutationResult } from '@tanstack/react-query'
import type { StaffMember } from '@/types'
import type { ThreadDialogState } from '../useChatState'
import type { CreateThreadInput } from '@/api/teamChat'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Autocomplete from '@mui/material/Autocomplete'
import Avatar from '@mui/material/Avatar'
import { X } from 'lucide-react'
import { avatarColor, initials } from '../helpers'

interface Props {
  dialog: ThreadDialogState
  setDialog: React.Dispatch<React.SetStateAction<ThreadDialogState>>
  staffList: StaffMember[]
  currentUserId?: number
  createThread: UseMutationResult<any, any, CreateThreadInput, any>
}

export default function CreateThreadDialog({ dialog, setDialog, staffList, currentUserId, createThread }: Props) {
  const close = () => setDialog((p) => ({ ...p, open: false }))

  return (
    <Dialog open={dialog.open} onClose={close} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={800} fontSize="1rem">New Thread</Typography>
        <IconButton size="small" onClick={close}><X size={16} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Thread name"
          value={dialog.title}
          onChange={(e) => setDialog((p) => ({ ...p, title: e.target.value }))}
          autoFocus
        />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.68rem' }}>
              Invite teammates
            </Typography>
            <Button size="small" variant="outlined"
              sx={{ fontSize: '0.72rem', py: 0.25, px: 1, textTransform: 'none', borderColor: 'divider' }}
              onClick={() => setDialog((p) => ({
                ...p,
                memberIds: staffList.filter((s) => s.id !== currentUserId).map((s) => s.id),
              }))}>
              Add All
            </Button>
          </Box>

          <Autocomplete
            multiple
            options={staffList}
            getOptionLabel={(o) => o.name}
            value={staffList.filter((s) => dialog.memberIds.includes(s.id))}
            onChange={(_, value) => setDialog((p) => ({ ...p, memberIds: value.map((s) => s.id) }))}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Avatar sx={{ width: 26, height: 26, bgcolor: avatarColor(option.id), fontSize: '0.65rem', fontWeight: 700 }}>
                    {initials(option.name)}
                  </Avatar>
                  {option.name}
                </Box>
              </li>
            )}
            renderInput={(params) => <TextField {...params} placeholder="Select team members" />}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained"
          disabled={!dialog.title.trim() || createThread.isPending}
          startIcon={createThread.isPending ? <CircularProgress size={14} color="inherit" /> : null}
          onClick={() => createThread.mutate({ title: dialog.title.trim(), member_ids: dialog.memberIds })}>
          Create Thread
        </Button>
      </DialogActions>
    </Dialog>
  )
}
