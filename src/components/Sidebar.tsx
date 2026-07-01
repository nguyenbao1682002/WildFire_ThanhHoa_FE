import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import estecLogo from '../assets/logo-estec.jpg'

export default function Sidebar() {
  const { user, logout, hasRole } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const links = [
    { to: '/dashboard', icon: 'dashboard',             label: t('nav.dashboard') },
    { to: '/map',       icon: 'map',                   label: t('nav.map') },
    { to: '/incidents', icon: 'local_fire_department', label: t('nav.incidents') },
    { to: '/hotspots',  icon: 'crisis_alert',          label: t('nav.hotspots') },
    { to: '/analytics', icon: 'bar_chart',             label: t('nav.analytics') },
    { to: '/bulletins', icon: 'campaign',              label: t('nav.bulletins') },
    { to: '/search',      icon: 'manage_search', label: t('nav.search') },
    { to: '/performance', icon: 'leaderboard',   label: t('nav.performance') },
    { to: '/timelapse',   icon: 'satellite_alt', label: t('nav.timelapse') },
    { to: '/faq',         icon: 'help_center',   label: t('nav.faq') },
  ]

  const adminLinks = [
    { to: '/users',        icon: 'group',                   label: t('nav.users') },
    { to: '/aor',          icon: 'edit_location',           label: t('nav.aor') },
    { to: '/audit-log',    icon: 'history',                 label: t('nav.auditLog') },
    { to: '/integrations', icon: 'hub',                     label: t('nav.integrations') },
    { to: '/cameras',     icon: 'videocam',                label: t('nav.cameras') },
  ]

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex flex-col w-16 lg:w-60 min-h-screen bg-[#1a2e4a] flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-white/10">
        <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-white flex items-center justify-center">
          <img src={estecLogo} alt="ESTEC" className="w-full h-full object-contain" />
        </div>
        <div className="hidden lg:block min-w-0">
          <p className="text-[10px] text-white/40 uppercase tracking-wider leading-tight">Hệ thống</p>
          <p className="text-xs font-semibold text-white leading-tight truncate">PCCCR Thanh Hóa</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {links.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[#1565c0] text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="material-symbols-outlined text-xl flex-shrink-0">{icon}</span>
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}

        {hasRole('admin') && (
          <>
            <div className="my-2 border-t border-white/10" />
            <p className="hidden lg:block px-2.5 pb-1 text-[10px] uppercase tracking-wider text-white/30">
              {t('nav.admin')}
            </p>
            {adminLinks.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-[#1565c0] text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span className="material-symbols-outlined text-xl flex-shrink-0">{icon}</span>
                <span className="hidden lg:block">{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-2 border-t border-white/10">
        <Link to="/profile" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors group">
          <span className="material-symbols-outlined text-white/40 text-xl flex-shrink-0 group-hover:text-white/70">account_circle</span>
          <div className="hidden lg:block min-w-0 flex-1">
            <p className="text-xs text-white/60 truncate group-hover:text-white/80">{user?.username}</p>
            <p className="text-[10px] text-white/30">{t('nav.profile')}</p>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); handleLogout() }}
            title={t('nav.logout')}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded hover:bg-white/20 text-white/40 hover:text-white transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </Link>
      </div>
    </aside>
  )
}
