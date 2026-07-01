import { useCallback, useEffect, useRef, useState } from 'react'
import dataApi from '../api/dataClient'

interface Hotspot {
  id: number
  device_id: string
  confidence_score: number
  detected_at: string
  latitude?: number
  longitude?: number
  snapshot_url?: string | null
}

const SHOW_LIMIT   = 6
const WS_URL       = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/v1/ws/notifications`
const RECONNECT_MS = 3_000   // 3 s before reconnect attempt
const MAX_ITEMS    = 50      // ring buffer ceiling

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

function levelColor(c: number) {
  if (c > 90) return 'text-red-500 bg-red-50'
  if (c > 70) return 'text-amber-500 bg-amber-50'
  return 'text-emerald-500 bg-emerald-50'
}

export default function NotificationBell() {
  const [hotspots,  setHotspots]  = useState<Hotspot[]>([])
  const [newCount,  setNewCount]  = useState(0)
  const [open,      setOpen]      = useState(false)
  const [connected, setConnected] = useState(false)

  const lastSeenRef  = useRef<string>(
    localStorage.getItem('notif-last-seen') ?? new Date(0).toISOString()
  )
  const [lastSeenState, setLastSeenState] = useState(
    localStorage.getItem('notif-last-seen') ?? new Date(0).toISOString()
  )
  const dropdownRef  = useRef<HTMLDivElement>(null)
  const wsRef        = useRef<WebSocket | null>(null)
  const retryTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef   = useRef(true)
  const connectRef   = useRef<() => void>(() => {})

  function markSeen() {
    const now = new Date().toISOString()
    lastSeenRef.current = now
    localStorage.setItem('notif-last-seen', now)
    setLastSeenState(now)
    setNewCount(0)
  }

  function toggle() {
    if (!open) markSeen()
    setOpen((v) => !v)
  }

  // Prepend a new hotspot into the ring buffer, update badge count
  const addHotspot = useCallback((h: Hotspot) => {
    setHotspots((prev) => {
      const next = [h, ...prev.filter((x) => x.id !== h.id)].slice(0, MAX_ITEMS)
      return next
    })
    if (new Date(h.detected_at) > new Date(lastSeenRef.current)) {
      setNewCount((n) => n + 1)
    }
  }, [])

  // WebSocket connection with auto-reconnect
  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (retryTimer.current) {
      clearTimeout(retryTimer.current)
      retryTimer.current = null
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      setConnected(true)
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as { type: string; data?: Hotspot }
        if (msg.type === 'hotspot_new' && msg.data) {
          addHotspot(msg.data)
        }
      } catch { /* ignore malformed */ }
    }

    ws.onerror = () => {
      setConnected(false)
    }

    ws.onclose = () => {
      setConnected(false)
      if (!mountedRef.current) return
      retryTimer.current = setTimeout(() => connectRef.current(), RECONNECT_MS)
    }
  }, [addHotspot])
  // keep ref in sync without triggering render — must be in an effect
  useEffect(() => { connectRef.current = connect })

  // Initial hotspot fetch (fill list before WS delivers real-time updates)
  useEffect(() => {
    dataApi.get<Hotspot[]>('/hotspots?limit=20')
      .then(({ data }) => {
        setHotspots(data.slice(0, MAX_ITEMS))
        const unseen = data.filter(
          (h) => new Date(h.detected_at) > new Date(lastSeenRef.current)
        ).length
        setNewCount(unseen)
      })
      .catch(() => { /* silent */ })
  }, [])

  // Mount WebSocket
  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (retryTimer.current) clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const visible = hotspots.slice(0, SHOW_LIMIT)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggle}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#f1f5f9] transition-colors"
        title="Thông báo"
      >
        <span className="material-symbols-outlined text-[#64748b] text-xl">notifications</span>
        {newCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {newCount > 9 ? '9+' : newCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <span className="text-xs font-semibold text-[#1e293b]">Điểm cháy gần đây</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[10px] text-[#94a3b8]">{connected ? 'Real-time' : 'Đang kết nối...'}</span>
            </div>
          </div>

          {/* List */}
          {visible.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#94a3b8]">
              Chưa có dữ liệu
            </div>
          ) : (
            <ul className="divide-y divide-[#f1f5f9] max-h-72 overflow-y-auto">
              {visible.map((h) => {
                const isNew = new Date(h.detected_at) > new Date(lastSeenState)
                return (
                  <li key={h.id} className={`flex items-start gap-3 px-4 py-3 ${isNew ? 'bg-blue-50/40' : 'hover:bg-[#f8fafc]'} transition-colors`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${levelColor(h.confidence_score)}`}>
                      <span className="material-symbols-outlined text-sm">local_fire_department</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-[#1e293b]">{h.device_id}</p>
                        {isNew && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">MỚI</span>}
                      </div>
                      {h.latitude != null && (
                        <p className="text-[10px] text-[#94a3b8] mt-0.5 font-mono">
                          {h.latitude.toFixed(4)}, {h.longitude?.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${levelColor(h.confidence_score)}`}>
                        {h.confidence_score}%
                      </span>
                      <p className="text-[10px] text-[#94a3b8] mt-1">{timeSince(h.detected_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[#f1f5f9] bg-[#f8fafc]">
            <a href="/hotspots" className="text-xs text-[#1565c0] hover:underline flex items-center gap-1">
              Xem tất cả điểm cháy
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
