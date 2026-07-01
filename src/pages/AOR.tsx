import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

interface User {
  id: number
  username: string
  full_name: string
  email: string
  role: 'admin' | 'ranger' | 'viewer'
  is_active: boolean
}

interface ApiUser {
  id: number
  username: string
  full_name: string | null
  email: string
  is_active: boolean
  roles: { id: number; name: string }[]
}

function toRanger(u: ApiUser): User {
  const names = u.roles.map((r) => r.name)
  return {
    id:        u.id,
    username:  u.username,
    full_name: u.full_name ?? '',
    email:     u.email,
    is_active: u.is_active,
    role:      names.includes('admin') ? 'admin' : names.includes('ranger') ? 'ranger' : 'viewer',
  }
}

interface Area {
  id: string
  name: string
  type: 'huyen' | 'xa' | 'tieu_khu'
  parent?: string
}

const AREAS: Area[] = [
  // Huyện
  { id: 'nhu-xuan',    name: 'Như Xuân',     type: 'huyen' },
  { id: 'nhu-thanh',   name: 'Như Thanh',    type: 'huyen' },
  { id: 'thuong-xuan', name: 'Thường Xuân',  type: 'huyen' },
  { id: 'lang-chanh',  name: 'Lang Chánh',   type: 'huyen' },
  { id: 'ba-thuoc',    name: 'Bá Thước',     type: 'huyen' },
  { id: 'quan-hoa',    name: 'Quan Hóa',     type: 'huyen' },
  { id: 'quan-son',    name: 'Quan Sơn',     type: 'huyen' },
  { id: 'muong-lat',   name: 'Mường Lát',    type: 'huyen' },
  { id: 'cam-thuy',    name: 'Cẩm Thủy',     type: 'huyen' },
  { id: 'ngoc-lac',    name: 'Ngọc Lặc',     type: 'huyen' },
  // Xã thuộc Như Xuân
  { id: 'nx-xuan-hoa',    name: 'Xuân Hòa',    type: 'xa', parent: 'nhu-xuan' },
  { id: 'nx-xuan-binh',   name: 'Xuân Bình',   type: 'xa', parent: 'nhu-xuan' },
  { id: 'nx-thanh-quang', name: 'Thanh Quang', type: 'xa', parent: 'nhu-xuan' },
  { id: 'nx-xuan-thai',   name: 'Xuân Thái',   type: 'xa', parent: 'nhu-xuan' },
  // Xã thuộc Thường Xuân
  { id: 'tx-bat-mot',   name: 'Bát Mọt',    type: 'xa', parent: 'thuong-xuan' },
  { id: 'tx-yen-nhan',  name: 'Yên Nhân',   type: 'xa', parent: 'thuong-xuan' },
  { id: 'tx-luat-ky',   name: 'Luận Kỳ',    type: 'xa', parent: 'thuong-xuan' },
  { id: 'tx-ngoc-phung',name: 'Ngọc Phụng', type: 'xa', parent: 'thuong-xuan' },
  // Xã thuộc Lang Chánh
  { id: 'lc-dong-khe', name: 'Đồng Khê',  type: 'xa', parent: 'lang-chanh' },
  { id: 'lc-giao-an',  name: 'Giao An',   type: 'xa', parent: 'lang-chanh' },
  { id: 'lc-tam-van',  name: 'Tam Văn',   type: 'xa', parent: 'lang-chanh' },
  // Tiểu khu
  { id: 'tk-001', name: 'Tiểu khu 001', type: 'tieu_khu', parent: 'nhu-xuan' },
  { id: 'tk-002', name: 'Tiểu khu 002', type: 'tieu_khu', parent: 'nhu-xuan' },
  { id: 'tk-003', name: 'Tiểu khu 003', type: 'tieu_khu', parent: 'thuong-xuan' },
  { id: 'tk-004', name: 'Tiểu khu 004', type: 'tieu_khu', parent: 'thuong-xuan' },
  { id: 'tk-005', name: 'Tiểu khu 005', type: 'tieu_khu', parent: 'lang-chanh' },
  { id: 'tk-006', name: 'Tiểu khu 006', type: 'tieu_khu', parent: 'ba-thuoc' },
  { id: 'tk-007', name: 'Tiểu khu 007', type: 'tieu_khu', parent: 'quan-hoa' },
  { id: 'tk-008', name: 'Tiểu khu 008', type: 'tieu_khu', parent: 'muong-lat' },
]

