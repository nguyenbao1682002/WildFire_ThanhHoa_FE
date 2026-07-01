import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import api from '../api/client'
import { useAuthStore } from '../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Assignee { id: number; username: string; email: string }
interface TaskItem {
  id: number
  incident_id: number
  status: 'pending' | 'in_progress' | 'done' | 'cancelled'
  deadline: string | null
  created_at: string
  updated_at: string
  assigned_to: Assignee | null
  assigned_by: Assignee | null
}
type Period = 'week' | 'month' | 'all'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending: '#94a3b8', in_progress: '#3b82f6', done: '#22c55e', cancelled: '#ef4444',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function filterByPeriod(tasks: TaskItem[], period: Period): TaskItem[] {
  if (period === 'all') return tasks
  const now = new Date()
  const cutoff = period === 'week'
    ? new Date(now.getTime() - 7 * 86_400_000)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  return tasks.filter(t => new Date(t.created_at) >= cutoff)
}

function calcStats(tasks: TaskItem[]) {
  const now = new Date()
  const done = tasks.filter(t => t.status === 'done')
  const doneWithDl = done.filter(t => t.deadline)
  const doneOnTime = doneWithDl.filter(t => new Date(t.updated_at) <= new Date(t.deadline!))
  return {
    total: tasks.length,
    done: done.length,
    active: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    overdue: tasks.filter(t =>
      t.deadline && !['done', 'cancelled'].includes(t.status) && new Date(t.deadline) < now
    ).length,
    slaRate: doneWithDl.length ? Math.round(doneOnTime.length / doneWithDl.length * 100) : null,
    doneWithDl: doneWithDl.length,
  }
}

function buildLeaderboard(tasks: TaskItem[]) {
  const now = new Date()
  const map = new Map<string, {
    username: string; total: number; done: number; overdue: number;
    doneOnTime: number; doneWithDl: number;
  }>()
  for (const t of tasks) {
    if (!t.assigned_to) continue
    const key = t.assigned_to.username
    if (!map.has(key)) map.set(key, { username: key, total: 0, done: 0, overdue: 0, doneOnTime: 0, doneWithDl: 0 })
    const e = map.get(key)!
    e.total++
    if (t.status === 'done') {
      e.done++
      if (t.deadline) {
        e.doneWithDl++
        if (new Date(t.updated_at) <= new Date(t.deadline)) e.doneOnTime++
      }
    }
    if (t.deadline && !['done', 'cancelled'].includes(t.status) && new Date(t.deadline) < now) e.overdue++
  }
  return Array.from(map.values()).sort((a, b) => {
    const sa = a.doneWithDl ? a.doneOnTime / a.doneWithDl : -1
    const sb = b.doneWithDl ? b.doneOnTime / b.doneWithDl : -1
    return sb - sa
  })
}

