import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { teamChatApi, type MessagesPage } from '@/api/teamChat'
import { repairOrdersApi } from '@/api/repairOrders'
import type { TeamChatThread, TeamChatMessage, StaffMember } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useRealtime } from '@/hooks/useRealtime'
import { usePresence } from '@/hooks/usePresence'

export type ThreadDialogState   = { open: boolean; title: string; memberIds: number[] }
export type RenameDialogState   = { open: boolean; threadId: number | null; title: string }
export type AddMembersDialogState = { open: boolean; threadId: number | null; userIds: number[] }
export type DmDialogState       = { open: boolean; userId: number | null }

export function useChatState(open: boolean) {
  const { user, shop } = useAuth()
  const qc = useQueryClient()
  const activeUserIds = usePresence()

  // ── UI state ──
  const [selectedThread, setSelectedThread] = useState<number | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'chat'>('sidebar')
  const [threadsOpen, setThreadsOpen] = useState(true)
  const [dmsOpen, setDmsOpen] = useState(true)

  // ── Dialog state ──
  const [dialog, setDialog]               = useState<ThreadDialogState>({ open: false, title: '', memberIds: [] })
  const [renameDialog, setRenameDialog]   = useState<RenameDialogState>({ open: false, threadId: null, title: '' })
  const [addMembersDialog, setAddMembersDialog] = useState<AddMembersDialogState>({ open: false, threadId: null, userIds: [] })
  const [dmDialog, setDmDialog]           = useState<DmDialogState>({ open: false, userId: null })

  // ── Queries ──

  // Threads are pre-fetched by useTeamChatGlobal in AppShell — this just reads from cache
  const { data: threads = [], isFetching: loadingThreads } = useQuery<TeamChatThread[]>({
    queryKey: ['team_chat_threads'],
    queryFn: teamChatApi.listThreads,
    enabled: !!user,
    staleTime: 60_000,
  })

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingMessages,
  } = useInfiniteQuery({
    queryKey: ['team_chat_messages', selectedThread],
    queryFn: ({ pageParam }: { pageParam: number | undefined }) =>
      teamChatApi.listMessages(selectedThread as number, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage: MessagesPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
    enabled: open && selectedThread != null,
    staleTime: 30_000,
  })

  // Flat chronological list — pages[0] is most recent, reverse for display
  const messages = useMemo<TeamChatMessage[]>(() => {
    if (!messagesData) return []
    const all = [...messagesData.pages].reverse().flatMap((p) => p.items)
    const seen = new Map<number, TeamChatMessage>()
    for (const msg of all) seen.set(msg.id, msg)
    return Array.from(seen.values())
  }, [messagesData])

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

  // ── Mark thread as read when selected ──
  useEffect(() => {
    if (selectedThread == null) return
    teamChatApi.markRead(selectedThread).catch(() => {})
    const now = new Date().toISOString()
    qc.setQueryData<TeamChatThread[]>(['team_chat_threads'], (old = []) =>
      old.map((t) => t.id === selectedThread ? { ...t, last_read_at: now } : t),
    )
  }, [selectedThread, qc])

  // ── Scroll refs ──
  const scrollRef           = useRef<HTMLDivElement>(null)
  const topSentinelRef      = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  const loadingMoreRef      = useRef(false)
  const isAtBottomRef       = useRef(true)

  useLayoutEffect(() => {
    isAtBottomRef.current  = true
    loadingMoreRef.current = false
  }, [selectedThread])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (loadingMoreRef.current) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current
      loadingMoreRef.current = false
      return
    }
    if (isAtBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // Called by MessageList's IntersectionObserver when the top sentinel is visible
  const onLoadMore = useCallback(() => {
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight
      loadingMoreRef.current = true
    }
    fetchNextPage()
  }, [fetchNextPage])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }

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
      return teamChatApi.createThread({
        title: otherUser?.name ?? `User #${userId}`,
        member_ids: [userId],
        is_private: true,
      })
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
        old.map((t) => (t.id === thread.id ? { ...t, title: thread.title } : t)),
      )
    },
  })

  const addMembers = useMutation({
    mutationFn: teamChatApi.addMembers,
    onSuccess: () => {
      setAddMembersDialog({ open: false, threadId: null, userIds: [] })
      qc.invalidateQueries({ queryKey: ['team_chat_threads'] })
    },
  })

  const pinThread = useMutation({
    mutationFn: teamChatApi.pinThread,
    onSuccess: (updated) => {
      qc.setQueryData<TeamChatThread[]>(['team_chat_threads'], (old = []) =>
        old.map((t) => (t.id === updated.id ? { ...t, is_pinned: updated.is_pinned } : t)),
      )
    },
  })

  const sendMessage = useMutation({
    mutationFn: teamChatApi.createMessage,
    onMutate: async ({ thread_id, body }) => {
      await qc.cancelQueries({ queryKey: ['team_chat_messages', thread_id] })
      const prev = qc.getQueryData(['team_chat_messages', thread_id])
      const tempMsg: TeamChatMessage = {
        id: -Date.now(), thread_id, user_id: user?.id ?? 0, body,
        created_at: new Date().toISOString(),
      }
      isAtBottomRef.current = true
      qc.setQueryData<InfiniteData<MessagesPage>>(['team_chat_messages', thread_id], (old) => {
        if (!old) return old
        const pages = [...old.pages]
        pages[0] = { ...pages[0], items: [...pages[0].items, tempMsg] }
        return { ...old, pages }
      })
      return { prev }
    },
    onError: (_err, variables, context) => {
      qc.setQueryData(['team_chat_messages', variables.thread_id], context?.prev)
    },
    onSuccess: (newMsg, variables) => {
      qc.setQueryData<InfiniteData<MessagesPage>>(['team_chat_messages', variables.thread_id], (old) => {
        if (!old) return old
        const pages = [...old.pages]
        pages[0] = { ...pages[0], items: [...pages[0].items.filter((m) => m.id > 0 && m.id !== newMsg.id), newMsg] }
        return { ...old, pages }
      })
      qc.setQueryData<TeamChatThread[]>(['team_chat_threads'], (old = []) =>
        old.map((t) => t.id === variables.thread_id
          ? { ...t, last_message_preview: newMsg.body, last_message_at: newMsg.created_at }
          : t),
      )
    },
  })

  // ── Realtime ──

  const handleThreadRealtime = useCallback((payload: unknown) => {
    if (selectedThread == null) return
    const newMsg = payload as TeamChatMessage
    if (!newMsg?.id || !newMsg?.body) return
    // Own messages are handled by sendMessage onMutate/onSuccess — skip to avoid duplicates
    if (newMsg.user_id === user?.id) return
    qc.setQueryData<InfiniteData<MessagesPage>>(['team_chat_messages', selectedThread], (old) => {
      if (!old) return old
      const existingIds = new Set(old.pages.flatMap((p) => p.items.map((m) => m.id)))
      if (existingIds.has(newMsg.id)) return old
      const pages = [...old.pages]
      pages[0] = { ...pages[0], items: [...pages[0].items, newMsg] }
      return { ...old, pages }
    })
    qc.setQueryData<TeamChatThread[]>(['team_chat_threads'], (old = []) =>
      old.map((t) => t.id === newMsg.thread_id
        ? { ...t, last_message_preview: newMsg.body, last_message_at: newMsg.created_at }
        : t),
    )
  }, [selectedThread, qc])

  useRealtime(
    selectedThread ? `team_chat_thread/${selectedThread}` : null,
    handleThreadRealtime,
    open && selectedThread != null,
  )

  // ── Derived ──

  const staffById = useMemo(() => {
    const map = new Map<number, StaffMember>()
    staffList.forEach((s) => map.set(s.id, s))
    return map
  }, [staffList])

  const memberName = useCallback((id: number) => staffById.get(id)?.name ?? `User #${id}`, [staffById])

  const selectedThreadObj = useMemo(
    () => threads.find((t) => t.id === selectedThread) ?? null,
    [threads, selectedThread],
  )

  const threadMemberIds = useMemo(() => {
    if (selectedThreadObj?.member_ids?.length) return selectedThreadObj.member_ids
    return Array.from(new Set(messages.map((m) => m.user_id)))
  }, [selectedThreadObj, messages])

  const formatThreadParticipants = useCallback((ids: number[]) => {
    if (!ids?.length) return ''
    const unique = Array.from(new Set(ids))
    const others = user?.id ? unique.filter((id) => id !== user.id) : unique
    const target = others.length > 0 ? others : unique
    if (!target.length) return ''
    const first = memberName(target[0])
    const remaining = target.length - 1
    return remaining > 0 ? `${first}, and ${remaining} more` : first
  }, [memberName, user?.id])

  const regularThreads = useMemo(() => threads.filter((t) => !t.is_private), [threads])
  const dmThreads      = useMemo(() => threads.filter((t) =>  t.is_private), [threads])

  const nonMembers = useMemo(() => {
    const currentIds = new Set(threadMemberIds)
    return staffList.filter((s) => !currentIds.has(s.id))
  }, [staffList, threadMemberIds])

  return {
    // auth
    user,
    // ui
    selectedThread, setSelectedThread,
    mobilePanel, setMobilePanel,
    threadsOpen, setThreadsOpen,
    dmsOpen, setDmsOpen,
    // dialogs
    dialog, setDialog,
    renameDialog, setRenameDialog,
    addMembersDialog, setAddMembersDialog,
    dmDialog, setDmDialog,
    // data
    threads, loadingThreads,
    messages, loadingMessages,
    staffList,
    hasNextPage, isFetchingNextPage,
    // derived
    selectedThreadObj,
    staffById,
    memberName,
    threadMemberIds,
    formatThreadParticipants,
    regularThreads,
    dmThreads,
    nonMembers,
    // mutations
    createThread, createDM, renameThread, addMembers, pinThread, sendMessage,
    // presence
    activeUserIds,
    // scroll
    scrollRef, topSentinelRef, handleScroll, onLoadMore,
  }
}
