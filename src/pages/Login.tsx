import { useState, useRef, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import estecLogo from '../assets/logo-estec.jpg'

export default function Login() {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const cardRef  = useRef<HTMLDivElement>(null)
  const login    = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch {
      setError(t('auth.loginFail'))
      // shake animation
      const card = cardRef.current
      if (card) {
        card.classList.add('animate-shake')
        setTimeout(() => card.classList.remove('animate-shake'), 400)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col md:flex-row min-h-screen w-full" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

      {/* ── Cột trái: Ảnh rừng + overlay ──────────────────────────────────── */}
      <section className="hidden md:flex relative md:w-2/5 lg:w-3/5 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1400&q=80"
          alt="Khu rừng Thanh Hóa"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12"
             style={{ backgroundColor: 'rgba(46,107,62,0.75)', backdropFilter: 'blur(2px)' }}>
          <div className="max-w-xl">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              {t('auth.loginSlogan')}
            </h2>
            <div className="w-16 h-1 bg-[#708238] mb-6" />
            <p className="text-lg text-white/90 leading-relaxed">
              {t('auth.loginDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* ── Cột phải: Form đăng nhập ────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-6"
               style={{ backgroundColor: '#f2f4f6' }}>

        {/* Card */}
        <div ref={cardRef}
             className="w-full max-w-[420px] bg-white border border-[#c2c7cf] rounded-lg p-8 shadow-sm">

          {/* Logo + tên hệ thống */}
          <header className="flex flex-col items-center text-center mb-6">
            <img src={estecLogo} alt="ESTEC" className="h-16 w-auto object-contain mb-4" />
            <h1 className="text-2xl font-semibold text-[#1a2e4a] mb-1">Hệ thống Wildfire</h1>
            <p className="text-xs font-medium text-[#42474e] uppercase tracking-wider">
              Chi cục Kiểm lâm Thanh Hóa
            </p>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Tên đăng nhập */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#42474e]" htmlFor="username">
                {t('auth.username')}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#73777f] text-xl pointer-events-none">
                  person
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder={t('auth.usernamePlaceholder')}
                  className="w-full pl-10 pr-4 py-3 bg-[#f8f9fb] border border-[#c2c7cf] rounded transition-all outline-none text-sm text-[#191c1e] placeholder-[#73777f]"
                  style={{ focusBorderColor: '#2E6B3E' } as React.CSSProperties}
                  onFocus={(e) => { e.target.style.borderColor = '#2E6B3E'; e.target.style.boxShadow = '0 0 0 2px rgba(46,107,62,0.2)' }}
                  onBlur={(e)  => { e.target.style.borderColor = '#c2c7cf'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Mật khẩu */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#42474e]" htmlFor="password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#73777f] text-xl pointer-events-none">
                  lock
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-[#f8f9fb] border border-[#c2c7cf] rounded transition-all outline-none text-sm text-[#191c1e] placeholder-[#73777f]"
                  onFocus={(e) => { e.target.style.borderColor = '#2E6B3E'; e.target.style.boxShadow = '0 0 0 2px rgba(46,107,62,0.2)' }}
                  onBlur={(e)  => { e.target.style.borderColor = '#c2c7cf'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Ghi nhớ + Quên mật khẩu */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-[#c2c7cf] accent-[#708238]" />
                <span className="text-sm text-[#42474e] group-hover:text-[#2E6B3E] transition-colors">
                  {t('auth.rememberMe')}
                </span>
              </label>
              <Link to="/forgot-password" className="text-sm text-[#708238] hover:underline">{t('auth.forgotPassword')}</Link>
            </div>

            {/* Lỗi */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-[#ffe5e0] text-[#93000a] rounded border border-[#ba1a1a]/20 text-sm">
                <span className="material-symbols-outlined text-xl flex-shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Nút đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-lg text-white text-sm font-semibold tracking-wide shadow-sm transition-all active:scale-[0.98]"
              style={{ backgroundColor: loading ? '#4a8c5c' : '#2E6B3E' }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#245431' }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2E6B3E' }}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  {t('auth.authenticating')}
                </>
              ) : (
                <>
                  {t('auth.loginBtn')}
                  <span className="material-symbols-outlined text-xl">login</span>
                </>
              )}
            </button>
          </form>

          {/* Footer links trong card */}
          <div className="mt-6 pt-6 border-t border-[#c2c7cf] flex justify-center gap-6 text-[#42474e]">
            <button className="flex items-center gap-1 text-xs font-semibold hover:text-[#2E6B3E] transition-colors">
              <span className="material-symbols-outlined text-lg">security</span>
              {t('auth.twoFactor')}
            </button>
          </div>
        </div>

        {/* Footer ngoài card */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-[#42474e] opacity-70">
            © {new Date().getFullYear()} {t('auth.copyright')}
          </p>
          <div className="mt-2 flex gap-4 justify-center">
            <a href="#" className="text-xs text-[#73777f] hover:text-[#708238] underline decoration-dotted">{t('auth.privacyPolicy')}</a>
            <a href="#" className="text-xs text-[#73777f] hover:text-[#708238] underline decoration-dotted">{t('auth.userGuide')}</a>
          </div>
        </footer>
      </section>
    </main>
  )
}
