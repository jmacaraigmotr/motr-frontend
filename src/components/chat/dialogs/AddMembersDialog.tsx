import type { UseMutationResult } from '@tanstack/react-query'
import type { StaffMember } from '@/types'
import type { AddMembersDialogState } from '../useChatState'
import type { AddMembersInput } from '@/api/teamChat'
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
  addMembersDialog: AddMembersDialogState
  setAddMembersDialog: React.Dispatch<React.SetStateAction<AddMembersDialogState>>
  nonMembers: StaffMember[]
  addMembers: UseMutationResult<any, any, AddMembersInput, any>
}

export default function AddMembersDialog({ addMembersDialog, setAddMembersDialog, nonMembers, addMembers }: Props) {
  const close = () => setAddMembersDialog({ open: false, threadId: null, userIds: [] })

  return (
    <Dialog open={addMembersDialog.open} onClose={close} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={800} fontSize="1rem">Add Members</Typography>
        <IconButton size="small" onClick={close}><X size={16} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Autocomplete
          multiple
          options={nonMembers}
          getOptionLabel={(o) => o.name}
          value={nonMembers.filter((s) => addMembersDialog.userIds.includes(s.id))}
          onChange={(_, value) => setAddMembersDialog((p) => ({ ...p, userIds: value.map((s) => s.id) }))}
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
            <TextField {...params} label="Select teammates to add" placeholder="Search team members" autoFocus />
          )}
        />
        {nonMembers.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            All team members are already in this thread.
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained"
          disabled={addMembersDialog.userIds.length === 0 || addMembers.isPending}
          startIcon={addMembers.isPending ? <CircularProgress size={14} color="inherit" /> : null}
          onClick={() => {
            if (addMembersDialog.threadId && addMembersDialog.userIds.length > 0) {
              addMembers.mutate({ thread_id: addMembersDialog.threadId, user_ids: addMembersDialog.userIds })
            }
          }}>
          Add {addMembersDialog.userIds.length > 0 ? `(${addMembersDialog.userIds.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
