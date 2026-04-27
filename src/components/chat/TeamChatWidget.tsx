import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { X, Send, Hash } from 'lucide-react'

import { useChatState } from './useChatState'
import ThreadSidebar from './ThreadSidebar'
import ThreadHeader from './ThreadHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import CreateThreadDialog from './dialogs/CreateThreadDialog'
import AddMembersDialog from './dialogs/AddMembersDialog'
import RenameThreadDialog from './dialogs/RenameThreadDialog'
import NewDMDialog from './dialogs/NewDMDialog'

interface TeamChatWidgetProps {
  open: boolean
  onClose: () => void
}

export default function TeamChatWidget({ open, onClose }: TeamChatWidgetProps) {
  const theme    = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const s        = useChatState(open)

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '85%', md: 940 },
            maxWidth: 1100,
            display: 'flex', flexDirection: 'column',
            bgcolor: 'background.default',
          },
        }}
      >
        <Box data-tour-id="team-chat-drawer" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Top bar */}
          <Box sx={{
            px: 2.5, py: 1.75,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={15} color="#fff" />
              </Box>
              <Typography fontWeight={800} fontSize="0.95rem">Team Chat</Typography>
            </Box>
            <IconButton size="small" onClick={onClose}><X size={16} /></IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>

            {/* Sidebar — hidden on mobile when chat panel is active */}
            <Box sx={{ display: { xs: s.mobilePanel === 'sidebar' ? 'flex' : 'none', sm: 'flex' } }}>
              <ThreadSidebar
                regularThreads={s.regularThreads}
                dmThreads={s.dmThreads}
                loadingThreads={s.loadingThreads}
                selectedThread={s.selectedThread}
                threadMemberIds={s.threadMemberIds}
                threadsOpen={s.threadsOpen}
                setThreadsOpen={s.setThreadsOpen}
                dmsOpen={s.dmsOpen}
                setDmsOpen={s.setDmsOpen}
                setDialog={s.setDialog}
                setDmDialog={s.setDmDialog}
                onSelectThread={(id) => {
                  s.setSelectedThread(id)
                  if (isMobile) s.setMobilePanel('chat')
                }}
                formatThreadParticipants={s.formatThreadParticipants}
                currentUserId={s.user?.id}
                memberName={s.memberName}
                activeUserIds={s.activeUserIds}
              />
            </Box>

            {/* Chat pane — hidden on mobile when sidebar is active */}
            <Box sx={{
              flex: 1, minWidth: 0, flexDirection: 'column',
              display: { xs: s.mobilePanel === 'chat' ? 'flex' : 'none', sm: 'flex' },
            }}>
              {s.selectedThread == null ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ textAlign: 'center', px: 3 }}>
                    <Box sx={{
                      width: 56, height: 56, borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mx: 'auto', mb: 2,
                    }}>
                      <Hash size={24} color={theme.palette.primary.main} />
                    </Box>
                    <Typography fontWeight={700} fontSize="1rem" mb={0.5}>
                      Select a conversation
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 240, mx: 'auto', lineHeight: 1.5 }}>
                      Choose a thread or direct message from the sidebar, or start a new one.
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <>
                  <ThreadHeader
                    selectedThreadObj={s.selectedThreadObj}
                    selectedThread={s.selectedThread}
                    threadMemberIds={s.threadMemberIds}
                    nonMembers={s.nonMembers}
                    memberName={s.memberName}
                    currentUserId={s.user?.id}
                    pinThread={s.pinThread}
                    setRenameDialog={s.setRenameDialog}
                    setAddMembersDialog={s.setAddMembersDialog}
                    onBackToSidebar={() => s.setMobilePanel('sidebar')}
                  />
                  <MessageList
                    messages={s.messages}
                    loadingMessages={s.loadingMessages}
                    hasNextPage={s.hasNextPage}
                    isFetchingNextPage={s.isFetchingNextPage}
                    currentUserId={s.user?.id}
                    memberName={s.memberName}
                    scrollRef={s.scrollRef}
                    topSentinelRef={s.topSentinelRef}
                    onScroll={s.handleScroll}
                    onLoadMore={s.onLoadMore}
                  />
                  <MessageInput
                    selectedThread={s.selectedThread}
                    selectedThreadObj={s.selectedThreadObj}
                    sendMessage={s.sendMessage}
                  />
                </>
              )}
            </Box>
          </Box>
        </Box>
      </Drawer>

      <CreateThreadDialog
        dialog={s.dialog}
        setDialog={s.setDialog}
        staffList={s.staffList}
        currentUserId={s.user?.id}
        createThread={s.createThread}
      />
      <AddMembersDialog
        addMembersDialog={s.addMembersDialog}
        setAddMembersDialog={s.setAddMembersDialog}
        nonMembers={s.nonMembers}
        addMembers={s.addMembers}
      />
      <RenameThreadDialog
        renameDialog={s.renameDialog}
        setRenameDialog={s.setRenameDialog}
        renameThread={s.renameThread}
      />
      <NewDMDialog
        dmDialog={s.dmDialog}
        setDmDialog={s.setDmDialog}
        staffList={s.staffList}
        currentUserId={s.user?.id}
        createDM={s.createDM}
      />
    </>
  )
}
