import type { UseMutationResult } from '@tanstack/react-query'
import type { TeamChatThread, StaffMember } from '@/types'
import type { RenameDialogState, AddMembersDialogState } from './useChatState'
import type { PinThreadInput } from '@/api/teamChat'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Chip from '@mui/material/Chip'
import { Hash, MessageSquare, Pencil, UserPlus, Pin, PinOff, ChevronLeft } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { avatarColor, initials } from './helpers'

interface Props {
  selectedThreadObj: TeamChatThread | null
  selectedThread: number | null
  threadMemberIds: number[]
  nonMembers: StaffMember[]
  memberName: (id: number) => string
  currentUserId?: number
  pinThread: UseMutationResult<TeamChatThread, any, PinThreadInput, any>
  setRenameDialog: React.Dispatch<React.SetStateAction<RenameDialogState>>
  setAddMembersDialog: React.Dispatch<React.SetStateAction<AddMembersDialogState>>
  onBackToSidebar: () => void
}

export default function ThreadHeader({
  selectedThreadObj, selectedThread, threadMemberIds, nonMembers,
  memberName, currentUserId, pinThread, setRenameDialog, setAddMembersDialog, onBackToSidebar,
}: Props) {
  const theme    = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isPinned = selectedThreadObj?.is_pinned ?? false

  const displayTitle = selectedThreadObj?.is_private
    ? (() => {
        const otherId = (selectedThreadObj.member_ids ?? []).find((id) => id !== currentUserId)
        return otherId != null ? memberName(otherId) : selectedThreadObj.title
      })()
    : selectedThreadObj?.title ?? ''

  return (
    <Box sx={{ px: 2.5, py: 1.75, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        {isMobile && (
          <IconButton size="small" onClick={onBackToSidebar} sx={{ flexShrink: 0, color: 'text.secondary' }}>
            <ChevronLeft size={18} />
          </IconButton>
        )}

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {selectedThreadObj?.is_private
              ? <MessageSquare size={16} color={theme.palette.primary.main} />
              : <Hash size={16} color={theme.palette.primary.main} />
            }
            <Typography fontWeight={800} fontSize="1rem" noWrap>{displayTitle}</Typography>
            {isPinned && (
              <Chip label="Pinned" size="small" icon={<Pin size={10} />}
                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'warning.light', color: 'warning.dark', '& .MuiChip-icon': { color: 'warning.dark' } }} />
            )}
          </Box>

          {threadMemberIds.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
              <AvatarGroup max={5} sx={{ '& .MuiAvatar-root': { width: 22, height: 22, fontSize: '0.6rem', fontWeight: 700, border: '2px solid', borderColor: 'background.paper' } }}>
                {threadMemberIds.map((id) => (
                  <Tooltip key={id} title={memberName(id)} arrow>
                    <Avatar sx={{ bgcolor: avatarColor(id), width: 22, height: 22, fontSize: '0.6rem', fontWeight: 700 }}>
                      {initials(memberName(id))}
                    </Avatar>
                  </Tooltip>
                ))}
              </AvatarGroup>
              <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
                {threadMemberIds.length === 1
                  ? memberName(threadMemberIds[0])
                  : threadMemberIds.slice(0, 3).map(memberName).join(', ')
                    + (threadMemberIds.length > 3 ? ` +${threadMemberIds.length - 3} more` : '')
                }
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {!selectedThreadObj?.is_private && (
            <Tooltip title="Add members">
              <span>
                <IconButton size="small"
                  disabled={!selectedThreadObj || nonMembers.length === 0}
                  onClick={() => setAddMembersDialog({ open: true, threadId: selectedThread, userIds: [] })}>
                  <UserPlus size={15} />
                </IconButton>
              </span>
            </Tooltip>
          )}

          <Tooltip title={isPinned ? 'Unpin thread' : 'Pin thread'}>
            <span>
              <IconButton size="small" disabled={!selectedThreadObj || pinThread.isPending}
                onClick={() => selectedThreadObj && pinThread.mutate({ thread_id: selectedThreadObj.id, is_pinned: !isPinned })}>
                {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Rename">
            <span>
              <IconButton size="small" disabled={!selectedThreadObj}
                onClick={() => setRenameDialog({ open: true, threadId: selectedThreadObj?.id ?? null, title: selectedThreadObj?.title ?? '' })}>
                <Pencil size={15} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  )
}
