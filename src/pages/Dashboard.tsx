import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import { useAlertStore, type WsAlert, type WsEventType } from '../store/alertStore'

interface Stats {
  total_hotspots: number
  active_sensors: number
  avg_confidence: number
  extreme_count: number
  high_count: number
  low_count: number
}

interface Incident {
  id: number
  incident_code: string
  title: string
  status: string
  priority: string
  burn_area_acres: number
  updated_at: string
}

interface Health {
  status: string
  database: string
  redis: string
  mqtt: string
}

interface Bulletin {
  id: number
  title: string
  body: string
  priority: 'info' | 'warning' | 'critical'
  created_by_username: string | null
  created_at: string
}

function StatCard({ icon, label, value, sub, iconColor, iconBg, accent }: {
  icon: string; label: string; value: string | number; sub?: string
  iconColor: string; iconBg: string; accent?: string
}) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 flex items-start gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <span className={`material-symbols-outlined text-xl ${iconColor}`}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-[#64748b] mb-1">{label}</p>
        <p className={`text-2xl font-bold ${accent ?? 'text-[#1e293b]'}`}>{value}</p>
        {sub && <p className="text-xs text-[#94a3b8] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  uncontrolled: 'text-red-600 bg-red-50 border-red-200',
  containing:   'text-amber-600 bg-amber-50 border-amber-200',
  controlled:   'text-emerald-600 bg-emerald-50 border-emerald-200',
}
const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-600', high: 'text-amber-600', medium: 'text-[#64748b]', low: 'text-emerald-600',
}

const EVENT_ICON: Record<WsEventType, string> = {
  hotspot_new:        'crisis_alert',
  fire_detection_new: 'local_fire_department',
  incident_new:       'warning',
}
const EVENT_COLOR: Record<WsEventType, string> = {
  hotspot_new:        'text-red-500',
  fire_detection_new: 'text-orange-500',
  incident_new:       'text-amber-500',
}

function LiveFeedItem({ alert }: { alert: WsAlert }) {
  const { t } = useTranslation()

  const subtitle = (() => {
    const d = alert.data
    if (alert.type === 'hotspot_new') return `${d.device_id ?? ''} — ${d.confidence_score ?? ''}%`
    if (alert.type === 'fire_detection_new') return `${d.station_code ?? ''} — ${d.confidence ?? ''}%`
    if (alert.type === 'incident_new') return String(d.title ?? '')
    return ''
  })()

  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-[#f8fafc] transition-colors">
      <span className={`material-symbols-outlined text-lg flex-shrink-0 ${EVENT_COLOR[alert.type]}`}>
        {EVENT_ICON[alert.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#1e293b] truncate">{subtitle}</p>
        <p className="text-[10px] text-[#94a3b8]">{t(`ws.${alert.type}`)}</p>
      </div>
      <p className="text-[10px] text-[#94a3b8] flex-shrink-0">
        {alert.receivedAt.toLocaleTimeString()}
      </p>
    </li>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [stats,     setStats]     = useState<Stats | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [health,    setHealth]    = useState<Health | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [bulletins, setBulletins] = useState<Bulletin[]>([])
  const { alerts, wsConnected } = useAlertStore()

  useEffect(() => {
    Promise.allSettled([
      api.get<Stats>('/hotspots/stats'),
      api.get<Incident[]>('/incidents/?limit=5'),
      api.get<Health>('/health'),
      api.get<Bulletin[]>('/bulletins/'),
    ]).then(([statsRes, incRes, healthRes, bulletinsRes]) => {
      if (statsRes.status === 'fulfilled')    setStats(statsRes.value.data)
      if (incRes.status === 'fulfilled')      setIncidents(incRes.value.data.slice(0, 5))
      if (healthRes.status === 'fulfilled')   setHealth(healthRes.value.data)
      if (bulletinsRes.status === 'fulfilled') setBulletins(bulletinsRes.value.data.slice(0, 3))
    }).finally(() => setLoading(false))
  }, [])

  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const now = new Date().toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const systemServices = [
    { label: t('dashboard.apiServer'), ok: health !== null },
    { label: t('dashboard.database'),  ok: health?.database === 'connected' },
    { label: t('dashboard.redis'),     ok: health?.redis === 'ok' },
    { label: t('dashboard.mqtt'),      ok: health?.mqtt === 'ok' },
  ]

  const recentAlerts = alerts.slice(0, 8)

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-bold text-[#1e293b]">{t('dashboard.title')}</h1>
        <p className="text-xs text-[#64748b] mt-0.5 capitalize">{now}</p>
      </div>

      {/* Bulletin banners */}
      {bulletins.length > 0 && (
        <div className="space-y-2">
          {Array.isArray(bulletins) && bulletins.map(b => {
            const styles = {
              critical: 'bg-red-50 border-red-300 text-red-800',
              warning:  'bg-amber-50 border-amber-300 text-amber-800',
              info:     'bg-blue-50 border-blue-300 text-blue-800',
            }
            const icons = { critical: 'emergency', warning: 'warning', info: 'campaign' }
            return (
              <div key={b.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${styles[b.priority]}`}>
                <span className="material-symbols-outlined text-lg flex-shrink-0 mt-0.5">{icons[b.priority]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs mt-0.5 opacity-80 line-clamp-2">{b.body}</p>
                </div>
                <Link to="/bulletins" className="text-xs underline opacity-70 hover:opacity-100 flex-shrink-0">
                  {t('common.viewMore')}
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#e2e8f0] rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon="crisis_alert"  label={t('dashboard.totalHotspots')}  value={stats.total_hotspots}       sub={t('dashboard.subFromStart')}    iconColor="text-red-500"     iconBg="bg-red-50"    accent="text-red-600" />
          <StatCard icon="sensors"       label={t('dashboard.activeSensors')}   value={stats.active_sensors}        sub={t('dashboard.subSensorCamera')} iconColor="text-emerald-500" iconBg="bg-emerald-50" />
          <StatCard icon="analytics"     label={t('dashboard.avgConfidence')}   value={`${stats.avg_confidence}%`}  sub={t('dashboard.subConfidence90')} iconColor="text-blue-500"    iconBg="bg-blue-50" />
          <StatCard icon="warning"       label={t('dashboard.extremeDanger')}   value={stats.extreme_count}         sub={t('dashboard.subConfidence90')} iconColor="text-red-400"     iconBg="bg-red-50"    accent="text-red-500" />
          <StatCard icon="report"        label={t('dashboard.highDanger')}      value={stats.high_count}            sub={t('dashboard.subConfidence7090')} iconColor="text-amber-500"   iconBg="bg-amber-50"  accent="text-amber-600" />
          <StatCard icon="info"          label={t('dashboard.lowDanger')}       value={stats.low_count}             sub={t('dashboard.subConfidenceLow')} iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">warning</span>
          {t('dashboard.backendError')}
        </div>
      )}

      {/* Recent incidents + System status + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Recent incidents — 3/5 */}
        <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1565c0] text-base">local_fire_department</span>
              {t('dashboard.recentIncidents')}
            </h2>
            <Link to="/incidents" className="text-xs text-[#1565c0] hover:underline flex items-center gap-0.5">
              {t('common.viewAll')} <span className="material-symbols-outlined text-sm">chevron_right</span>
            </Link>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-[#f1f5f9] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[#94a3b8]">{t('dashboard.noIncidents')}</div>
          ) : (
            <ul className="divide-y divide-[#f8fafc]">
              {Array.isArray(incidents) && incidents.map((inc) => (
                <li key={inc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f8fafc] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-[#94a3b8]">{inc.incident_code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[inc.status] ?? 'text-[#64748b] bg-[#f1f5f9] border-[#e2e8f0]'}`}>
                        {t(`status.${inc.status}`, { defaultValue: inc.status })}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#1e293b] truncate">{inc.title}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-semibold ${PRIORITY_COLOR[inc.priority] ?? 'text-[#64748b]'}`}>
                      {inc.priority.toUpperCase()}
                    </p>
                    <p className="text-[10px] text-[#94a3b8]">{inc.burn_area_acres} ha</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* System status — 2/5 */}
        <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1565c0] text-base">monitor_heart</span>
              {t('dashboard.systemStatus')}
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {systemServices.map(({ label, ok }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs ${
                ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'
              }`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="flex-1">{label}</span>
                <span className="font-medium">{ok ? t('common.running') : t('common.error')}</span>
              </div>
            ))}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs ${
              wsConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]'
            }`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[#94a3b8]'}`} />
              <span className="flex-1">{t('dashboard.wsChannel')}</span>
              <span className="font-medium">{wsConnected ? t('common.running') : t('layout.connecting')}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-[#f1f5f9] text-center">
              <p className="text-[10px] text-[#94a3b8]">{t('dashboard.lastCheck')}</p>
              <p className="text-xs font-medium text-[#1e293b] mt-0.5">
                {new Date().toLocaleTimeString(locale)}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Live Feed */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f1f5f9] bg-[#f8fafc]">
          <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1565c0] text-base">live_tv</span>
            {t('dashboard.liveFeed')}
            {wsConnected && (
              <span className="flex items-center gap-1 text-[10px] font-normal text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </h2>
          {recentAlerts.length > 0 && (
            <span className="text-[10px] text-[#94a3b8]">
              {t('dashboard.liveFeedCount', { count: recentAlerts.length })}
            </span>
          )}
        </div>
        {recentAlerts.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-[#94a3b8]">
            <span className="material-symbols-outlined text-2xl block mb-2 opacity-40">sensors</span>
            {wsConnected ? t('dashboard.liveFeedEmpty') : t('dashboard.liveFeedOffline')}
          </div>
        ) : (
          <ul className="divide-y divide-[#f8fafc]">
            {recentAlerts.map((alert) => (
              <LiveFeedItem key={alert.id} alert={alert} />
            ))}
          </ul>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e293b] mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1565c0] text-base">bolt</span>
          {t('dashboard.quickAccess')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/map',       icon: 'map',                   label: t('dashboard.viewMap'),       color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { to: '/hotspots',  icon: 'crisis_alert',          label: t('dashboard.viewHotspots'),  color: 'text-red-600',     bg: 'bg-red-50'     },
            { to: '/incidents', icon: 'local_fire_department', label: t('dashboard.viewIncidents'), color: 'text-amber-600',   bg: 'bg-amber-50'   },
            { to: '/analytics', icon: 'bar_chart',             label: t('nav.analytics'),           color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ to, icon, label, color, bg }) => (
            <Link key={to} to={to}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-[#e2e8f0] ${bg} hover:shadow-md transition-shadow`}>
              <span className={`material-symbols-outlined text-2xl ${color}`}>{icon}</span>
              <span className={`text-xs font-medium ${color}`}>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
