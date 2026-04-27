/**
 * useRealtime — Xano Realtime over a single shared WebSocket.
 *
 * The official @xano/js-sdk has a race condition: it calls socket.send()
 * inside the channel constructor without checking readyState, which throws
 * InvalidStateError when multiple channels are opened before the first
 * handshake completes.  This custom manager owns the WebSocket lifecycle and
 * queues Join/Leave messages until the socket is OPEN.
 *
 * Wire protocol (reverse-engineered from @xano/js-sdk source):
 *   send  → JSON.stringify({ action, options: { channel }, payload })
 *   recv  → { action: "message", options: { channel }, payload: <your data> }
 *   auth  → passed as WebSocket sub-protocol: new WebSocket(url, [token])
 */
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'

const XANO_BASE          = import.meta.env.VITE_XANO_BASE          as string
const REALTIME_CANONICAL = import.meta.env.VITE_XANO_REALTIME       as string

// ── Types ────────────────────────────────────────────────────────────────────

type ChannelHandler = (payload: unknown) => void

export interface PresenceEvent {
  action: 'join' | 'leave' | 'current'
  /** One or more users — "current" gives the full list, join/leave give one */
  users: Array<{ id: number; name?: string; [key: string]: unknown }>
}

type PresenceHandler = (event: PresenceEvent) => void

interface Subscription {
  id:              number
  channel:         string
  handler:         ChannelHandler
  presenceHandler?: PresenceHandler
}

// ── Manager ─────────────────────────────────────────────────────────────────

class RealtimeManager {
  private ws:             WebSocket | null = null
  private connecting      = false
  private subs:           Subscription[]  = []
  private pendingJoins    = new Set<string>()
  private joinedChannels  = new Set<string>()
  private presenceChannels = new Set<string>()
  private subIdCounter    = 0
  private reconnectDelay  = 1_000
  private destroyed       = false

  // ── Public API ──

  connect(token?: string | null) {
    if (this.ws || this.connecting || this.destroyed) return
    if (!XANO_BASE || !REALTIME_CANONICAL) return

    this.connecting = true
    const { hostname } = new URL(XANO_BASE)
    const url       = `wss://${hostname}/rt/${REALTIME_CANONICAL}`
    const protocols = token ? [token] : undefined

    console.log('[Realtime] Connecting to', url, '| token present:', !!protocols)

    try {
      this.ws = new WebSocket(url, protocols)
    } catch (err) {
      console.warn('[Realtime] WebSocket construction failed:', err)
      this.connecting = false
      return
    }

    this.ws.addEventListener('open', () => {
      console.log('[Realtime] Connected ✓')
      this.connecting      = false
      this.reconnectDelay  = 1_000
      console.log('[Realtime] Flushing pending joins:', [...this.pendingJoins])
      for (const ch of this.pendingJoins) this.sendJoin(ch)
      this.pendingJoins.clear()
    })

    this.ws.addEventListener('message', (evt) => {
      try {
        const msg     = JSON.parse(evt.data as string)
        const action  = msg?.action
        const channel = msg?.options?.channel ?? '(no channel)'

        if (action === 'message' || action === 'event') {
          const payload = action === 'event' ? (msg.payload?.data ?? msg.payload) : msg.payload
          console.log(`[Realtime] 📨 ${action} on "${channel}":`, payload)
          const matched = this.subs.filter((s) => s.channel === channel)
          console.log(`[Realtime]    subscribers matched: ${matched.length} (total subs: ${this.subs.length})`)
          for (const sub of matched) sub.handler(payload)

        } else if (action === 'presence') {
          // Xano presence payload:
          // { action: "join"|"leave"|"current", data: user | user[] }
          const raw = msg.payload as { action?: string; data?: unknown } | null
          if (!raw) return

          const presenceAction = (raw.action ?? 'join') as PresenceEvent['action']

          // "current" gives an array of all present users; join/leave give a single object
          const rawData = raw.data
          const userList = Array.isArray(rawData) ? rawData : rawData != null ? [rawData] : []
          const users = userList
            .map((u: unknown) => {
              if (u && typeof u === 'object') return u as { id: number; name?: string }
              return null
            })
            .filter((u): u is { id: number } => u != null && typeof (u as { id?: unknown }).id === 'number')

          console.log(`[Realtime] 👥 presence "${presenceAction}" on "${channel}":`, users)

          const event: PresenceEvent = { action: presenceAction, users }
          for (const sub of this.subs) {
            if (sub.channel === channel && sub.presenceHandler) {
              sub.presenceHandler(event)
            }
          }

        } else if (action === 'join_result' || action === 'join') {
          console.log(`[Realtime] ✅ joined channel "${channel}"`, msg.payload ?? '')
        } else if (action === 'error') {
          console.error(`[Realtime] ❌ error on "${channel}":`, msg.payload)
        } else {
          console.log(`[Realtime] ℹ️ frame action="${action}" channel="${channel}":`, msg.payload ?? msg)
        }
      } catch {
        console.warn('[Realtime] Could not parse frame:', evt.data)
      }
    })

    this.ws.addEventListener('close', (evt) => {
      console.warn('[Realtime] Closed — code:', evt.code, '| reason:', evt.reason || '(none)', '| wasClean:', evt.wasClean)
      this.ws            = null
      this.connecting    = false
      this.joinedChannels.clear()

      if (this.destroyed) return

      for (const sub of this.subs) this.pendingJoins.add(sub.channel)

      setTimeout(() => {
        const token = useAuthStore.getState().token
        this.connect(token)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000)
      }, this.reconnectDelay)
    })

