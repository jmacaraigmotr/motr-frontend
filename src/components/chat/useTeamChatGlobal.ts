import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { teamChatApi } from '@/api/teamChat'
import type { TeamChatThread } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useRealtime } from '@/hooks/useRealtime'

/**
 * Fetches threads globally on app load (not gated on chat being open).
 * Subscribes to team_chat_global realtime always so the badge updates
 * even when the chat widget is closed.
 */
export function useTeamChatGlobal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: threads = [] } = useQuery<TeamChatThread[]>({
    queryKey: ['team_chat_threads'],
    queryFn: teamChatApi.listThreads,
    enabled: !!user,
    staleTime: 60_000,
  })

  const handleGlobal = useCallback((payload: unknown) => {
    const p = payload as { event?: string; thread_id?: number }

    if (p?.event === 'new_message' && p.thread_id != null) {
      // Touch last_message_at so badge recomputes — preview updated by thread-specific realtime
      qc.setQueryData<TeamChatThread[]>(['team_chat_threads'], (old = []) =>
        old.map((t) =>
          t.id === p.thread_id ? { ...t, last_message_at: new Date().toISOString() } : t,
        ),
      )
    } else {
      // Structural change (new thread, member added) — needs real refetch
      qc.invalidateQueries({ queryKey: ['team_chat_threads'] })
    }
  }, [qc])

  useRealtime('team_chat_global', handleGlobal, !!user)

  // Badge is true if any thread has messages newer than the user's last read
  const hasUnread = useMemo(() =>
    threads.some((t) =>
      !!t.last_message_at &&
      (t.last_read_at == null || t.last_message_at > t.last_read_at),
    ),
  [threads])

  // Called when the chat widget opens — mark-read is fired per thread on select,
  // so this is just a no-op kept for the AppShell call site
  const markAllSeen = useCallback(() => {}, [])

  return { hasUnread, markAllSeen }
}
