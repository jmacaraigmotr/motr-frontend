import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { TeamChatThread, TeamChatMessage } from '@/types'
import type { CreateMessageInput } from '@/api/teamChat'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import { Send } from 'lucide-react'

interface Props {
  selectedThread: number | null
  selectedThreadObj: TeamChatThread | null
  sendMessage: UseMutationResult<TeamChatMessage, any, CreateMessageInput, any>
}

export default function MessageInput({ selectedThread, selectedThreadObj, sendMessage }: Props) {
  const [message, setMessage] = useState('')

  const placeholder = `Message ${selectedThreadObj?.is_private ? '' : '#'}${selectedThreadObj?.title ?? ''}...`

  function handleSend() {
    if (selectedThread && message.trim()) {
      sendMessage.mutate({ thread_id: selectedThread, body: message.trim() })
      setMessage('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          fullWidth size="small" multiline maxRows={4}
          placeholder={placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
        />
        <IconButton
          color="primary"
          disabled={!message.trim() || sendMessage.isPending}
          onClick={handleSend}
          sx={{
            bgcolor: 'primary.main', color: '#fff', width: 38, height: 38, flexShrink: 0,
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
          }}
        >
          {sendMessage.isPending ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
        </IconButton>
      </Stack>
      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block', fontSize: '0.7rem' }}>
        Enter to send · Shift+Enter for new line
      </Typography>
    </Box>
  )
}
