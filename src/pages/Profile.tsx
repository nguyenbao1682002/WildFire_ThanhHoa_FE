import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'

type Tab = 'info' | 'password' | 'notifications'

interface NotifPrefs {
  channels: { inapp: boolean; email: boolean; push: boolean }
  minSeverity: 'low' | 'medium' | 'high' | 'critical'
  events: { newHotspot: boolean; newIncident: boolean; taskAssigned: boolean; taskOverdue: boolean }
}

const DEFAULT_PREFS: NotifPrefs = {
  channels: { inapp: true, email: false, push: false },
  minSeverity: 'medium',
  events: { newHotspot: true, newIncident: true, taskAssigned: true, taskOverdue: true },
}

function loadPrefs(): NotifPrefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('wf-notif-prefs') ?? '{}') } }
  catch { return DEFAULT_PREFS }
}

function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-[#1565c0]' : 'bg-[#cbd5e1]'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Field({ label, value, editing, onChange, type = 'text', disabled = false }: {
  label: string; value: string; editing: boolean
  onChange: (v: string) => void; type?: string; disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#64748b] mb-1">{label}</label>
      {editing && !disabled ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b]"
        />
      ) : (
        <p className={`text-sm px-3 py-2 rounded-lg ${disabled ? 'text-[#94a3b8]' : 'text-[#1e293b]'} bg-[#f8fafc] border border-transparent`}>
          {value || '—'}
        </p>
      )}
    </div>
  )
}

