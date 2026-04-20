import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamChatApi } from '@/api/teamChat'
import { repairOrdersApi } from '@/api/repairOrders'
import type { TeamChatThread, TeamChatMessage, StaffMember } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useRealtime } from '@/hooks/useRealtime'
import { formatDate, formatTime, formatDateTime } from '@/lib/utils'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Autocomplete from '@mui/material/Autocomplete'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Stack from '@mui/material/Stack'
import { X, Plus, Send, Hash, Pencil, ChevronDown, ChevronRight, ChevronLeft, MessageSquare } from 'lucide-react'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#EF4444', '#06B6D4', '#F97316',
]

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ThreadDialogState = { open: boolean; title: string; memberIds: number[] }

interface TeamChatWidgetProps {
  open: boolean
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TeamChatWidget({ open, onClose }: TeamChatWidgetProps) {
  const { user, shop } = useAuth()
  const qc = useQueryClient()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'chat'>('sidebar')

  const [selectedThread, setSelectedThread] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [dialog, setDialog] = useState<ThreadDialogState>({ open: false, title: '', memberIds: [] })
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; threadId: number | null; title: string }>({
    open: false,
    threadId: null,
    title: '',
  })
  const [threadsOpen, setThreadsOpen] = useState(true)
  const [dmsOpen, setDmsOpen] = useState(true)
  const [dmDialog, setDmDialog] = useState<{ open: boolean; userId: number | null }>({ open: false, userId: null })

  // ── Queries ──

  const { data: threads = [], isFetching: loadingThreads } = useQuery<TeamChatThread[]>({
    queryKey: ['team_chat_threads'],
    queryFn: teamChatApi.listThreads,
    enabled: open,
    staleTime: 15_000,
  })

