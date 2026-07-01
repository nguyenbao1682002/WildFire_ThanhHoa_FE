import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

interface AuditEntry {
  id: number
  user_id: number | null
  username: string | null
  action: string
  resource: string | null
  changes: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-100 text-blue-800',
  change_password: 'bg-yellow-100 text-yellow-800',
  create_user: 'bg-green-100 text-green-800',
  create_task: 'bg-green-100 text-green-800',
  update_user: 'bg-indigo-100 text-indigo-800',
  update_profile: 'bg-indigo-100 text-indigo-800',
  update_task_status: 'bg-indigo-100 text-indigo-800',
  deactivate_user: 'bg-red-100 text-red-800',
  delete_task: 'bg-red-100 text-red-800',
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AuditLog() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const actionKeys = [
    'login', 'change_password', 'create_user', 'update_user',
    'deactivate_user', 'update_profile', 'create_task', 'update_task_status', 'delete_task',
  ]

  const load = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (filterAction) params.action = filterAction
      if (filterUser && !isNaN(Number(filterUser))) params.user_id = filterUser
      const res = await api.get<AuditEntry[]>('/audit-logs/', { params })
      setRows(res.data)
    } catch {
      setError(t('auditLog.loadError'))
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterUser, t])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function toggleExpand(id: number) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div className="flex flex-col h-full bg-[#f0f4f8]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{t('auditLog.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('auditLog.subtitle')}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-[#1565c0] text-white rounded-lg text-sm hover:bg-[#0d47a1] transition-colors"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          {t('common.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap gap-3 items-center">
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('auditLog.allActions')}</option>
          {actionKeys.map(a => (
            <option key={a} value={a}>{t(`auditLog.actions.${a}`, { defaultValue: a })}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t('auditLog.filterByUserId')}
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(filterAction || filterUser) && (
          <button
            onClick={() => { setFilterAction(''); setFilterUser('') }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">close</span>
            {t('auditLog.clearFilter')}
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">{rows.length} {t('auditLog.records')}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
            <span className="material-symbols-outlined text-4xl">history</span>
            {t('auditLog.noData')}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 w-8">#</th>
                  <th className="px-4 py-3">{t('auditLog.colTime')}</th>
                  <th className="px-4 py-3">{t('auditLog.colUser')}</th>
                  <th className="px-4 py-3">{t('auditLog.colAction')}</th>
                  <th className="px-4 py-3">{t('auditLog.colResource')}</th>
                  <th className="px-4 py-3">{t('auditLog.colIp')}</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <>
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(row.id)}
                    >
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.id}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(row.created_at)}</td>
                      <td className="px-4 py-3">
                        {row.username ? (
                          <span className="font-medium text-gray-800">{row.username}</span>
                        ) : (
                          <span className="text-gray-400 italic">{t('auditLog.system')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[row.action] ?? 'bg-gray-100 text-gray-700'}`}>
                          {t(`auditLog.actions.${row.action}`, { defaultValue: row.action })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.resource ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.ip_address ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {row.changes && (
                          <span className="material-symbols-outlined text-base">
                            {expanded === row.id ? 'expand_less' : 'expand_more'}
                          </span>
                        )}
                      </td>
                    </tr>
                    {expanded === row.id && row.changes && (
                      <tr key={`${row.id}-detail`} className="bg-blue-50">
                        <td colSpan={7} className="px-4 py-3">
                          <p className="text-xs font-medium text-gray-600 mb-1">{t('auditLog.changeDetails')}</p>
                          <pre className="text-xs text-gray-700 bg-white rounded border border-gray-200 p-2 overflow-x-auto">
                            {JSON.stringify(row.changes, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