export default function Profile() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [tab, setTab]         = useState<Tab>('info')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const emptyForm = { full_name: '', email: user?.email ?? '', phone: '', unit: '' }
  const [form, setForm]               = useState(emptyForm)
  const [profileLoading, setProfileLoading] = useState(true)
  const savedForm = useRef(emptyForm)

  useEffect(() => {
    api.get<{ full_name?: string | null; email: string; phone?: string | null; unit?: string | null }>('/users/me')
      .then(r => {
        const d = r.data
        const loaded = {
          full_name: d.full_name ?? '',
          email:     d.email     ?? '',
          phone:     d.phone     ?? '',
          unit:      d.unit      ?? '',
        }
        setForm(loaded)
        savedForm.current = loaded
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [])

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwdSaving, setPwdSaving] = useState(false)

  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs())
  const [prefsSaved, setPrefsSaved] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() =>
    ('Notification' in window) ? Notification.permission : 'default'
  )

  const setChannel = (k: keyof NotifPrefs['channels'], v: boolean) =>
    setPrefs(p => ({ ...p, channels: { ...p.channels, [k]: v } }))
  const setEvent = (k: keyof NotifPrefs['events'], v: boolean) =>
    setPrefs(p => ({ ...p, events: { ...p.events, [k]: v } }))

  const handleSavePrefs = () => {
    localStorage.setItem('wf-notif-prefs', JSON.stringify(prefs))
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 2500)
  }

  const requestPush = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setPushPermission(perm)
    if (perm === 'granted') setChannel('push', true)
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const r = await api.patch<{ full_name?: string | null; email: string; phone?: string | null; unit?: string | null }>('/users/me', form)
      const d = r.data
      const updated = {
        full_name: d.full_name ?? '',
        email:     d.email     ?? '',
        phone:     d.phone     ?? '',
        unit:      d.unit      ?? '',
      }
      setForm(updated)
      savedForm.current = updated
      setMsg({ type: 'ok', text: t('profile.saveOk') })
      setEditing(false)
    } catch {
      setMsg({ type: 'err', text: t('profile.saveErr') })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm(savedForm.current)
    setEditing(false)
    setMsg(null)
  }

  const handleChangePassword = async () => {
    setPwdMsg(null)
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: 'err', text: t('profile.pwdMismatch') })
      return
    }
    if (pwd.next.length < 8) {
      setPwdMsg({ type: 'err', text: t('profile.pwdTooShort') })
      return
    }
    setPwdSaving(true)
    try {
      await api.post('/auth/change-password', { current_password: pwd.current, new_password: pwd.next })
      setPwdMsg({ type: 'ok', text: t('profile.pwdOk') })
      setPwd({ current: '', next: '', confirm: '' })
    } catch {
      setPwdMsg({ type: 'err', text: t('profile.pwdErr') })
    } finally {
      setPwdSaving(false)
    }
  }

  const roleName = (user as { roles?: { name: string }[] })?.roles?.[0]?.name
  const roleLabel = roleName === 'admin' ? t('profile.roleAdmin')
    : roleName === 'ranger' ? t('profile.roleRanger')
    : t('profile.roleViewer')

  const initial = (form.full_name || user?.username || '?').split(' ').pop()?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-[#1e293b]">{t('profile.title')}</h1>
        <p className="text-xs text-[#64748b] mt-0.5">{t('profile.subtitle')}</p>
      </div>

      {/* Avatar + name card */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm mb-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#1565c0] flex items-center justify-center flex-shrink-0 shadow">
          <span className="text-white text-2xl font-bold">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1e293b]">{form.full_name || user?.username}</p>
          <p className="text-xs text-[#64748b]">@{user?.username}</p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium">
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-1 w-fit">
        {([
          { id: 'info',          label: t('profile.tabInfo'),     icon: 'person' },
          { id: 'password',      label: t('profile.tabPassword'), icon: 'lock' },
          { id: 'notifications', label: t('profile.tabNotify'),   icon: 'notifications' },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setMsg(null); setPwdMsg(null) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-white shadow-sm text-[#1565c0] border border-[#e2e8f0]'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {tab === 'info' && profileLoading ? (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-[#f1f5f9] rounded-lg animate-pulse" />)}
        </div>
      ) : tab === 'info' && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('profile.fullName')}  value={form.full_name} editing={editing} onChange={(v) => set('full_name', v)} />
            <Field label={t('profile.username')}  value={user?.username ?? ''} editing={editing} onChange={() => {}} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('profile.email')}     value={form.email}  editing={editing} onChange={(v) => set('email', v)} type="email" />
            <Field label={t('profile.phone')}     value={form.phone}  editing={editing} onChange={(v) => set('phone', v)} type="tel" />
          </div>
          <Field label={t('profile.unit')}        value={form.unit}   editing={editing} onChange={(v) => set('unit', v)} />

          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
              msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {msg.type === 'ok' ? 'check_circle' : 'error'}
              </span>
              {msg.text}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {editing ? (
              <>
                <button onClick={handleCancel} className="px-4 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc]">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] font-medium disabled:opacity-60"
                >
                  {saving ? t('profile.saving') : t('common.save')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] font-medium"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                {t('profile.edit')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {tab === 'notifications' && (
        <div className="space-y-4">

          {/* Notification channels */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1565c0] text-base">sensors</span>
              {t('profile.notifChannels')}
            </h2>
            <div className="space-y-3">
              {/* In-app */}
              <div className="flex items-center justify-between py-2 border-b border-[#f1f5f9]">
                <div>
                  <p className="text-sm font-medium text-[#1e293b]">{t('profile.notifInApp')}</p>
                  <p className="text-xs text-[#64748b]">{t('profile.notifInAppDesc')}</p>
                </div>
                <Toggle on={prefs.channels.inapp} onChange={(v) => setChannel('inapp', v)} />
              </div>

              {/* Email */}
              <div className="flex items-center justify-between py-2 border-b border-[#f1f5f9]">
                <div>
                  <p className="text-sm font-medium text-[#1e293b]">Email</p>
                  <p className="text-xs text-[#64748b]">{user?.email ?? '—'}</p>
                </div>
                <Toggle on={prefs.channels.email} onChange={(v) => setChannel('email', v)} />
              </div>

              {/* Push */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-[#1e293b]">{t('profile.notifPush')}</p>
                  <p className="text-xs text-[#64748b]">
                    {pushPermission === 'granted' ? t('profile.pushGranted')
                      : pushPermission === 'denied' ? t('profile.pushDenied')
                      : t('profile.pushDefault')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pushPermission === 'default' && (
                    <button onClick={requestPush}
                      className="text-xs text-[#1565c0] border border-[#1565c0] px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap">
                      {t('profile.pushAllow')}
                    </button>
                  )}
                  <Toggle
                    on={prefs.channels.push && pushPermission === 'granted'}
                    onChange={(v) => setChannel('push', v)}
                    disabled={pushPermission !== 'granted'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Minimum severity */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#f59e0b] text-base">tune</span>
              {t('profile.severityTitle')}
            </h2>
            <p className="text-xs text-[#64748b]">{t('profile.severityDesc')}</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'low',      label: t('profile.severityLow'),      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                { id: 'medium',   label: t('profile.severityMedium'),   color: 'text-amber-600   bg-amber-50   border-amber-200'   },
                { id: 'high',     label: t('profile.severityHigh'),     color: 'text-orange-600  bg-orange-50  border-orange-200'  },
                { id: 'critical', label: t('profile.severityCritical'), color: 'text-red-600     bg-red-50     border-red-200'     },
              ] as const).map(({ id, label, color }) => (
                <button key={id} onClick={() => setPrefs(p => ({ ...p, minSeverity: id }))}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    prefs.minSeverity === id ? color + ' ring-2 ring-offset-1 ring-current' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    id === 'low' ? 'bg-emerald-500' : id === 'medium' ? 'bg-amber-500' : id === 'high' ? 'bg-orange-500' : 'bg-red-500'
                  }`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Event types */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#64748b] text-base">checklist</span>
              {t('profile.eventsTitle')}
            </h2>
            <div className="space-y-2">
              {([
                { key: 'newHotspot',   icon: 'crisis_alert',         label: t('profile.eventNewHotspot'),    desc: t('profile.eventNewHotspotDesc') },
                { key: 'newIncident',  icon: 'local_fire_department', label: t('profile.eventNewIncident'),   desc: t('profile.eventNewIncidentDesc') },
                { key: 'taskAssigned', icon: 'assignment_ind',        label: t('profile.eventTaskAssigned'),  desc: t('profile.eventTaskAssignedDesc') },
                { key: 'taskOverdue',  icon: 'schedule',              label: t('profile.eventTaskOverdue'),   desc: t('profile.eventTaskOverdueDesc') },
              ] as const).map(({ key, icon, label, desc }) => {
                const on = prefs.events[key]
                return (
                  <label key={key} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#f8fafc] cursor-pointer group transition-colors">
                    <input type="checkbox" checked={on} onChange={() => setEvent(key, !on)} className="hidden" />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${on ? 'bg-[#1565c0] border-[#1565c0]' : 'border-[#cbd5e1] group-hover:border-[#1565c0]'}`}>
                      {on && <svg className="w-3 h-3 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5 L4 7.5 L8.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>}
                    </div>
                    <span className="material-symbols-outlined text-base text-[#64748b] flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${on ? 'text-[#1e293b]' : 'text-[#94a3b8]'}`}>{label}</p>
                      <p className="text-xs text-[#94a3b8]">{desc}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#94a3b8]">{t('profile.deviceStored')}</p>
            <button onClick={handleSavePrefs}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] font-medium transition-colors">
              {prefsSaved
                ? <><span className="material-symbols-outlined text-sm">check_circle</span>{t('profile.savedPref')}</>
                : <><span className="material-symbols-outlined text-sm">save</span>{t('profile.savePref')}</>}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Password */}
      {tab === 'password' && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-4">
          <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] text-xs text-[#64748b] flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-[#94a3b8] mt-0.5">info</span>
            <span>{t('profile.pwdHint')}</span>
          </div>

          {[
            { label: t('profile.oldPassword'),     key: 'current' },
            { label: t('profile.newPassword'),     key: 'next' },
            { label: t('profile.confirmPassword'), key: 'confirm' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-[#64748b] mb-1">{label}</label>
              <input
                type="password"
                value={(pwd as Record<string, string>)[key]}
                onChange={(e) => setPwd((p) => ({ ...p, [key]: e.target.value }))}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b]"
              />
            </div>
          ))}

          {pwdMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
              pwdMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {pwdMsg.type === 'ok' ? 'check_circle' : 'error'}
              </span>
              {pwdMsg.text}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleChangePassword}
              disabled={pwdSaving || !pwd.current || !pwd.next || !pwd.confirm}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] font-medium disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-sm">lock_reset</span>
              {pwdSaving ? t('profile.changingPwd') : t('profile.changePwd')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
