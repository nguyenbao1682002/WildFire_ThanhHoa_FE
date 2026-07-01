import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

// ---------- Types ----------

interface APIKey {
  id: number
  name: string
  key_prefix: string
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  raw_key?: string
}

interface WebhookItem {
  id: number
  name: string
  url: string
  events: string[]
  is_active: boolean
  last_triggered_at: string | null
  failure_count: number
  created_at: string
  secret?: string
}

// ---------- Sub-components ----------

function CopyBtn({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="ml-2 px-2 py-0.5 rounded text-xs bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] transition-colors">
      {copied ? `✓ ${t('integrations.copied')}` : t('integrations.copy')}
    </button>
  )
}

function SecretReveal({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <div className="font-semibold text-amber-800 mb-1">
        ⚠ {label} — {t('integrations.secretWarning')}
      </div>
      <div className="flex items-center gap-2 font-mono text-xs break-all text-[#1e293b]">
        {show ? value : '•'.repeat(32)}
        <button onClick={() => setShow(v => !v)} className="shrink-0 text-[#1565c0] underline">
          {show ? t('integrations.hide') : t('integrations.show')}
        </button>
        <CopyBtn text={value} />
      </div>
    </div>
  )
}

// ---------- Tab: API Keys ----------

function KeysTab() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<APIKey | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get<APIKey[]>('/integrations/api-keys')
      setKeys(r.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const r = await api.post<APIKey>('/integrations/api-keys', { name: newName.trim() })
      setCreated(r.data)
      setKeys(prev => [r.data, ...prev])
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('integrations.deleteKeyConfirm'))) return
    await api.delete(`/integrations/api-keys/${id}`)
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  const fmt = (s: string | null) => s ? new Date(s).toLocaleDateString(locale) : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#64748b]">{t('integrations.keysDesc')}</p>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1565c0] hover:bg-[#1251a3] text-white text-sm rounded-lg transition-colors whitespace-nowrap flex-shrink-0">
          <span className="material-symbols-outlined text-base">add</span>
          {t('integrations.createKey')}
        </button>
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-base text-[#1e293b] mb-4">{t('integrations.createKeyTitle')}</h3>
            <label className="block text-xs font-medium text-[#64748b] mb-1">{t('integrations.keyNameLabel')}</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('integrations.keyNamePlaceholder')}
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#1565c0] text-[#1e293b]"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            {created?.raw_key && <SecretReveal label="API Key" value={created.raw_key} />}
            <div className="flex justify-end gap-2 mt-4">
              {!created ? (
                <>
                  <button
                    onClick={() => { setShowModal(false); setCreated(null); setNewName('') }}
                    className="px-4 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc]">
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="px-4 py-2 text-sm rounded-lg bg-[#1565c0] hover:bg-[#1251a3] text-white disabled:opacity-50">
                    {creating ? t('integrations.creating') : t('integrations.createAction')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setShowModal(false); setCreated(null) }}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                  {t('integrations.keySavedClose')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keys table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[#f1f5f9] rounded-lg animate-pulse" />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#94a3b8]">{t('integrations.noKeys')}</div>
      ) : (
        <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#64748b] text-xs uppercase border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3">{t('integrations.colName')}</th>
                <th className="px-4 py-3">Prefix</th>
                <th className="px-4 py-3">{t('integrations.colCreatedAt')}</th>
                <th className="px-4 py-3">{t('integrations.colExpiresAt')}</th>
                <th className="px-4 py-3">{t('integrations.colLastUsed')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-medium text-[#1e293b]">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{k.key_prefix}...</td>
                  <td className="px-4 py-3 text-[#64748b]">{fmt(k.created_at)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{fmt(k.expires_at)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{fmt(k.last_used_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(k.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Tab: Webhooks ----------

function WebhooksTab() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  const EVENT_OPTIONS = [
    { id: 'hotspot_new',       label: 'hotspot_new',       desc: t('integrations.eventDesc.hotspot_new') },
    { id: 'incident_new',      label: 'incident_new',      desc: t('integrations.eventDesc.incident_new') },
    { id: 'incident_updated',  label: 'incident_updated',  desc: t('integrations.eventDesc.incident_updated') },
    { id: 'alert_critical',    label: 'alert_critical',    desc: t('integrations.eventDesc.alert_critical') },
  ]

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] })
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<WebhookItem | null>(null)
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; status: number } | null>>({})

  const load = useCallback(async () => {
    try {
      const r = await api.get<WebhookItem[]>('/integrations/webhooks')
      setWebhooks(r.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleEvent(id: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(id) ? f.events.filter(e => e !== id) : [...f.events, id],
    }))
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) return
    setCreating(true)
    try {
      const r = await api.post<WebhookItem>('/integrations/webhooks', form)
      setCreated(r.data)
      setWebhooks(prev => [r.data, ...prev])
      setForm({ name: '', url: '', events: [] })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('integrations.deleteWebhookConfirm'))) return
    await api.delete(`/integrations/webhooks/${id}`)
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  async function handleTest(id: number) {
    setTestResult(r => ({ ...r, [id]: null }))
    const res = await api.post<{ ok: boolean; status: number }>(`/integrations/webhooks/${id}/test`)
    setTestResult(r => ({ ...r, [id]: res.data }))
  }

  const fmt = (s: string | null) => s ? new Date(s).toLocaleDateString(locale) : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#64748b]">{t('integrations.webhooksDesc')}</p>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1565c0] hover:bg-[#1251a3] text-white text-sm rounded-lg transition-colors whitespace-nowrap flex-shrink-0">
          <span className="material-symbols-outlined text-base">add</span>
          {t('integrations.addWebhook')}
        </button>
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold text-base text-[#1e293b] mb-4">{t('integrations.addWebhookTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#64748b] mb-1">{t('integrations.webhookNameLabel')}</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Alert Feed UBND Tỉnh"
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1565c0] text-[#1e293b]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748b] mb-1">{t('integrations.webhookUrlLabel')}</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://your-system.com/webhook/wildfire"
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1565c0] text-[#1e293b]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748b] mb-2">{t('integrations.webhookEventsLabel')}</label>
                <div className="space-y-1.5">
                  {EVENT_OPTIONS.map(ev => (
                    <label key={ev.id} className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(ev.id)}
                        onChange={() => toggleEvent(ev.id)}
                        className="mt-0.5 accent-[#1565c0]"
                      />
                      <div>
                        <span className="font-mono text-xs text-[#1e293b]">{ev.label}</span>
                        <span className="ml-2 text-xs text-[#94a3b8]">{ev.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {created?.secret && <SecretReveal label="Webhook Secret" value={created.secret} />}

            <div className="flex justify-end gap-2 mt-5">
              {!created ? (
                <>
                  <button
                    onClick={() => { setShowModal(false); setCreated(null) }}
                    className="px-4 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc]">
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !form.name.trim() || !form.url.trim() || form.events.length === 0}
                    className="px-4 py-2 text-sm rounded-lg bg-[#1565c0] hover:bg-[#1251a3] text-white disabled:opacity-50">
                    {creating ? t('integrations.registering') : t('integrations.registerAction')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setShowModal(false); setCreated(null) }}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                  {t('integrations.webhookSavedClose')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Webhooks table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[#f1f5f9] rounded-lg animate-pulse" />)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#94a3b8]">{t('integrations.noWebhooks')}</div>
      ) : (
        <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#64748b] text-xs uppercase border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3">{t('integrations.colName')}</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">{t('integrations.webhookEventsLabel')}</th>
                <th className="px-4 py-3">{t('integrations.colErrors')}</th>
                <th className="px-4 py-3">{t('integrations.colLastTriggered')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {webhooks.map(wh => (
                <tr key={wh.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-medium text-[#1e293b]">{wh.name}</td>
                  <td className="px-4 py-3 text-xs text-[#64748b] max-w-[200px] truncate">
                    <a href={wh.url} target="_blank" rel="noreferrer" className="hover:underline">{wh.url}</a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {wh.events.map(ev => (
                        <span key={ev} className="px-1.5 py-0.5 bg-blue-50 text-[#1565c0] rounded text-xs font-mono">{ev}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {wh.failure_count > 0
                      ? <span className="text-red-500 font-medium">{wh.failure_count}</span>
                      : <span className="text-emerald-600">0</span>}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{fmt(wh.last_triggered_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleTest(wh.id)}
                        className="p-1.5 rounded hover:bg-blue-50 text-[#1565c0] transition-colors"
                        title="Test">
                        <span className="material-symbols-outlined text-lg">send</span>
                      </button>
                      {testResult[wh.id] !== undefined && (
                        <span className={`text-xs font-medium ${testResult[wh.id]?.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                          {testResult[wh.id]?.ok ? `✓ ${testResult[wh.id]?.status}` : `✗ ${testResult[wh.id]?.status || 'ERR'}`}
                        </span>
                      )}
                      <button onClick={() => handleDelete(wh.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Tab: API Docs ----------

function DocsTab() {
  const { t } = useTranslation()
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'

  const endpoints = [
    { method: 'GET',   path: '/api/hotspots',           desc: t('integrations.eventDesc.hotspot_new') },
    { method: 'GET',   path: '/api/hotspots/geojson',   desc: 'GeoJSON FeatureCollection' },
    { method: 'GET',   path: '/api/hotspots/stats',     desc: 'System overview stats' },
    { method: 'GET',   path: '/api/incidents',          desc: t('integrations.eventDesc.incident_new') },
    { method: 'GET',   path: '/api/incidents/{id}',     desc: 'Incident detail' },
    { method: 'GET',   path: '/api/v1/firms/status',    desc: 'FIRMS satellite sync status' },
    { method: 'GET',   path: '/api/boundaries/province', desc: 'Province boundary GeoJSON' },
    { method: 'GET',   path: '/api/boundaries/districts', desc: '27 district boundaries GeoJSON' },
  ]
  const mCls = { GET: 'bg-emerald-100 text-emerald-700', POST: 'bg-blue-100 text-[#1565c0]', DELETE: 'bg-red-100 text-red-700' }

  const infoCards = [
    {
      title: 'Base URL',
      content: <><code className="text-sm text-[#1e293b]">{origin}/api/</code><div className="text-xs text-[#94a3b8] mt-1">v1: {origin}/api/v1/</div></>,
    },
    {
      title: t('integrations.docsAuth'),
      content: <>
        <code className="block text-xs text-[#64748b] mb-1">Authorization: Bearer &lt;JWT&gt;</code>
        <code className="block text-xs text-[#64748b]">Authorization: Bearer &lt;wf_api_key&gt;</code>
        <div className="text-xs text-[#94a3b8] mt-1">{t('integrations.docsAuthNote')}</div>
      </>,
    },
    {
      title: t('integrations.docsRateLimit'),
      content: <>
        <div className="text-[#1e293b]">{t('integrations.docsRateLimitValue')}</div>
        <div className="text-xs text-[#94a3b8] mt-1">{t('integrations.docsRateLimitNote')}</div>
      </>,
    },
    {
      title: t('integrations.docsFormat'),
      content: <>
        <div className="text-[#1e293b]">JSON, UTF-8</div>
        <code className="block text-xs text-[#94a3b8] mt-1">{t('integrations.docsFormatNote')}</code>
      </>,
    },
  ]

  return (
    <div className="space-y-6 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {infoCards.map(card => (
          <div key={card.title} className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
            <div className="text-xs text-[#94a3b8] uppercase mb-2 font-semibold">{card.title}</div>
            {card.content}
          </div>
        ))}
      </div>

      {/* Endpoints */}
      <div>
        <div className="font-semibold text-[#1e293b] mb-3">{t('integrations.docsEndpoints')}</div>
        <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
          {endpoints.map((ep, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 text-xs ${i < endpoints.length - 1 ? 'border-b border-[#f1f5f9]' : ''}`}>
              <span className={`px-2 py-0.5 rounded font-mono font-semibold shrink-0 ${mCls[ep.method as keyof typeof mCls]}`}>
                {ep.method}
              </span>
              <code className="text-[#1e293b] shrink-0">{ep.path}</code>
              <span className="text-[#94a3b8] ml-auto text-right">{ep.desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right">
          <a href="/api/docs" target="_blank" className="text-xs text-[#1565c0] hover:underline">
            {t('integrations.docsSwagger')}
          </a>
        </div>
      </div>

      {/* Webhook signature */}
      <div>
        <div className="font-semibold text-[#1e293b] mb-2">{t('integrations.docsWebhookAuth')}</div>
        <div className="bg-[#1e293b] text-emerald-400 rounded-xl p-4 font-mono text-xs space-y-1 overflow-x-auto">
          <div className="text-[#64748b]"># Python — verify HMAC-SHA256 signature</div>
          <div>import hmac, hashlib</div>
          <div>sig = request.headers.get("X-Wildfire-Signature", "").removeprefix("sha256=")</div>
          <div>expected = hmac.new(SECRET.encode(), request.body, hashlib.sha256).hexdigest()</div>
          <div>assert hmac.compare_digest(sig, expected), "Invalid signature"</div>
        </div>
      </div>

      {/* Example payload */}
      <div>
        <div className="font-semibold text-[#1e293b] mb-2">{t('integrations.docsWebhookExample')}</div>
        <div className="bg-[#1e293b] text-[#e2e8f0] rounded-xl p-4 font-mono text-xs overflow-x-auto">
          <pre>{JSON.stringify({
            event: "hotspot_new",
            timestamp: new Date().toISOString(),
            data: { count: 3, source: "FIRMS", bbox: "104.2,19.0,106.5,20.8" }
          }, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}

// ---------- Main page ----------

type Tab = 'keys' | 'webhooks' | 'docs'

export default function Integrations() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('keys')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'keys',     label: t('integrations.tabKeys'),     icon: 'key' },
    { id: 'webhooks', label: t('integrations.tabWebhooks'), icon: 'webhook' },
    { id: 'docs',     label: t('integrations.tabDocs'),     icon: 'integration_instructions' },
  ]

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[#1e293b]">{t('integrations.title')}</h1>
        <p className="text-xs text-[#64748b] mt-0.5">{t('integrations.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[#e2e8f0]">
          {tabs.map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px
                ${tab === tb.id
                  ? 'border-[#1565c0] text-[#1565c0]'
                  : 'border-transparent text-[#64748b] hover:text-[#1e293b]'}`}>
              <span className="material-symbols-outlined text-base">{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'keys'     && <KeysTab />}
          {tab === 'webhooks' && <WebhooksTab />}
          {tab === 'docs'     && <DocsTab />}
        </div>
      </div>
    </div>
  )
}
