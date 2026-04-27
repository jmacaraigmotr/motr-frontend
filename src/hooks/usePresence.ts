import { useCallback, useEffect, useRef, useState } from 'react'
import { useRealtime, type PresenceEvent } from './useRealtime'
import { useAuth } from './useAuth'

/**
 * Tracks which user IDs are currently online by subscribing to Xano's
 * presence feature on the team_chat_global channel.
 *
 * Xano sends:
 *   "current" — full list of users already in the channel (sent on join)
 *   "join"    — a user connected
 *   "leave"   — a user disconnected
 */
export function usePresence(): Set<number> {
  const { user } = useAuth()
  const [activeIds, setActiveIds] = useState<Set<number>>(new Set())

  // No-op message handler — we only care about presence events
  const noop = useCallback(() => {}, [])

  const handlePresence = useCallback((evt: PresenceEvent) => {
    const ids = evt.users.map((u) => u.id).filter((id): id is number => typeof id === 'number')

    setActiveIds((prev) => {
      const next = new Set(prev)
      if (evt.action === 'current') {
        // Replace the entire set with whoever Xano says is online right now
        next.clear()
        for (const id of ids) next.add(id)
      } else if (evt.action === 'join') {
        for (const id of ids) next.add(id)
      } else if (evt.action === 'leave') {
        for (const id of ids) next.delete(id)
      }
      return next
    })
  }, [])

  useRealtime('team_chat_global', noop, !!user, handlePresence)

  // Clear presence when the user logs out
  const prevUserRef = useRef(user)
  useEffect(() => {
    if (prevUserRef.current && !user) setActiveIds(new Set())
    prevUserRef.current = user
  }, [user])

  return activeIds
}
