import { useEffect, useRef } from 'react'

const XANO_BASE = import.meta.env.VITE_XANO_BASE
const REALTIME_CANONICAL = import.meta.env.VITE_XANO_REALTIME

type RealtimeHandler = (payload: unknown) => void

export function useRealtime(channel: string | null | undefined, handler: RealtimeHandler, enabled = true) {
  // Keep a stable ref to the latest handler so the EventSource never needs to
  // reconnect just because the callback function reference changed.
  const handlerRef = useRef(handler)
  useEffect(() => { handlerRef.current = handler })

  useEffect(() => {
    if (!enabled || !channel) return
    if (!XANO_BASE || !REALTIME_CANONICAL) return

    let closed = false
    let source: EventSource | null = null

    const connect = () => {
      if (closed) return
      const url = `${XANO_BASE}/realtime:${REALTIME_CANONICAL}/subscribe?channel=${encodeURIComponent(channel)}`
      source = new EventSource(url)

      source.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(event.data))
        } catch {
          handlerRef.current(event.data)
        }
      }

      source.onerror = () => {
        source?.close()
        if (!closed) setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      closed = true
      source?.close()
    }
  }, [channel, enabled]) // handler intentionally excluded — updated via ref above
}