function buildWeekly(tasks: TaskItem[]) {
  const now = new Date()
  return Array.from({ length: 4 }, (_, i) => {
    const end = new Date(now.getTime() - i * 7 * 86_400_000)
    const start = new Date(end.getTime() - 7 * 86_400_000)
    const label = `${start.getDate()}/${start.getMonth() + 1}`
    const wt = tasks.filter(t => { const d = new Date(t.created_at); return d >= start && d < end })
    return { label, assigned: wt.length, done: wt.filter(t => t.status === 'done').length }
  }).reverse()
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Performance() {
  const { t } = useTranslation()
  const { user, hasRole } = useAuthStore()
  const isAdmin = hasRole('admin')

  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')

  useEffect(() => {
    api.get('/tasks/').then(r => setTasks(r.data)).catch(() => setTasks([])).finally(() => setLoading(false))
  }, [])

  const myTasks = useMemo(() =>
    isAdmin ? tasks : tasks.filter(t => t.assigned_to?.id === user?.id),
  [tasks, user, isAdmin])

  const filtered    = useMemo(() => filterByPeriod(myTasks, period), [myTasks, period])
  const stats       = useMemo(() => calcStats(filtered), [filtered])
  const leaderboard = useMemo(() => buildLeaderboard(isAdmin ? filtered : []), [filtered, isAdmin])
  const weeklyData  = useMemo(() => buildWeekly(filtered), [filtered])

  const STATUS_LABEL: Record<string, string> = {
    pending: t('performance.statusLabels.pending'),
    in_progress: t('performance.statusLabels.in_progress'),
    done: t('performance.statusLabels.done'),
    cancelled: t('performance.statusLabels.cancelled'),
  }

  const pieData = useMemo(() => {
    const cnt = { pending: 0, in_progress: 0, done: 0, cancelled: 0 }
    filtered.forEach(t => { cnt[t.status]++ })
    return Object.entries(cnt).filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: STATUS_LABEL[k], value: v, color: STATUS_COLOR[k] }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, t])

  const leaderBarData = leaderboard.slice(0, 8).map(u => ({
    name: u.username, done: u.done, active: u.total - u.done - u.overdue,
  }))

  const PERIODS: { id: Period; label: string }[] = [
    { id: 'week',  label: t('performance.periods.week') },
    { id: 'month', label: t('performance.periods.month') },
    { id: 'all',   label: t('performance.periods.all') },
  ]

  const slaColor = stats.slaRate === null ? '#64748b'
    : stats.slaRate >= 80 ? '#16a34a' : stats.slaRate >= 60 ? '#d97706' : '#dc2626'

  const CARDS = [
    { label: t('performance.cards.total'),   value: stats.total,   icon: 'assignment',     color: '#1565c0', bg: '#eff6ff', sub: isAdmin ? t('performance.cards.subSystem') : t('performance.cards.subMy') },
    { label: t('performance.cards.done'),    value: stats.done,    icon: 'task_alt',        color: '#16a34a', bg: '#f0fdf4', sub: stats.total ? `${Math.round(stats.done / stats.total * 100)}% ${t('performance.percentTotal')}` : '0%' },
    { label: t('performance.cards.active'),  value: stats.active,  icon: 'pending_actions', color: '#2563eb', bg: '#eff6ff', sub: t('performance.cards.subActive') },
    { label: t('performance.cards.overdue'), value: stats.overdue, icon: 'schedule',        color: stats.overdue > 0 ? '#dc2626' : '#64748b', bg: stats.overdue > 0 ? '#fef2f2' : '#f8fafc', sub: t('performance.cards.subOverdue') },
    { label: t('performance.cards.sla'),     value: stats.slaRate !== null ? `${stats.slaRate}%` : 'N/A', icon: 'speed', color: slaColor, bg: '#f8fafc', sub: `${stats.doneWithDl} ${t('performance.cards.subDl')}` },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#1565c0] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 space-y-6 min-h-full bg-[#f0f4f8]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1e293b]">
            {isAdmin ? t('performance.teamTitle') : t('performance.myTitle')}
          </h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            {isAdmin
              ? t('performance.teamSubtitle')
              : `${t('performance.mySubtitle')} ${user?.username ?? '—'}`}
          </p>
        </div>
        <div className="flex gap-1 bg-white border border-[#e2e8f0] rounded-xl p-1 self-start">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p.id ? 'bg-[#1565c0] text-white shadow-sm' : 'text-[#64748b] hover:text-[#1e293b]'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {CARDS.map(({ label, value, icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-[#e2e8f0] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748b] leading-tight">{label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                <span className="material-symbols-outlined text-base" style={{ color }}>{icon}</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
              <p className="text-[11px] text-[#94a3b8] mt-1.5 leading-tight">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status pie */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4">{t('performance.pieTitle')}</h2>
          {pieData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-[#94a3b8]">{t('performance.noData')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={88} paddingAngle={3} dataKey="value">
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [v, t('performance.tasks')]} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4">
            {isAdmin ? t('performance.barTitleAdmin') : t('performance.barTitleMy')}
          </h2>
          {(isAdmin ? leaderBarData : weeklyData).length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-[#94a3b8]">{t('performance.noData')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={(isAdmin ? leaderBarData : weeklyData) as object[]} barSize={18} barGap={3}>
                <XAxis dataKey={isAdmin ? 'name' : 'label'} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} width={28} />
                <Tooltip />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                {isAdmin ? (
                  <>
                    <Bar dataKey="done"   name={t('performance.cards.done')}   fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="active" name={t('performance.cards.active')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="assigned" name={t('performance.assigned')}    fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="done"     name={t('performance.cards.done')}  fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Leaderboard (admin only) ────────────────────────────────────────── */}
      {isAdmin && leaderboard.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#e2e8f0]">
            <span className="material-symbols-outlined text-[#1565c0] text-base">leaderboard</span>
            <h2 className="text-sm font-semibold text-[#1e293b]">{t('performance.leaderboard.title')}</h2>
            <span className="text-xs text-[#94a3b8] ml-1">{t('performance.leaderboard.subtitle')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  {[
                    t('performance.leaderboard.colRank'),
                    t('performance.leaderboard.colRanger'),
                    t('performance.leaderboard.colTotal'),
                    t('performance.leaderboard.colDone'),
                    t('performance.leaderboard.colOverdue'),
                    t('performance.leaderboard.colSLA'),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {leaderboard.map((row, i) => {
                  const sla = row.doneWithDl ? Math.round(row.doneOnTime / row.doneWithDl * 100) : null
                  const sc = sla === null ? '#94a3b8' : sla >= 80 ? '#16a34a' : sla >= 60 ? '#d97706' : '#dc2626'
                  const rankCls = i === 0 ? 'bg-amber-100 text-amber-700'
                    : i === 1 ? 'bg-slate-100 text-slate-500'
                    : i === 2 ? 'bg-orange-100 text-orange-600'
                    : 'bg-[#f1f5f9] text-[#64748b]'
                  return (
                    <tr key={row.username} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${rankCls}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1e293b]">{row.username}</td>
                      <td className="px-4 py-3 text-[#64748b]">{row.total}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#16a34a]">{row.done}</span>
                        {row.total > 0 && <span className="text-[#94a3b8] text-xs ml-1.5">({Math.round(row.done / row.total * 100)}%)</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.overdue > 0
                          ? <span className="font-medium text-red-500">{row.overdue}</span>
                          : <span className="text-[#94a3b8]">0</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold" style={{ color: sc }}>
                          {sla !== null ? `${sla}%` : 'N/A'}
                        </span>
                        {sla !== null && (
                          <div className="w-16 h-1.5 bg-[#f1f5f9] rounded-full mt-1 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${sla}%`, backgroundColor: sc }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] py-16 flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-5xl text-[#cbd5e1]">assignment</span>
          <p className="text-sm text-[#64748b]">{t('performance.emptyState')}</p>
          <p className="text-xs text-[#94a3b8]">{t('performance.emptyTip')}</p>
        </div>
      )}

    </div>
  )
}
