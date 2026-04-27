import type { UseMutationResult } from '@tanstack/react-query'
import type { StaffMember, TeamChatThread } from '@/types'
import type { DmDialogState } from '../useChatState'
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
  dmDialog: DmDialogState
  setDmDialog: React.Dispatch<React.SetStateAction<DmDialogState>>
  staffList: StaffMember[]
  currentUserId?: number
  createDM: UseMutationResult<TeamChatThread, any, { userId: number }, any>
}

export default function NewDMDialog({ dmDialog, setDmDialog, staffList, currentUserId, createDM }: Props) {
  const close = () => setDmDialog({ open: false, userId: null })

  return (
    <Dialog open={dmDialog.open} onClose={close} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={800} fontSize="1rem">New Direct Message</Typography>
        <IconButton size="small" onClick={close}><X size={16} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Autocomplete
          options={staffList.filter((s) => s.id !== currentUserId)}
          getOptionLabel={(o) => o.name}
          value={staffList.find((s) => s.id === dmDialog.userId) ?? null}
          onChange={(_, value) => setDmDialog((p) => ({ ...p, userId: value?.id ?? null }))}
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
          renderInput={(params) => (
            <TextField {...params} label="Select teammate" placeholder="Choose a team member" autoFocus />
          )}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained"
          disabled={!dmDialog.userId || createDM.isPending}
          startIcon={createDM.isPending ? <CircularProgress size={14} color="inherit" /> : null}
          onClick={() => { if (dmDialog.userId) createDM.mutate({ userId: dmDialog.userId }) }}>
          Start DM
        </Button>
      </DialogActions>
    </Dialog>
  )
}