    this.ws.addEventListener('error', (evt) => {
      console.error('[Realtime] WebSocket error:', evt)
    })
  }

  subscribe(
    channel: string,
    handler: ChannelHandler,
    options: { presence?: boolean; presenceHandler?: PresenceHandler } = {},
  ): number {
    const id = ++this.subIdCounter
    this.subs.push({ id, channel, handler, presenceHandler: options.presenceHandler })

    if (options.presence) this.presenceChannels.add(channel)

    console.log(`[Realtime] subscribe id=${id} channel="${channel}" presence=${!!options.presence} | ws readyState=${this.ws?.readyState ?? 'null'} | already joined=${this.joinedChannels.has(channel)}`)

    if (!this.joinedChannels.has(channel)) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendJoin(channel)
      } else {
        console.log(`[Realtime] queued join for "${channel}" (socket not open yet)`)
        this.pendingJoins.add(channel)
      }
    }

    return id
  }

  unsubscribe(id: number) {
    const sub = this.subs.find((s) => s.id === id)
    if (!sub) return

    this.subs = this.subs.filter((s) => s.id !== id)

    const others = this.subs.some((s) => s.channel === sub.channel)
    if (!others) {
      this.pendingJoins.delete(sub.channel)
      this.presenceChannels.delete(sub.channel)
      this.sendLeave(sub.channel)
    }
  }

  // ── Private helpers ──

  private sendJoin(channel: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn(`[Realtime] sendJoin skipped for "${channel}" — ws not open (readyState=${this.ws?.readyState})`)
      return
    }
    if (this.joinedChannels.has(channel)) {
      console.log(`[Realtime] sendJoin skipped for "${channel}" — already joined`)
      return
    }
    this.joinedChannels.add(channel)
    const presence = this.presenceChannels.has(channel)
    console.log(`[Realtime] → sending join for "${channel}" | presence=${presence}`)
    this.ws.send(JSON.stringify({
      action:  'join',
      options: { channel },
      payload: { history: false, presence },
    }))
  }

  private sendLeave(channel: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    if (!this.joinedChannels.has(channel)) return
    this.joinedChannels.delete(channel)
    this.ws.send(JSON.stringify({
      action:  'leave',
      options: { channel },
      payload: null,
    }))
  }
}

// One manager for the entire app lifetime
const manager = new RealtimeManager()

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribe to a Xano Realtime channel.
 *
 * @param channel         Channel name, or null/undefined to skip
 * @param handler         Called with every inbound message payload
 * @param enabled         Set to false to pause without unmounting
 * @param onPresence      Optional handler for presence join/leave/current events
 */
export function useRealtime(
  channel: string | null | undefined,
  handler: ChannelHandler,
  enabled = true,
  onPresence?: PresenceHandler,
) {
  const handlerRef  = useRef<ChannelHandler>(handler)
  const presenceRef = useRef<PresenceHandler | undefined>(onPresence)
  useEffect(() => { handlerRef.current  = handler })
  useEffect(() => { presenceRef.current = onPresence })

  useEffect(() => {
    if (!enabled || !channel) return

    const token = useAuthStore.getState().token
    manager.connect(token)

    const subId = manager.subscribe(
      channel,
      (payload) => handlerRef.current(payload),
      {
        presence:        !!onPresence,
        presenceHandler: onPresence ? (evt) => presenceRef.current?.(evt) : undefined,
      },
    )

    return () => {
      manager.unsubscribe(subId)
    }
  // onPresence intentionally omitted — we track it via ref to avoid re-subscribing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, enabled])
}
