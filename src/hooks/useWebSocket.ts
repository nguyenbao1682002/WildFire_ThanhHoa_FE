import { useEffect, useRef } from 'react'
import { useAlertStore, type WsEventType } from '../store/alertStore'

const RECONNECT_DELAY = 3000

function getWsUrl(token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  return `${proto}://${host}/api/v1/ws/alerts?token=${encodeURIComponent(token)}`
}

export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmounted = useRef(false)
  const { addEvent, setWsConnected } = useAlertStore()

  useEffect(() => {
    unmounted.current = false

    function connect() {
      const token = localStorage.getItem('access_token')
      if (!token || unmounted.current) return

      const ws = new WebSocket(getWsUrl(token))
      wsRef.current = ws

      ws.onopen = () => {
        if (unmounted.current) { ws.close(); return }
        setWsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; data?: Record<string, unknown> }
          if (msg.type === 'ping') return
          const eventTypes: WsEventType[] = ['hotspot_new', 'fire_detection_new', 'incident_new']
          if (eventTypes.includes(msg.type as WsEventType)) {
            addEvent(msg.type as WsEventType, msg.data ?? {})
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        if (!unmounted.current) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      unmounted.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [addEvent, setWsConnected])
}
