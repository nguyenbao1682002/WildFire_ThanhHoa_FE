import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Bulletin {
  id: number
  title: string
  body: string
  priority: 'info' | 'warning' | 'critical'
  is_active: boolean
  created_by_username: string | null
  created_at: string
}

const PRIORITY_STYLES = {
  critical: {
    badge: 'bg-red-100 text-red-700 border border-red-300',
    card: 'border-l-4 border-l-red-500 bg-red-50',
    icon: 'emergency',
    iconColor: 'text-red-500',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-700 border border-amber-300',
    card: 'border-l-4 border-l-amber-500 bg-amber-50',
    icon: 'warning',
    iconColor: 'text-amber-500',
  },
  info: {
    badge: 'bg-blue-100 text-blue-700 border border-blue-300',
    card: 'border-l-4 border-l-blue-500 bg-blue-50',
    icon: 'info',
    iconColor: 'text-blue-500',
  },
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Bulletins() {
  const { t } = useTranslation()
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole('admin')

  const [bulletins, setBulletins] = useState<Bulletin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', priority: 'info' as Bulletin['priority'] })
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    setError('')
    try {
      const res = await api.get<Bulletin[]>('/bulletins/')
      setBulletins(res.data)
    } catch {
      setError(t('bulletins.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      setFormError(t('bulletins.requiredError'))
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      await api.post('/bulletins/', form)
      setForm({ title: '', body: '', priority: 'info' })
      setShowForm(false)
      load()
    } catch {
      setFormError(t('bulletins.postError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('bulletins.hideConfirm'))) return
    try {
      await api.delete(`/bulletins/${id}`)
      setBulletins(prev => prev.filter(b => b.id !== id))
    } catch {
      alert(t('bulletins.hideError'))
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f0f4f8]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{t('bulletins.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('bulletins.subtitle')}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-[#1565c0] text-white rounded-lg text-sm hover:bg-[#0d47a1] transition-colors"
          >
            <span className="material-symbols-outlined text-base">{showForm ? 'close' : 'add'}</span>
            {showForm ? t('common.cancel') : t('bulletins.postBulletin')}
          </button>
        )}
      </div>

      {/* Post form (admin only) */}
      {showForm && (
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('bulletins.formTitle')}</h2>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={t('bulletins.titlePlaceholder')}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={200}
              />
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as Bulletin['priority'] }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="info">{t('bulletins.priorities.info')}</option>
                <option value="warning">{t('bulletins.priorities.warning')}</option>
                <option value="critical">{t('bulletins.priorities.critical')}</option>
              </select>
            </div>
            <textarea
              placeholder={t('bulletins.bodyPlaceholder')}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#1565c0] text-white rounded-lg text-sm hover:bg-[#0d47a1] disabled:opacity-50 transition-colors"
              >
                {submitting ? t('bulletins.submitting') : t('bulletins.postBulletin')}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError('') }}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-gray-200 animate-pulse" />)}
          </div>
        ) : bulletins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <span className="material-symbols-outlined text-5xl">campaign</span>
            <p className="text-sm">{t('bulletins.emptyState')}</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {bulletins.map(b => {
              const styles = PRIORITY_STYLES[b.priority]
              return (
                <div key={b.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm ${styles.card}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`material-symbols-outlined text-xl flex-shrink-0 ${styles.iconColor}`}>{styles.icon}</span>
                        <h3 className="text-sm font-semibold text-gray-900 leading-tight">{b.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
                          {t(`bulletins.priorities.${b.priority}`)}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(b.id)}
                            title={t('common.delete')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{b.body}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">person</span>
                        {b.created_by_username ?? t('bulletins.system')}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        {fmt(b.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
