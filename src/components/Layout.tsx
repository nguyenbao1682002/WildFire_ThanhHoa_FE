import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import LangSwitcher from './LangSwitcher'
import AlertToastContainer from './AlertToast'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAlertStore } from '../store/alertStore'

export default function Layout() {
  const { t } = useTranslation()
  const { wsConnected } = useAlertStore()

  useWebSocket()

  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-11 border-b border-[#e2e8f0] bg-white flex items-center px-5 gap-3 flex-shrink-0 shadow-sm">
          <span className="material-symbols-outlined text-[#1565c0] text-base">shield</span>
          <span className="text-xs text-[#64748b]">
            {t('layout.systemTitle')}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <LangSwitcher />
            <NotificationBell />
            <div className={`flex items-center gap-1.5 text-xs ${wsConnected ? 'text-emerald-600' : 'text-[#94a3b8]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[#94a3b8]'}`} />
              {wsConnected ? t('layout.online') : t('layout.connecting')}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <AlertToastContainer />
    </div>
  )
}
