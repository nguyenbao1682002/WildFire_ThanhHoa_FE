import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

interface HotspotResult {
  id: number
  device_id: string
  confidence_score: number
  detected_at: string
  longitude: number | null
  latitude: number | null
}

interface IncidentResult {
  id: number
  incident_code: string
  title: string
  status: string
  priority: string
  burn_area_acres: number
  description: string | null
  created_at: string
}

interface SearchResult {
  hotspots: HotspotResult[]
  incidents: IncidentResult[]
  total: number
}

type Tab = 'all' | 'hotspot' | 'incident'

const STATUS_STYLE: Record<string, string> = {
  uncontrolled: 'text-red-700 bg-red-50 border-red-200',
  containing:   'text-amber-700 bg-amber-50 border-amber-200',
  controlled:   'text-emerald-700 bg-emerald-50 border-emerald-200',
}
const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-600', high: 'text-amber-600',
  medium: 'text-gray-600', low: 'text-emerald-600',
}

function confBadge(score: number) {
  if (score >= 90) return 'bg-red-100 text-red-700'
  if (score >= 70) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Search() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotspot' | 'incident'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minConf, setMinConf] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (q.trim()) params.q = q.trim()
      if (typeFilter !== 'all') params.type = typeFilter
      if (dateFrom) params.date_from = new Date(dateFrom).toISOString()
      if (dateTo) params.date_to = new Date(dateTo).toISOString()
      if (minConf) params.min_confidence = minConf
      if (priority) params.priority = priority
      if (status) params.status = status
      const res = await api.get<SearchResult>('/search/', { params })
      setResult(res.data)
      setSearched(true)
      setActiveTab('all')
    } catch {
      setError(t('search.error'))
    } finally {
      setLoading(false)
    }
  }, [q, typeFilter, dateFrom, dateTo, minConf, priority, status, t])

  function handleReset() {
    setQ('')
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')
    setMinConf('')
    setPriority('')
    setStatus('')
    setResult(null)
    setSearched(false)
  }

  const hotspots = result?.hotspots ?? []
  const incidents = result?.incidents ?? []
  const displayHotspots = activeTab === 'incident' ? [] : hotspots
  const displayIncidents = activeTab === 'hotspot' ? [] : incidents

  const hasFilters = dateFrom || dateTo || minConf || priority || status

  return (
    <div className="flex flex-col h-full bg-[#f0f4f8]">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">{t('search.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('search.subtitle')}</p>
      </div>

      {/* Search form */}
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <form onSubmit={handleSearch} className="space-y-3">
          {/* Main search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-lg">search</span>
              <input
                type="text"
                placeholder={t('search.placeholder')}
                value={q}
                onChange={e => setQ(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('search.allTypes')}</option>
              <option value="hotspot">{t('search.typeHotspot')}</option>
              <option value="incident">{t('search.typeIncident')}</option>
            </select>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                showFilters || hasFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              {t('search.filterBtn')} {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500 ml-0.5" />}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1565c0] text-white rounded-lg text-sm hover:bg-[#0d47a1] disabled:opacity-50 transition-colors"
            >
              {loading
                ? <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-base">search</span>
              }
              {t('search.searchBtn')}
            </button>
            {searched && (
              <button type="button" onClick={handleReset}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                {t('search.clearBtn')}
              </button>
            )}
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('search.dateFrom')}</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('search.dateTo')}</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('search.minConf')}</label>
                <input type="number" min={0} max={100} placeholder="vd: 70"
                  value={minConf} onChange={e => setMinConf(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('search.priorityFilter')}</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t('search.allLabel')}</option>
                  <option value="critical">{t('search.priorityLabels.critical')}</option>
                  <option value="high">{t('search.priorityLabels.high')}</option>
                  <option value="medium">{t('search.priorityLabels.medium')}</option>
                  <option value="low">{t('search.priorityLabels.low')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('search.statusFilter')}</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t('search.allLabel')}</option>
                  <option value="uncontrolled">{t('search.statusLabels.uncontrolled')}</option>
                  <option value="containing">{t('search.statusLabels.containing')}</option>
                  <option value="controlled">{t('search.statusLabels.controlled')}</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
            <span className="material-symbols-outlined text-5xl">manage_search</span>
            <p className="text-sm">{t('search.emptyState')}</p>
          </div>
        )}

        {searched && result && (
          <>
            {/* Summary + tabs */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                {t('search.found')} <span className="font-semibold text-gray-900">{result.total}</span> {t('common.results')}
                {q && <span> {t('search.for')} "<span className="text-blue-600">{q}</span>"</span>}
              </p>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {([
                  ['all', `${t('search.allLabel')} (${result.total})`],
                  ['hotspot', `${t('search.typeHotspot')} (${hotspots.length})`],
                  ['incident', `${t('search.typeIncident')} (${incidents.length})`],
                ] as [Tab, string][]).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {result.total === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                <span className="material-symbols-outlined text-4xl">search_off</span>
                <p className="text-sm">{t('search.noResults')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Hotspot results */}
                {displayHotspots.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-red-500">crisis_alert</span>
                      {t('search.hotspotSection')} ({displayHotspots.length})
                    </h2>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                            <th className="px-4 py-2.5">{t('search.colDeviceId')}</th>
                            <th className="px-4 py-2.5">{t('search.colConfidence')}</th>
                            <th className="px-4 py-2.5">{t('search.colCoords')}</th>
                            <th className="px-4 py-2.5">{t('search.colDetectedAt')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {displayHotspots.map(h => (
                            <tr key={h.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono text-xs text-gray-700">{h.device_id}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${confBadge(h.confidence_score)}`}>
                                  {h.confidence_score.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                                {h.latitude != null && h.longitude != null
                                  ? `${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{fmt(h.detected_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Incident results */}
                {displayIncidents.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-amber-500">local_fire_department</span>
                      {t('search.incidentSection')} ({displayIncidents.length})
                    </h2>
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                      {displayIncidents.map(inc => (
                        <div key={inc.id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="font-mono text-xs text-gray-400">{inc.incident_code}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[inc.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                                {t(`search.statusLabels.${inc.status}`, { defaultValue: inc.status })}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">{inc.title}</p>
                            {inc.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{inc.description}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-xs font-semibold ${PRIORITY_COLOR[inc.priority] ?? 'text-gray-600'}`}>
                              {t(`search.priorityLabels.${inc.priority}`, { defaultValue: inc.priority })}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{inc.burn_area_acres} ha</p>
                            <p className="text-xs text-gray-400">{fmt(inc.created_at)}</p>
                          </div>
                          <Link to="/incidents" className="flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('common.viewAll')}>
                            <span className="material-symbols-outlined text-base">open_in_new</span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
