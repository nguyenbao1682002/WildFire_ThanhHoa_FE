import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAlertStore, type WsAlert, type WsEventType } from '../store/alertStore'

const AUTO_DISMISS_MS = 8000

const TYPE_CONFIG: Record<WsEventType, { icon: string; bg: string; border: string; text: string; label: string }> = {
  hotspot_new: {
    icon: 'crisis_alert',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    label: 'ws.hotspotNew',
  },
  fire_detection_new: {
    icon: 'local_fire_department',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-800',
    label: 'ws.fireDetectionNew',
  },
  incident_new: {
    icon: 'warning',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-800',
    label: 'ws.incidentNew',
  },
}

function Toast({ alert }: { alert: WsAlert }) {
  const { t } = useTranslation()
  const { dismissToast } = useAlertStore()
  const cfg = TYPE_CONFIG[alert.type]

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(alert.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [alert.id, dismissToast])

  const subtitle = (() => {
    const d = alert.data
    if (alert.type === 'hotspot_new') return `${d.device_id ?? ''} — ${d.confidence_score ?? ''}%`
    if (alert.type === 'fire_detection_new') return `${d.station_code ?? ''} — ${d.confidence ?? ''}%`
    if (alert.type === 'incident_new') return String(d.title ?? '')
    return ''
  })()

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm animate-slide-in ${cfg.bg} ${cfg.border} ${cfg.text} max-w-xs w-full`}
    >
      <span className="material-symbols-outlined text-lg flex-shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{t(cfg.label)}</p>
        {subtitle && <p className="text-xs mt-0.5 opacity-80 truncate">{subtitle}</p>}
        <p className="text-[10px] mt-0.5 opacity-60">
          {alert.receivedAt.toLocaleTimeString()}
        </p>
      </div>
      <button
        onClick={() => dismissToast(alert.id)}
        className="opacity-50 hover:opacity-100 flex-shrink-0 mt-0.5"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  )
}

export default function AlertToastContainer() {
  const { toasts } = useAlertStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-14 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast alert={t} />
        </div>
      ))}
    </div>
  )
}