  const { data: messages = [], isLoading: loadingMessages } = useQuery<TeamChatMessage[]>({
    queryKey: ['team_chat_messages', selectedThread],
    queryFn: () => teamChatApi.listMessages(selectedThread as number),
    enabled: open && selectedThread != null,
    staleTime: 30_000,
  })

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff_list', shop?.id],
    queryFn: () => repairOrdersApi.staffList(shop?.id),
    enabled: !!shop?.id,
    staleTime: 60_000,
  })

  // ── Auto-select first thread ──

  useEffect(() => {
    if (open && threads.length > 0 && selectedThread == null) {
      setSelectedThread(threads[0].id)
    }
  }, [open, threads, selectedThread])

  // ── Mutations ──

  const createThread = useMutation({
    mutationFn: teamChatApi.createThread,
    onSuccess: (thread) => {
      setDialog({ open: false, title: '', memberIds: [] })
      qc.invalidateQueries({ queryKey: ['team_chat_threads'] })
      setSelectedThread(thread.id)
    },
  })

  const createDM = useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      const otherUser = staffById.get(userId)
      const title = otherUser?.name ?? `User #${userId}`
      return teamChatApi.createThread({ title, member_ids: [userId], is_private: true })
    },
    onSuccess: (thread) => {
      setDmDialog({ open: false, userId: null })
      qc.invalidateQueries({ queryKey: ['team_chat_threads'] })
      setSelectedThread(thread.id)
    },
  })

  const renameThread = useMutation({
    mutationFn: teamChatApi.updateThread,
    onSuccess: (thread) => {
      setRenameDialog({ open: false, threadId: null, title: '' })
      qc.setQueryData<TeamChatThread[]>(['team_chat_threads'], (old = []) =>
        old?.map((t) => (t.id === thread.id ? { ...t, title: thread.title } : t)) ?? [],
      )
      qc.invalidateQueries({ queryKey: ['team_chat_threads'] })
    },
  })

  const sendMessage = useMutation({
    mutationFn: teamChatApi.createMessage,
    onMutate: async ({ thread_id, body }) => {
      await qc.cancelQueries({ queryKey: ['team_chat_messages', thread_id] })
      const prev = qc.getQueryData<TeamChatMessage[]>(['team_chat_messages', thread_id])
      qc.setQueryData<TeamChatMessage[]>(
        ['team_chat_messages', thread_id],
        (old = []) => [
          ...old,
          { id: -Date.now(), thread_id, user_id: user?.id ?? 0, body, created_at: new Date().toISOString() },
        ],
      )
      setMessage('')
      return { prev }
    },
    onError: (_err, variables, context) => {
      qc.setQueryData(['team_chat_messages', variables.thread_id], context?.prev ?? [])
    },
    onSuccess: (newMsg, variables) => {
      qc.setQueryData<TeamChatMessage[]>(
        ['team_chat_messages', variables.thread_id],
        (old = []) => [...old.filter((m) => m.id > 0), newMsg],
      )
      qc.invalidateQueries({ queryKey: ['team_chat_threads'] })
    },
  })

  // ── Scroll to bottom ──

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, selectedThread])

  // ── Realtime ──

  const handleThreadRealtime = useCallback(
    (_payload: unknown) => {
      if (selectedThread == null) return
      qc.invalidateQueries({ queryKey: ['team_chat_messages', selectedThread] })
      qc.invalidateQueries({ queryKey: ['team_chat_threads'] })
    },
    [selectedThread, qc],
  )

  useRealtime(
    selectedThread ? `team_chat_thread_${selectedThread}` : null,
    handleThreadRealtime,
    open && selectedThread != null,
  )

  useRealtime(
    'team_chat_global',
    useCallback((_: unknown) => { qc.invalidateQueries({ queryKey: ['team_chat_threads'] }) }, [qc]),
    open,
  )

  // ── Derived data ──

  const selectedThreadObj = useMemo(
    () => threads.find((t) => t.id === selectedThread) ?? null,
    [threads, selectedThread],
  )

  const staffById = useMemo(() => {
    const map = new Map<number, StaffMember>()
    staffList.forEach((s) => map.set(s.id, s))
    return map
  }, [staffList])

  const memberName = useCallback((id: number) => staffById.get(id)?.name ?? `User #${id}`, [staffById])

  // Members: prefer thread.member_ids if available, else derive from message participants
  const threadMemberIds = useMemo(() => {
    if (selectedThreadObj?.member_ids?.length) return selectedThreadObj.member_ids
    const ids = Array.from(new Set(messages.map((m) => m.user_id)))
    return ids
  }, [selectedThreadObj, messages])

  const formatThreadParticipants = useCallback(
    (ids: number[]) => {
      if (!ids || ids.length === 0) return ''
      const uniqueIds = Array.from(new Set(ids))
      const otherIds = user?.id ? uniqueIds.filter((id) => id !== user.id) : uniqueIds
      const targetIds = otherIds.length > 0 ? otherIds : uniqueIds
      if (targetIds.length === 0) return ''
      if (otherIds.length === 0 && user?.id && uniqueIds.length === 1 && uniqueIds[0] === user.id) {
        return 'You'
      }
      const names = targetIds.map(memberName)
      const visibleNames = names.slice(0, 3)
      const extraCount = targetIds.length - visibleNames.length
      const label = visibleNames.join(', ')
      if (extraCount > 0) {
        return `${label} +${extraCount} more`
      }
      return label
    },
    [memberName, user?.id],
  )

  const regularThreads = useMemo(() => threads.filter((t) => !t.is_private), [threads])
  const dmThreads = useMemo(() => threads.filter((t) => t.is_private), [threads])

  // ── Key handler ──

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (selectedThread && message.trim()) {
        sendMessage.mutate({ thread_id: selectedThread, body: message.trim() })
      }
    }
  }

  // ── Thread list item renderer ──

  function renderThreadItem(thread: TeamChatThread, isDM: boolean) {
    const active = thread.id === selectedThread
    const resolvedMemberIds = thread.member_ids?.length
      ? thread.member_ids
      : thread.id === selectedThread
        ? threadMemberIds
        : []
    const participantsLabel = !isDM ? formatThreadParticipants(resolvedMemberIds) : ''
    return (
      <ListItem key={thread.id} disablePadding sx={{ mb: 0.25 }}>
        <ListItemButton
          selected={active}
          onClick={() => { setSelectedThread(thread.id); if (isMobile) setMobilePanel('chat') }}
          sx={{
            borderRadius: 1.5, py: 1, px: 1.25,
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%', minWidth: 0 }}>
            <Box sx={{
              mt: 0.15, width: 20, height: 20, borderRadius: 1, flexShrink: 0,
              bgcolor: active
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.text.secondary, 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isDM
                ? <MessageSquare size={11} color={active ? theme.palette.primary.main : theme.palette.text.secondary} />
                : <Hash size={11} color={active ? theme.palette.primary.main : theme.palette.text.secondary} />
              }
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                fontSize="0.83rem"
                fontWeight={active ? 700 : 500}
                color={active ? 'primary.main' : 'text.primary'}
                noWrap
              >
                {thread.title}
              </Typography>
              {participantsLabel && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  display="block"
                  sx={{ fontSize: '0.7rem', mt: 0.15 }}
                >
                  {participantsLabel}
                </Typography>
              )}
              {thread.last_message_preview && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  display="block"
                  sx={{ fontSize: '0.72rem', mt: participantsLabel ? 0.1 : 0.15 }}
                >
                  {thread.last_message_preview.slice(0, 32)}
                  {thread.last_message_preview.length > 32 ? '...' : ''}
                </Typography>
              )}
            </Box>
          </Box>
        </ListItemButton>
      </ListItem>
    )
  }

  // ── Render ──

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
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
          },
        }}
      >
        <Box data-tour-id="team-chat-drawer" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* ── Top bar ── */}
          <Box sx={{
            px: 2.5, py: 1.75,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            bgcolor: 'background.paper',
            borderBottom: '1px solid', borderColor: 'divider',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: 2,
                bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Send size={15} color="#fff" />
              </Box>
              <Box>
                <Typography fontWeight={800} fontSize="0.95rem" lineHeight={1.1}>Team Chat</Typography>
              
              </Box>
            </Box>
            <IconButton size="small" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </Box>

          {/* ── Body ── */}
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>

            {/* ── Sidebar ── */}
            <Box sx={{
              width: { xs: '100%', sm: 220 }, flexShrink: 0,
              borderRight: { sm: '1px solid' }, borderColor: 'divider',
              bgcolor: 'background.paper',
              display: { xs: mobilePanel === 'sidebar' ? 'flex' : 'none', sm: 'flex' }, flexDirection: 'column',
              overflowY: 'auto',
            }}>

              {/* ── Threads section ── */}
              <Box
                sx={{
                  px: 2, pt: 2, pb: 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', userSelect: 'none',
                }}
                onClick={() => setThreadsOpen((p) => !p)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {threadsOpen
                    ? <ChevronDown size={12} color={theme.palette.text.disabled} />
                    : <ChevronRight size={12} color={theme.palette.text.disabled} />
                  }
                  <Typography variant="caption" fontWeight={700} color="text.disabled"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.68rem' }}>
                    Threads
                  </Typography>
                </Box>
                <Tooltip title="New thread">
                  <IconButton
                    size="small"
                    sx={{ p: 0.35 }}
                    onClick={(e) => { e.stopPropagation(); setDialog((p) => ({ ...p, open: true })) }}
                  >
                    <Plus size={13} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Collapse in={threadsOpen}>
                {loadingThreads ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={18} />
                  </Box>
                ) : (
                  <List dense disablePadding sx={{ px: 1 }}>
                    {regularThreads.map((thread) => renderThreadItem(thread, false))}
                    {regularThreads.length === 0 && (
                      <Box sx={{ px: 1.5, py: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled">
                          No threads yet.
                        </Typography>
                        <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5, cursor: 'pointer' }}
                          onClick={() => setDialog((p) => ({ ...p, open: true }))}>
                          Create the first one →
                        </Typography>
                      </Box>
                    )}
                  </List>
                )}
              </Collapse>

              {/* ── Direct Messages section ── */}
              <Box
                sx={{
                  px: 2, pt: 1.5, pb: 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', userSelect: 'none',
                  borderTop: '1px solid', borderColor: 'divider',
                  mt: 0.5,
                }}
                onClick={() => setDmsOpen((p) => !p)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {dmsOpen
                    ? <ChevronDown size={12} color={theme.palette.text.disabled} />
                    : <ChevronRight size={12} color={theme.palette.text.disabled} />
                  }
                  <Typography variant="caption" fontWeight={700} color="text.disabled"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.68rem' }}>
                    Direct Messages
                  </Typography>
                </Box>
                <Tooltip title="New direct message">
                  <IconButton
                    size="small"
                    sx={{ p: 0.35 }}
                    onClick={(e) => { e.stopPropagation(); setDmDialog({ open: true, userId: null }) }}
                  >
                    <Plus size={13} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Collapse in={dmsOpen}>
                <List dense disablePadding sx={{ px: 1 }}>
                  {dmThreads.map((thread) => renderThreadItem(thread, true))}
                  {dmThreads.length === 0 && (
                    <Box sx={{ px: 1.5, py: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.disabled">
                        No direct messages yet.
                      </Typography>
                      <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5, cursor: 'pointer' }}
                        onClick={() => setDmDialog({ open: true, userId: null })}>
                        Start one →
                      </Typography>
                    </Box>
                  )}
                </List>
              </Collapse>
            </Box>

            {/* ── Chat pane ── */}
            <Box sx={{ flex: 1, display: { xs: mobilePanel === 'chat' ? 'flex' : 'none', sm: 'flex' }, flexDirection: 'column', minWidth: 0 }}>

              {selectedThread == null ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Box sx={{
                      width: 48, height: 48, borderRadius: 3,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mx: 'auto', mb: 1.5,
                    }}>
                      <Hash size={22} color={theme.palette.primary.main} />
                    </Box>
                    <Typography fontWeight={600} fontSize="0.95rem">Pick a thread</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Select a thread from the sidebar or create a new one.
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <>
                  {/* ── Thread header ── */}
                  <Box sx={{
                    px: 2.5, py: 1.75,
                    bgcolor: 'background.paper',
                    borderBottom: '1px solid', borderColor: 'divider',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                      {isMobile && (
                        <IconButton size="small" onClick={() => setMobilePanel('sidebar')} sx={{ flexShrink: 0, color: 'text.secondary' }}>
                          <ChevronLeft size={18} />
                        </IconButton>
                      )}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {selectedThreadObj?.is_private
                            ? <MessageSquare size={16} color={theme.palette.primary.main} />
                            : <Hash size={16} color={theme.palette.primary.main} />
                          }
                          <Typography fontWeight={800} fontSize="1rem" noWrap>
                            {selectedThreadObj?.title ?? ''}
                          </Typography>
                        </Box>

                        {/* Members row */}
                        {threadMemberIds.length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                            <AvatarGroup
                              max={5}
                              sx={{
                                '& .MuiAvatar-root': {
                                  width: 22, height: 22, fontSize: '0.6rem', fontWeight: 700,
                                  border: '2px solid',
                                  borderColor: 'background.paper',
                                },
                              }}
                            >
                              {threadMemberIds.map((id) => (
                                <Tooltip key={id} title={memberName(id)} arrow>
                                  <Avatar
                                    sx={{ bgcolor: avatarColor(id), width: 22, height: 22, fontSize: '0.6rem', fontWeight: 700 }}
                                  >
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Rename">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() =>
                                setRenameDialog({
                                  open: true,
                                  threadId: selectedThreadObj?.id ?? null,
                                  title: selectedThreadObj?.title ?? '',
                                })
                              }
                              disabled={!selectedThreadObj}
                            >
                              <Pencil size={15} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>

                  {/* ── Messages ── */}
                  <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }} ref={scrollRef}>
                    {loadingMessages ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : messages.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Typography variant="body2" color="text.disabled">
                          No messages yet — say hello!
                        </Typography>
                      </Box>
                    ) : (
                      messages.map((msg, idx) => {
                        const mine = msg.user_id === user?.id
                        const prev = messages[idx - 1]
                        const isFirst = !prev || prev.user_id !== msg.user_id
                        const name = memberName(msg.user_id)
                        const isOptimistic = msg.id < 0

                        return (
                          <Box
                            key={msg.id}
                            sx={{
                              display: 'flex',
                              flexDirection: mine ? 'row-reverse' : 'row',
                              alignItems: 'flex-end',
                              gap: 1,
                              mb: isFirst ? 1.5 : 0.4,
                              mt: isFirst && idx > 0 ? 1.5 : 0,
                            }}
                          >
                            {/* Avatar (others only, shown only on first in group) */}
                            {!mine && (
                              <Box sx={{ width: 30, flexShrink: 0, mb: 0.25 }}>
                                {isFirst && (
                                  <Avatar sx={{
                                    width: 30, height: 30,
                                    bgcolor: avatarColor(msg.user_id),
                                    fontSize: '0.65rem', fontWeight: 700,
                                  }}>
                                    {initials(name)}
                                  </Avatar>
                                )}
                              </Box>
                            )}

                            <Box sx={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                              {/* Name + time on first message in group */}
                              {isFirst && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.72rem',
                                    color: 'text.secondary',
                                    mb: 0.35,
                                    px: 0.5,
                                  }}
                                >
                                  {mine ? 'You' : name}
                                  {' \u00b7 '}
                                  {formatDate(msg.created_at)}
                                  {msg.created_at ? ` at ${formatTime(msg.created_at)}` : ''}
                                </Typography>
                              )}

                              {/* Bubble */}
                              <Tooltip
                                title={msg.created_at ? formatDateTime(msg.created_at) : '\u2014'}
                                placement={mine ? 'left' : 'right'}
                                arrow
                              >
                                <Box sx={{
                                  px: 1.5, py: 0.875,
                                  borderRadius: mine
                                    ? '14px 14px 4px 14px'
                                    : '14px 14px 14px 4px',
                                  bgcolor: mine
                                    ? 'primary.main'
                                    : isDark ? alpha('#ffffff', 0.08) : alpha('#000000', 0.06),
                                  color: mine ? 'primary.contrastText' : 'text.primary',
                                  opacity: isOptimistic ? 0.65 : 1,
                                  transition: 'opacity 0.2s',
                                }}>
                                  <Typography variant="body2" sx={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {msg.body}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            </Box>
                          </Box>
                        )
                      })
                    )}
                  </Box>

                  {/* ── Input ── */}
                  <Box sx={{
                    px: 2.5, py: 2,
                    borderTop: '1px solid', borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}>
                    <Stack direction="row" spacing={1} alignItems="flex-end">
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        maxRows={4}
                        placeholder={`Message ${selectedThreadObj?.is_private ? '' : '#'}${selectedThreadObj?.title ?? ''}...`}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
                        }}
                      />
                      <IconButton
                        color="primary"
                        disabled={!message.trim() || sendMessage.isPending}
                        onClick={() => selectedThread && message.trim() &&
                          sendMessage.mutate({ thread_id: selectedThread, body: message.trim() })}
                        sx={{
                          bgcolor: 'primary.main', color: '#fff',
                          width: 38, height: 38, flexShrink: 0,
                          '&:hover': { bgcolor: 'primary.dark' },
                          '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                        }}
                      >
                        {sendMessage.isPending
                          ? <CircularProgress size={16} color="inherit" />
                          : <Send size={16} />
                        }
                      </IconButton>
                    </Stack>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block', fontSize: '0.7rem' }}>
                      Enter to send · Shift+Enter for new line
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* ── Create thread dialog ── */}
      <Dialog
        open={dialog.open}
        onClose={() => setDialog((p) => ({ ...p, open: false }))}
        fullWidth maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography fontWeight={800} fontSize="1rem">New Thread</Typography>
          <IconButton size="small" onClick={() => setDialog((p) => ({ ...p, open: false }))}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Thread name"
            value={dialog.title}
            onChange={(e) => setDialog((p) => ({ ...p, title: e.target.value }))}
            autoFocus
          />
          <Autocomplete
            multiple
            options={staffList}
            getOptionLabel={(option) => option.name}
            value={staffList.filter((s) => dialog.memberIds.includes(s.id))}
            onChange={(_, value) =>
              setDialog((p) => ({ ...p, memberIds: value.map((s) => s.id) }))
            }
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
              <TextField {...params} label="Invite teammates" placeholder="Select team members" />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialog((p) => ({ ...p, open: false }))}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createThread.mutate({ title: dialog.title.trim(), member_ids: dialog.memberIds })}
            disabled={!dialog.title.trim() || createThread.isPending}
            startIcon={createThread.isPending ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Create Thread
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Rename thread dialog ── */}
      <Dialog
        open={renameDialog.open}
        onClose={() => setRenameDialog({ open: false, threadId: null, title: '' })}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography fontWeight={800} fontSize="1rem">Rename Thread</Typography>
          <IconButton size="small" onClick={() => setRenameDialog({ open: false, threadId: null, title: '' })}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <TextField
            label="Thread name"
            value={renameDialog.title}
            onChange={(e) => setRenameDialog((p) => ({ ...p, title: e.target.value }))}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRenameDialog({ open: false, threadId: null, title: '' })}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              !renameDialog.title.trim() || renameDialog.threadId == null || renameThread.isPending
            }
            startIcon={renameThread.isPending ? <CircularProgress size={14} color="inherit" /> : null}
            onClick={() => {
              if (renameDialog.threadId) {
                renameThread.mutate({
                  thread_id: renameDialog.threadId,
                  title: renameDialog.title.trim(),
                })
              }
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── New DM dialog ── */}
      <Dialog
        open={dmDialog.open}
        onClose={() => setDmDialog({ open: false, userId: null })}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography fontWeight={800} fontSize="1rem">New Direct Message</Typography>
          <IconButton size="small" onClick={() => setDmDialog({ open: false, userId: null })}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Autocomplete
            options={staffList.filter((s) => s.id !== user?.id)}
            getOptionLabel={(option) => option.name}
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
          <Button onClick={() => setDmDialog({ open: false, userId: null })}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!dmDialog.userId || createDM.isPending}
            startIcon={createDM.isPending ? <CircularProgress size={14} color="inherit" /> : null}
            onClick={() => { if (dmDialog.userId) createDM.mutate({ userId: dmDialog.userId }) }}
          >
            Start DM
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
