import type { TeamChatThread } from '@/types'
import type { ThreadDialogState, DmDialogState } from './useChatState'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import CircularProgress from '@mui/material/CircularProgress'
import { Plus, Hash, ChevronDown, ChevronRight, MessageSquare, Pin } from 'lucide-react'
import { alpha, useTheme } from '@mui/material/styles'
import { relativeTime } from './helpers'

interface Props {
  regularThreads: TeamChatThread[]
  dmThreads: TeamChatThread[]
  loadingThreads: boolean
  selectedThread: number | null
  threadMemberIds: number[]
  threadsOpen: boolean
  setThreadsOpen: (v: boolean | ((p: boolean) => boolean)) => void
  dmsOpen: boolean
  setDmsOpen: (v: boolean | ((p: boolean) => boolean)) => void
  setDialog: React.Dispatch<React.SetStateAction<ThreadDialogState>>
  setDmDialog: React.Dispatch<React.SetStateAction<DmDialogState>>
  onSelectThread: (id: number) => void
  formatThreadParticipants: (ids: number[]) => string
  currentUserId?: number
  memberName: (id: number) => string
  activeUserIds?: Set<number>
}

export default function ThreadSidebar({
  regularThreads, dmThreads, loadingThreads,
  selectedThread, threadMemberIds,
  threadsOpen, setThreadsOpen,
  dmsOpen, setDmsOpen,
  setDialog, setDmDialog,
  onSelectThread, formatThreadParticipants,
  currentUserId, memberName, activeUserIds = new Set(),
}: Props) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  function ThreadItem({ thread, isDM }: { thread: TeamChatThread; isDM: boolean }) {
    const active = thread.id === selectedThread
    const resolvedIds = thread.member_ids?.length
      ? thread.member_ids
      : thread.id === selectedThread ? threadMemberIds : []
    const isUnread = !active &&
      !!thread.last_message_at &&
      (thread.last_read_at == null || thread.last_message_at > thread.last_read_at)

    const otherId = isDM ? resolvedIds.find((id) => id !== currentUserId) : undefined
    const isOnline = otherId != null ? activeUserIds.has(otherId) : false

    const displayTitle = isDM
      ? (otherId != null ? memberName(otherId) : thread.title)
      : thread.title

    const preview = thread.last_message_preview
    const timestamp = relativeTime(thread.last_message_at)

    return (
      <ListItem disablePadding sx={{ mb: 0.25 }}>
        <ListItemButton
          selected={active}
          onClick={() => onSelectThread(thread.id)}
          sx={{
            borderRadius: 1.5, py: 0.9, px: 1.25,
            alignItems: 'flex-start',
            '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1) },
          }}
        >
          {/* Left icon with online dot for DMs */}
          <Box sx={{ position: 'relative', flexShrink: 0, mt: 0.15, mr: 1 }}>
            {isDM
              ? <MessageSquare size={15} color={active ? theme.palette.primary.main : theme.palette.text.secondary} />
              : <Hash size={15} color={active ? theme.palette.primary.main : theme.palette.text.secondary} />
            }
            {isDM && (
              <Box sx={{
                position: 'absolute', bottom: -2, right: -3,
                width: 7, height: 7, borderRadius: '50%',
                bgcolor: isOnline ? '#22c55e' : alpha(theme.palette.text.disabled, 0.35),
                border: `1.5px solid ${theme.palette.background.paper}`,
              }} />
            )}
          </Box>

          {/* Content */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {/* Title row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: preview ? 0.2 : 0 }}>
              <Typography
                fontSize="0.82rem"
                fontWeight={isUnread ? 700 : active ? 600 : 500}
                color={active ? 'primary.main' : 'text.primary'}
                noWrap
                sx={{ flex: 1 }}
              >
                {displayTitle}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                {timestamp && (
                  <Typography
                    fontSize="0.67rem"
                    color={isUnread ? 'primary.main' : 'text.disabled'}
                    fontWeight={isUnread ? 700 : 400}
                  >
                    {timestamp}
                  </Typography>
                )}
                {thread.is_pinned && (
                  <Tooltip title="Pinned" arrow>
                    <Pin size={9} color={theme.palette.warning.main} />
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Preview row */}
            {preview ? (
              <Typography
                fontSize="0.72rem"
                color={isUnread ? 'text.primary' : 'text.secondary'}
                fontWeight={isUnread ? 500 : 400}
                noWrap
                sx={{ opacity: isUnread ? 1 : 0.75 }}
              >
                {preview}
              </Typography>
            ) : !isDM && resolvedIds.length > 0 ? (
              <Typography fontSize="0.7rem" color="text.disabled" noWrap>
                {formatThreadParticipants(resolvedIds)}
              </Typography>
            ) : null}
          </Box>

          {/* Unread dot */}
          {isUnread && (
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main',
              flexShrink: 0, mt: 0.6, ml: 0.5,
            }} />
          )}
        </ListItemButton>
      </ListItem>
    )
  }

  function SectionHeader({
    label, open, onToggle, onAdd, addTooltip,
  }: {
    label: string
    open: boolean
    onToggle: () => void
    onAdd: (e: React.MouseEvent) => void
    addTooltip: string
  }) {
    return (
      <Box
        sx={{
          px: 1.5, pt: 1.25, pb: 0.4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {open
            ? <ChevronDown size={11} color={theme.palette.text.disabled} />
            : <ChevronRight size={11} color={theme.palette.text.disabled} />
          }
          <Typography
            variant="caption" fontWeight={700} color="text.disabled"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.67rem' }}
          >
            {label}
          </Typography>
        </Box>
        <Tooltip title={addTooltip}>
          <IconButton size="small" sx={{ p: 0.3 }} onClick={(e) => { e.stopPropagation(); onAdd(e) }}>
            <Plus size={13} />
          </IconButton>
        </Tooltip>
      </Box>
    )
  }

  return (
    <Box sx={{
      width: { xs: '100%', sm: 240 }, flexShrink: 0,
      borderRight: { sm: '1px solid' }, borderColor: 'divider',
      bgcolor: isDark ? alpha('#ffffff', 0.02) : alpha('#000000', 0.015),
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Threads section */}
      <SectionHeader
        label="Threads"
        open={threadsOpen}
        onToggle={() => setThreadsOpen((p) => !p)}
        onAdd={() => setDialog((p) => ({ ...p, open: true }))}
        addTooltip="New thread"
      />

      <Collapse in={threadsOpen}>
        {loadingThreads ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} /></Box>
        ) : (
          <List dense disablePadding sx={{ px: 0.75 }}>
            {regularThreads.map((t) => <ThreadItem key={t.id} thread={t} isDM={false} />)}
            {regularThreads.length === 0 && (
              <Box sx={{ px: 1.5, py: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.disabled">No threads yet.</Typography>
                <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5, cursor: 'pointer' }}
                  onClick={() => setDialog((p) => ({ ...p, open: true }))}>
                  Create the first one →
                </Typography>
              </Box>
            )}
          </List>
        )}
      </Collapse>

      {/* DMs section */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }}>
        <SectionHeader
          label="Direct Messages"
          open={dmsOpen}
          onToggle={() => setDmsOpen((p) => !p)}
          onAdd={() => setDmDialog({ open: true, userId: null })}
          addTooltip="New direct message"
        />
      </Box>

      <Collapse in={dmsOpen}>
        <List dense disablePadding sx={{ px: 0.75 }}>
          {dmThreads.map((t) => <ThreadItem key={t.id} thread={t} isDM={true} />)}
          {dmThreads.length === 0 && (
            <Box sx={{ px: 1.5, py: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled">No direct messages yet.</Typography>
              <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5, cursor: 'pointer' }}
                onClick={() => setDmDialog({ open: true, userId: null })}>
                Start one →
              </Typography>
            </Box>
          )}
        </List>
      </Collapse>
    </Box>
  )
}
