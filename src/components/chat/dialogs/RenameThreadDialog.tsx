import type { UseMutationResult } from '@tanstack/react-query'
import type { RenameDialogState } from '../useChatState'
import type { UpdateThreadInput } from '@/api/teamChat'
import type { TeamChatThread } from '@/types'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { X } from 'lucide-react'

interface Props {
  renameDialog: RenameDialogState
  setRenameDialog: React.Dispatch<React.SetStateAction<RenameDialogState>>
  renameThread: UseMutationResult<TeamChatThread, any, UpdateThreadInput, any>
}

export default function RenameThreadDialog({ renameDialog, setRenameDialog, renameThread }: Props) {
  const close = () => setRenameDialog({ open: false, threadId: null, title: '' })

  return (
    <Dialog open={renameDialog.open} onClose={close} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={800} fontSize="1rem">Rename Thread</Typography>
        <IconButton size="small" onClick={close}><X size={16} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <TextField
          label="Thread name" fullWidth autoFocus
          value={renameDialog.title}
          onChange={(e) => setRenameDialog((p) => ({ ...p, title: e.target.value }))}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained"
          disabled={!renameDialog.title.trim() || renameDialog.threadId == null || renameThread.isPending}
          startIcon={renameThread.isPending ? <CircularProgress size={14} color="inherit" /> : null}
          onClick={() => { if (renameDialog.threadId) renameThread.mutate({ thread_id: renameDialog.threadId, title: renameDialog.title.trim() }) }}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  )
}
