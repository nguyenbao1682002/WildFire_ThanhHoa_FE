import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id: number
  username: string
  full_name: string
  email: string
  role: 'admin' | 'ranger' | 'viewer'
  is_active: boolean
  created_at: string
  last_login?: string
}

interface ApiUser {
  id: number
  username: string
  full_name: string | null
  email: string
  is_active: boolean
  created_at: string
  last_login?: string
  roles: { id: number; name: string }[]
}

function apiToUser(u: ApiUser): User {
  const names = u.roles.map((r) => r.name)
  const role: User['role'] = names.includes('admin') ? 'admin' : names.includes('ranger') ? 'ranger' : 'viewer'
  return {
    id:         u.id,
    username:   u.username,
    full_name:  u.full_name ?? '',
    email:      u.email,
    role,
    is_active:  u.is_active,
    created_at: u.created_at,
    last_login: u.last_login,
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface FormData {
  full_name: string
  email: string
  username: string
  role: User['role']
  is_active: boolean
  password: string
}

interface ModalProps {
  user: User | null
  onClose: () => void
  onSave: (data: FormData) => Promise<void>
}

function UserModal({ user, onClose, onSave }: ModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormData>({
    full_name: user?.full_name ?? '',
    email:     user?.email ?? '',
    username:  user?.username ?? '',
    role:      user?.role ?? 'viewer',
    is_active: user?.is_active ?? true,
    password:  '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Lỗi không xác định')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1e293b]">
            {user ? t('users.editUser') : t('users.addUser')}
          </h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#64748b]">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-4 space-y-4">
          {[
            { label: t('users.fullName'), key: 'full_name', type: 'text',     placeholder: 'Nguyễn Văn A' },
            { label: t('users.username'), key: 'username',  type: 'text',     placeholder: 'username' },
            { label: t('users.email'),    key: 'email',     type: 'email',    placeholder: 'email@example.com' },
            { label: user ? t('users.newPassword') : t('users.password'), key: 'password', type: 'password', placeholder: '••••••••' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-[#64748b] mb-1">{label}</label>
              <input
                type={type}
                value={(form as unknown as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                disabled={saving}
                className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b] disabled:opacity-60"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">{t('users.role')}</label>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b] bg-white disabled:opacity-60"
            >
              <option value="admin">{t('users.roles.admin')}</option>
              <option value="ranger">{t('users.roles.ranger')}</option>
              <option value="viewer">{t('users.roles.viewer')}</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              disabled={saving}
              className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-60 ${form.is_active ? 'bg-[#1565c0]' : 'bg-[#e2e8f0]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-[#64748b]">{form.is_active ? t('users.accountActive') : t('users.accountLocked')}</span>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-[#e2e8f0] flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] disabled:opacity-60">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] font-medium disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {user ? t('users.saveChanges') : t('users.createAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Users() {
  const { t } = useTranslation()
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [roleFilter, setRole]   = useState('')
  const [modal, setModal]       = useState<'create' | User | null>(null)
  const [deleteTarget, setDel]  = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  const ROLE_META = {
    admin:  { label: t('users.roles.admin'),  cls: 'bg-red-50 text-red-600 border-red-200',     icon: 'admin_panel_settings' },
    ranger: { label: t('users.roles.ranger'), cls: 'bg-blue-50 text-blue-600 border-blue-200',   icon: 'forest' },
    viewer: { label: t('users.roles.viewer'), cls: 'bg-slate-50 text-slate-600 border-slate-200', icon: 'visibility' },
  }

  const loadUsers = () => {
    setLoading(true)
    setError('')
    api.get<ApiUser[]>('/users')
      .then((r) => setUsers(r.data.map(apiToUser)))
      .catch(() => setError('Không thể tải danh sách người dùng. Vui lòng thử lại.'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadUsers() }, [])

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch = !search
      || u.full_name.toLowerCase().includes(q)
      || u.username.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  const handleSave = async (data: FormData): Promise<void> => {
    if (modal === 'create') {
      const res = await api.post<ApiUser>('/users', {
        username:   data.username,
        email:      data.email,
        password:   data.password,
        full_name:  data.full_name,
        role_names: [data.role],
      })
      setUsers((prev) => [...prev, apiToUser(res.data)])
    } else if (modal && typeof modal === 'object') {
      const payload: Record<string, unknown> = {}
      if (data.email     !== undefined) payload.email      = data.email
      if (data.full_name !== undefined) payload.full_name  = data.full_name
      if (data.is_active !== undefined) payload.is_active  = data.is_active
      if (data.role      !== undefined) payload.role_names = [data.role]
      const res = await api.patch<ApiUser>(`/users/${modal.id}`, payload)
      setUsers((prev) => prev.map((u) => u.id === modal.id ? apiToUser(res.data) : u))
    }
  }

  const handleDelete = async (u: User) => {
    setDeleting(true)
    try {
      await api.delete(`/users/${u.id}`)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      setDel(null)
    } catch {
      // keep modal open on failure
    } finally {
      setDeleting(false)
    }
  }

  const toggleActive = async (u: User) => {
    try {
      const res = await api.patch<ApiUser>(`/users/${u.id}`, { is_active: !u.is_active })
      setUsers((prev) => prev.map((x) => x.id === u.id ? apiToUser(res.data) : x))
    } catch {
      // revert optimistically if needed
    }
  }

  const counts = {
    admin:  users.filter((u) => u.role === 'admin').length,
    ranger: users.filter((u) => u.role === 'ranger').length,
    viewer: users.filter((u) => u.role === 'viewer').length,
    active: users.filter((u) => u.is_active).length,
  }

  const permRoles = [
    {
      key: 'admin' as const,
      label: t('users.roles.admin'), icon: 'admin_panel_settings', color: 'text-red-600',
      perms: t('users.perms.admin', { returnObjects: true }) as string[],
    },
    {
      key: 'ranger' as const,
      label: t('users.roles.ranger'), icon: 'forest', color: 'text-blue-600',
      perms: t('users.perms.ranger', { returnObjects: true }) as string[],
    },
    {
      key: 'viewer' as const,
      label: t('users.roles.viewer'), icon: 'visibility', color: 'text-slate-600',
      perms: t('users.perms.viewer', { returnObjects: true }) as string[],
    },
  ]

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-[#1e293b]">{t('users.title')}</h1>
          <p className="text-xs text-[#64748b] mt-0.5">{t('users.subtitle')}</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] font-medium shadow-sm"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          {t('users.newUser')}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
          <button onClick={loadUsers} className="ml-auto text-red-600 underline">{t('common.retry')}</button>
        </div>
      )}

      {/* Summary cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: t('users.roles.admin'),  count: counts.admin,  icon: 'admin_panel_settings', color: 'text-red-600',     bg: 'bg-red-50' },
            { label: t('users.roles.ranger'), count: counts.ranger, icon: 'forest',               color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: t('users.roles.viewer'), count: counts.viewer, icon: 'visibility',            color: 'text-slate-600',   bg: 'bg-slate-50' },
            { label: t('users.active'),       count: counts.active, icon: 'check_circle',          color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ label, count, icon, color, bg }) => (
            <div key={label} className={`${bg} border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3`}>
              <span className={`material-symbols-outlined ${color} text-2xl`}>{icon}</span>
              <div>
                <p className="text-xs text-[#64748b]">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('users.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRole(e.target.value)}
          className="bg-white border border-[#e2e8f0] text-sm text-[#1e293b] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1565c0]"
        >
          <option value="">{t('users.allRoles')}</option>
          <option value="admin">{t('users.roles.admin')}</option>
          <option value="ranger">{t('users.roles.ranger')}</option>
          <option value="viewer">{t('users.roles.viewer')}</option>
        </select>
        <span className="text-xs text-[#94a3b8] self-center">{filtered.length} {t('common.results')}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              {[t('users.colUser'), t('users.role'), t('users.email'), t('common.status'), t('users.colLastLogin'), t('common.actions')].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-[#f1f5f9]">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-[#f1f5f9] rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#94a3b8] text-xs">{t('common.noData')}</td></tr>
            ) : (
              filtered.map((u) => {
                const rm = ROLE_META[u.role]
                return (
                  <tr key={u.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                    {/* Avatar + name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1565c0] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">
                            {u.full_name.split(' ').pop()?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-[#1e293b] text-xs">{u.full_name}</p>
                          <p className="text-[10px] text-[#94a3b8]">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${rm.cls}`}>
                        <span className="material-symbols-outlined text-xs" style={{ fontSize: 12 }}>{rm.icon}</span>
                        {rm.label}
                      </span>
                    </td>
                    {/* Email */}
                    <td className="px-4 py-3 text-xs text-[#64748b]">{u.email}</td>
                    {/* Status toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {u.is_active ? t('users.statusActive') : t('users.statusLocked')}
                      </button>
                    </td>
                    {/* Last login */}
                    <td className="px-4 py-3 text-xs text-[#64748b] whitespace-nowrap">
                      {u.last_login ? new Date(u.last_login).toLocaleString('vi-VN') : '—'}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal(u)}
                          className="p-1.5 rounded hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1565c0] transition-colors"
                          title={t('common.edit')}
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => setDel(u)}
                          className="p-1.5 rounded hover:bg-red-50 text-[#64748b] hover:text-red-500 transition-colors"
                          title={t('common.delete')}
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Role permission legend */}
      <div className="mt-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-[#64748b] mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">info</span>
          {t('users.permLegendTitle')}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {permRoles.map(({ label, icon, color, perms }) => (
            <div key={label}>
              <p className={`text-xs font-medium ${color} flex items-center gap-1 mb-2`}>
                <span className="material-symbols-outlined text-sm">{icon}</span>
                {label}
              </p>
              <ul className="space-y-1">
                {perms.map((p) => (
                  <li key={p} className="text-[11px] text-[#64748b] flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#cbd5e1] flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modal !== null && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500">delete</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1e293b]">{t('users.deleteTitle')}</p>
                <p className="text-xs text-[#64748b]">{deleteTarget.full_name}</p>
              </div>
            </div>
            <p className="text-xs text-[#64748b] mb-4">
              {t('users.deleteConfirm', { username: deleteTarget.username })}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDel(null)} disabled={deleting} className="px-4 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] disabled:opacity-60">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 font-medium disabled:opacity-60 flex items-center gap-2"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
