import { useTranslation } from 'react-i18next'

export default function LangSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language === 'en' ? 'en' : 'vi'

  function toggle() {
    const next = current === 'vi' ? 'en' : 'vi'
    i18n.changeLanguage(next)
    localStorage.setItem('wf-lang', next)
  }

  return (
    <button
      onClick={toggle}
      title={current === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:bg-[#f0f4f8] hover:text-[#1e293b] transition-colors select-none"
    >
      <span className={`font-semibold ${current === 'vi' ? 'text-[#1565c0]' : 'text-[#94a3b8]'}`}>VI</span>
      <span className="text-[#cbd5e1]">/</span>
      <span className={`font-semibold ${current === 'en' ? 'text-[#1565c0]' : 'text-[#94a3b8]'}`}>EN</span>
    </button>
  )
}
