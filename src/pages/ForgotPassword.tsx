import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import estecLogo from '../assets/logo-estec.jpg'

type Step = 'request' | 'reset' | 'done'

export default function ForgotPassword() {
  const navigate = useNavigate()

  const [step, setStep]             = useState<Step>('request')
  const [identity, setIdentity]     = useState('')   // username or email
  const [otp, setOtp]               = useState('')
  const [newPwd, setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [resending, setResending]   = useState(false)

  // ── Step 1: request OTP ──────────────────────────────────────────────────────
  async function handleRequest(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { username_or_email: identity.trim() })
      setStep('reset')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Không tìm thấy tài khoản. Kiểm tra lại tên đăng nhập hoặc email.')
    } finally {
      setLoading(false)
    }
  }

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  async function handleResend() {
    setResending(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { username_or_email: identity.trim() })
    } catch {
      setError('Không thể gửi lại mã. Vui lòng thử lại.')
    } finally {
      setResending(false)
    }
  }

  // ── Step 2: reset password ───────────────────────────────────────────────────
  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (otp.trim().length < 4) { setError('Nhập mã OTP đầy đủ.'); return }
    if (newPwd.length < 8)     { setError('Mật khẩu mới phải có ít nhất 8 ký tự.'); return }
    if (newPwd !== confirmPwd) { setError('Mật khẩu xác nhận không khớp.'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        username_or_email: identity.trim(),
        otp: otp.trim(),
        new_password: newPwd,
      })
      setStep('done')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // ── Shared focus/blur style ──────────────────────────────────────────────────
  const focusProps = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = '#2E6B3E'
      e.target.style.boxShadow   = '0 0 0 2px rgba(46,107,62,0.2)'
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = '#c2c7cf'
      e.target.style.boxShadow   = 'none'
    },
  }

  // ── Step indicator ───────────────────────────────────────────────────────────
  const steps = [
    { id: 'request', label: 'Xác định tài khoản' },
    { id: 'reset',   label: 'Đặt lại mật khẩu' },
    { id: 'done',    label: 'Hoàn tất' },
  ]
  const stepIdx = steps.findIndex(s => s.id === step)

  return (
    <main className="flex flex-col md:flex-row min-h-screen w-full" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

      {/* Left: forest image */}
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
              Bảo vệ rừng là bảo vệ cuộc sống của chúng ta
            </h2>
            <div className="w-16 h-1 bg-[#708238] mb-6" />
            <p className="text-lg text-white/90 leading-relaxed">
              Chi cục Kiểm lâm Thanh Hóa cam kết ứng dụng công nghệ hiện đại
              trong việc giám sát và phòng cháy chữa cháy rừng trên toàn địa bàn tỉnh.
            </p>
          </div>
        </div>
      </section>

      {/* Right: form */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-6"
               style={{ backgroundColor: '#f2f4f6' }}>

        <div className="w-full max-w-[420px] bg-white border border-[#c2c7cf] rounded-lg p-8 shadow-sm">

          {/* Header */}
          <header className="flex flex-col items-center text-center mb-6">
            <img src={estecLogo} alt="ESTEC" className="h-14 w-auto object-contain mb-3" />
            <h1 className="text-xl font-semibold text-[#1a2e4a] mb-1">Khôi phục mật khẩu</h1>
            <p className="text-xs text-[#42474e]">Hệ thống PCCCR Thanh Hóa</p>
          </header>

          {/* Step indicator */}
          {step !== 'done' && (
            <div className="flex items-center mb-6">
              {steps.slice(0, 2).map((s, i) => (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      i < stepIdx
                        ? 'bg-[#2E6B3E] border-[#2E6B3E] text-white'
                        : i === stepIdx
                        ? 'border-[#2E6B3E] text-[#2E6B3E] bg-white'
                        : 'border-[#c2c7cf] text-[#94a3b8] bg-white'
                    }`}>
                      {i < stepIdx
                        ? <span className="material-symbols-outlined text-sm">check</span>
                        : i + 1}
                    </div>
                    <span className={`text-[9px] mt-1 text-center leading-tight ${i === stepIdx ? 'text-[#2E6B3E] font-medium' : 'text-[#94a3b8]'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 transition-all ${i < stepIdx ? 'bg-[#2E6B3E]' : 'bg-[#e2e8f0]'}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 1: request ─────────────────────────────────────────────── */}
          {step === 'request' && (
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
                <span>Nhập tên đăng nhập hoặc địa chỉ email đã đăng ký. Hệ thống sẽ gửi mã OTP để xác minh danh tính.</span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#42474e]" htmlFor="identity">
                  Tên đăng nhập hoặc Email
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#73777f] text-xl pointer-events-none">
                    person_search
                  </span>
                  <input
                    id="identity"
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    required
                    autoFocus
                    placeholder="username hoặc email@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9fb] border border-[#c2c7cf] rounded transition-all outline-none text-sm text-[#191c1e] placeholder-[#73777f]"
                    {...focusProps}
                  />
                </div>
              </div>

              {error && <ErrorBox msg={error} />}

              <button
                type="submit"
                disabled={loading || !identity.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold tracking-wide shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: '#2E6B3E' }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#245431' }}
                onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2E6B3E' }}
              >
                {loading
                  ? <><span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>Đang gửi...</>
                  : <><span className="material-symbols-outlined text-xl">send</span>Gửi mã OTP</>}
              </button>
            </form>
          )}

          {/* ── Step 2: reset ───────────────────────────────────────────────── */}
          {step === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">mark_email_read</span>
                <span>
                  Mã OTP đã được gửi đến email của tài khoản <strong>{identity}</strong>. Mã có hiệu lực trong <strong>10 phút</strong>.
                </span>
              </div>

              {/* OTP input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#42474e]" htmlFor="otp">
                  Mã OTP
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#73777f] text-xl pointer-events-none">
                    pin
                  </span>
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    required
                    autoFocus
                    placeholder="Nhập mã OTP từ email"
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9fb] border border-[#c2c7cf] rounded transition-all outline-none text-sm text-[#191c1e] placeholder-[#73777f] font-mono tracking-widest"
                    {...focusProps}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-[11px] text-[#708238] hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Đang gửi lại...' : 'Gửi lại mã'}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#42474e]" htmlFor="newpwd">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#73777f] text-xl pointer-events-none">
                    lock
                  </span>
                  <input
                    id="newpwd"
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    required
                    placeholder="Ít nhất 8 ký tự"
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9fb] border border-[#c2c7cf] rounded transition-all outline-none text-sm text-[#191c1e] placeholder-[#73777f]"
                    {...focusProps}
                  />
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#42474e]" htmlFor="confirmpwd">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#73777f] text-xl pointer-events-none">
                    lock_clock
                  </span>
                  <input
                    id="confirmpwd"
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    required
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9fb] border border-[#c2c7cf] rounded transition-all outline-none text-sm text-[#191c1e] placeholder-[#73777f]"
                    {...focusProps}
                  />
                </div>
                {/* Password match hint */}
                {confirmPwd.length > 0 && (
                  <p className={`text-[11px] flex items-center gap-1 ${newPwd === confirmPwd ? 'text-emerald-600' : 'text-red-500'}`}>
                    <span className="material-symbols-outlined text-sm">
                      {newPwd === confirmPwd ? 'check_circle' : 'cancel'}
                    </span>
                    {newPwd === confirmPwd ? 'Mật khẩu khớp' : 'Mật khẩu không khớp'}
                  </p>
                )}
              </div>

              {error && <ErrorBox msg={error} />}

              <button
                type="submit"
                disabled={loading || !otp || !newPwd || !confirmPwd}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold tracking-wide shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: '#2E6B3E' }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#245431' }}
                onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2E6B3E' }}
              >
                {loading
                  ? <><span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>Đang xử lý...</>
                  : <><span className="material-symbols-outlined text-xl">lock_reset</span>Đặt lại mật khẩu</>}
              </button>
            </form>
          )}

          {/* ── Done ────────────────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-600 text-4xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#191c1e] mb-1">Đặt lại mật khẩu thành công!</h2>
                <p className="text-xs text-[#42474e]">
                  Mật khẩu của tài khoản <strong>{identity}</strong> đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold tracking-wide shadow-sm transition-all"
                style={{ backgroundColor: '#2E6B3E' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#245431')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2E6B3E')}
              >
                <span className="material-symbols-outlined text-xl">login</span>
                Đăng nhập ngay
              </button>
            </div>
          )}

          {/* Back to login */}
          {step !== 'done' && (
            <div className="mt-5 pt-5 border-t border-[#c2c7cf] text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-[#708238] hover:underline font-medium">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Quay lại đăng nhập
              </Link>
            </div>
          )}
        </div>

        <footer className="mt-8 text-center">
          <p className="text-xs text-[#42474e] opacity-70">
            © {new Date().getFullYear()} Chi cục Kiểm lâm Thanh Hóa. Bảo lưu mọi quyền.
          </p>
        </footer>
      </section>
    </main>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-[#ffe5e0] text-[#93000a] rounded border border-[#ba1a1a]/20 text-sm">
      <span className="material-symbols-outlined text-xl flex-shrink-0">error</span>
      <span>{msg}</span>
    </div>
  )
}