const TYPE_STYLES = {
  huyen:    { cls: 'bg-blue-50 text-blue-700 border-blue-200',     icon: 'location_city' },
  xa:       { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'holiday_village' },
  tieu_khu: { cls: 'bg-amber-50 text-amber-700 border-amber-200',  icon: 'forest' },
}

const STORAGE_KEY = 'wf-aor-assignments'

function loadAssignments(): Record<number, string[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

function saveAssignments(data: Record<number, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ── AOR Assignment Modal ─────────────────────────────────────────────────────

interface ModalProps {
  ranger: User
  assigned: string[]
  onClose: () => void
  onSave: (ids: string[]) => void
}

function AORModal({ ranger, assigned, onClose, onSave }: ModalProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<string>>(new Set(assigned))
  const [typeFilter, setTypeFilter] = useState<Area['type'] | ''>('')
  const [search, setSearch] = useState('')

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const filtered = AREAS.filter((a) => {
    const matchType = !typeFilter || a.type === typeFilter
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const grouped = {
    huyen:    filtered.filter((a) => a.type === 'huyen'),
    xa:       filtered.filter((a) => a.type === 'xa'),
    tieu_khu: filtered.filter((a) => a.type === 'tieu_khu'),
  }

  const parentName = (a: Area) => {
    if (!a.parent) return null
    return AREAS.find((x) => x.id === a.parent)?.name
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[#1e293b]">{t('aor.modalTitle')}</h2>
            <p className="text-xs text-[#64748b] mt-0.5">{ranger.full_name} · @{ranger.username}</p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#64748b]">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-[#f1f5f9] flex gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('aor.modalSearch')}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as Area['type'] | '')}
            className="text-xs border border-[#e2e8f0] rounded-lg px-2 py-1.5 bg-white text-[#1e293b] focus:outline-none focus:border-[#1565c0]"
          >
            <option value="">{t('common.all')}</option>
            <option value="huyen">{t('aor.types.huyen')}</option>
            <option value="xa">{t('aor.types.xa')}</option>
            <option value="tieu_khu">{t('aor.types.tieu_khu')}</option>
          </select>
        </div>

        {/* Selected count */}
        <div className="px-6 py-2 bg-[#f8fafc] border-b border-[#f1f5f9] flex-shrink-0">
          <span className="text-xs text-[#64748b]">{t('aor.selected')}: <strong className="text-[#1565c0]">{selected.size}</strong> {t('aor.areasUnit')}</span>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="ml-3 text-xs text-red-500 hover:underline">{t('aor.clearAll')}</button>
          )}
        </div>

        {/* Area list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
          {(['huyen', 'xa', 'tieu_khu'] as const).map((type) => {
            const items = grouped[type]
            if (!items.length) return null
            const styles = TYPE_STYLES[type]
            return (
              <div key={type}>
                <p className="text-xs font-semibold text-[#64748b] mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">{styles.icon}</span>
                  {t(`aor.types.${type}`)} ({items.length})
                </p>
                <div className="space-y-1">
                  {items.map((area) => (
                    <label
                      key={area.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                        selected.has(area.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'border-transparent hover:bg-[#f8fafc]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(area.id)}
                        onChange={() => toggle(area.id)}
                        className="accent-[#1565c0] w-4 h-4 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-[#1e293b]">{area.name}</span>
                        {area.parent && (
                          <span className="text-[10px] text-[#94a3b8] ml-1.5">· {parentName(area)}</span>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${styles.cls}`}>
                        {t(`aor.types.${type}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc]">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => { onSave([...selected]); onClose() }}
            className="px-4 py-2 text-sm text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] font-medium"
          >
            {t('aor.saveAOR')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AOR() {
  const { t } = useTranslation()
  const [rangers, setRangers]       = useState<User[]>([])
  const [loading, setLoading]       = useState(true)
  const [assignments, setAssignments] = useState<Record<number, string[]>>(loadAssignments)
  const [modalRanger, setModalRanger] = useState<User | null>(null)
  const [search, setSearch]         = useState('')

  useEffect(() => {
    api.get<ApiUser[]>('/users')
      .then(({ data }) => setRangers(
        data
          .filter((u) => u.roles.some((r) => r.name === 'ranger'))
          .map(toRanger)
      ))
      .catch(() => setRangers([]))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = (userId: number, areaIds: string[]) => {
    const next = { ...assignments, [userId]: areaIds }
    setAssignments(next)
    saveAssignments(next)
  }

  const areaById = (id: string) => AREAS.find((a) => a.id === id)

  const filtered = rangers.filter((r) => {
    const q = search.toLowerCase()
    return !search || r.full_name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q)
  })

  const totalAssigned = rangers.filter((r) => (assignments[r.id]?.length ?? 0) > 0).length

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-[#1e293b]">{t('aor.title')}</h1>
          <p className="text-xs text-[#64748b] mt-0.5">{t('aor.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: t('aor.totalRangers'), value: rangers.length,                    icon: 'forest',       color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: t('aor.assigned'),     value: totalAssigned,                     icon: 'check_circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: t('aor.unassigned'),   value: rangers.length - totalAssigned,    icon: 'warning',      color: 'text-amber-600',   bg: 'bg-amber-50' },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} className={`${bg} border border-[#e2e8f0] rounded-xl p-4 flex items-center gap-3`}>
              <span className={`material-symbols-outlined ${color} text-2xl`}>{icon}</span>
              <div>
                <p className="text-xs text-[#64748b]">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs mb-4">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('aor.searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b]"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              {[t('aor.colRanger'), t('aor.colStatus'), t('aor.colAOR'), t('aor.colActions')].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-[#f1f5f9]">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-[#f1f5f9] rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-[#94a3b8]">{t('common.noData')}</td></tr>
            ) : (
              filtered.map((ranger) => {
                const areaIds = assignments[ranger.id] ?? []
                const areas   = areaIds.map(areaById).filter(Boolean) as Area[]
                const hasAOR  = areas.length > 0

                return (
                  <tr key={ranger.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ranger.is_active ? 'bg-[#1565c0]' : 'bg-[#cbd5e1]'}`}>
                          <span className="text-white text-xs font-semibold">
                            {ranger.full_name.split(' ').pop()?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-xs text-[#1e293b]">{ranger.full_name}</p>
                          <p className="text-[10px] text-[#94a3b8]">@{ranger.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Active status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                        ranger.is_active
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ranger.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {ranger.is_active ? t('aor.statusActive') : t('aor.statusLocked')}
                      </span>
                    </td>

                    {/* AOR tags */}
                    <td className="px-4 py-3">
                      {!hasAOR ? (
                        <span className="text-xs text-[#94a3b8] italic">{t('aor.noAOR')}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {areas.slice(0, 4).map((a) => {
                            const styles = TYPE_STYLES[a.type]
                            return (
                              <span key={a.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${styles.cls}`}>
                                {a.name}
                              </span>
                            )
                          })}
                          {areas.length > 4 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#e2e8f0] text-[#64748b] bg-[#f8fafc]">
                              +{areas.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setModalRanger(ranger)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1565c0] border border-[#1565c0]/30 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">edit_location</span>
                        {t('aor.assignBtn')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-[#64748b] mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">info</span>
          {t('aor.legendTitle')}
        </h3>
        <div className="flex gap-6">
          {(Object.entries(TYPE_STYLES) as [Area['type'], typeof TYPE_STYLES[Area['type']]][]).map(([type, styles]) => (
            <div key={type} className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-sm ${styles.cls.split(' ')[1]}`}>{styles.icon}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${styles.cls}`}>{t(`aor.types.${type}`)}</span>
              <span className="text-[11px] text-[#94a3b8]">
                {type === 'huyen' && t('aor.legendDistrict')}
                {type === 'xa' && t('aor.legendCommune')}
                {type === 'tieu_khu' && t('aor.legendSubZone')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalRanger && (
        <AORModal
          ranger={modalRanger}
          assigned={assignments[modalRanger.id] ?? []}
          onClose={() => setModalRanger(null)}
          onSave={(ids) => handleSave(modalRanger.id, ids)}
        />
      )}
    </div>
  )
}
