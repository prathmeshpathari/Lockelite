import { useState, useEffect } from 'react'
import { jwtDecode } from 'jwt-decode'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'



export default function LoginPage() {
  const [emailOrUsername, setEOU] = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const { login, user, redirectPath } = useAuth()
  const { show } = useToast()
  const navigate  = useNavigate()

  // Handle OAuth2 redirect — token comes in URL after Google login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      localStorage.setItem('le_access_token', token)
      try {
        const decoded = jwtDecode(token)
        const storedBranchId = localStorage.getItem('le_branch_id')
        const hasBranch = decoded.branchId || storedBranchId
        // Use window.location for reliable redirect after OAuth2
        if (decoded.role === 'CUSTOMER' && !hasBranch) {
          window.location.href = '/select-bank'
        } else if (decoded.role === 'EMPLOYEE') {
          window.location.href = '/employee/dashboard'
        } else if (decoded.role === 'ADMIN') {
          window.location.href = '/admin/dashboard'
        } else {
          window.location.href = '/customer/dashboard'
        }
      } catch (e) {
        window.location.href = '/customer/dashboard'
      }
    }
  }, [])



  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { role, passwordChanged, branchId, decoded } = await login(emailOrUsername, password)
      // Show bank-specific welcome
      const bankName = decoded?.bankName || 'LockElite'
      show(`Welcome to ${bankName} portal! 🎉`, 'success')

      // Store branchId in localStorage so it persists across refreshes
      if (branchId) localStorage.setItem('le_branch_id', branchId)

      if (role === 'EMPLOYEE' && !passwordChanged) { navigate('/change-password'); return }
      if (role === 'CUSTOMER' && !branchId)        { navigate('/select-bank'); return }
      navigate(redirectPath(role))
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background:'var(--color-bg)' }}>
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-xl">
        {/* Header containing Back button and Brand Logo */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all shadow-sm">
            <i className="ti ti-arrow-left text-xs"/>
            Back
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F68222] flex items-center justify-center text-white font-bold">LE</div>
            <div className="text-left">
              <div className="text-slate-900 font-bold tracking-widest text-sm leading-none mb-1">LOCKELITE</div>
              <div className="text-slate-400 text-[9px] uppercase tracking-wider">Locker Platform</div>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1 text-center">Welcome back</h1>
        <p className="text-sm text-slate-500 mb-7 text-center">
          Sign in to access your account.
        </p>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            <i className="ti ti-alert-circle text-base flex-shrink-0 mt-0.5"/>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Email or Username</label>
            <input type="text" value={emailOrUsername} onChange={e => setEOU(e.target.value)}
              placeholder="you@example.com" required className="input-field"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Your password" required className="input-field pr-12"/>
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'} text-base`}/>
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs font-medium hover:underline" style={{ color:'var(--color-primary,#F68222)' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background:'var(--color-primary,#F68222)' }}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Signing in...</span></>
            ) : (
              <><i className="ti ti-login"/><span>Sign in</span></>
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200"/>
          <span className="text-xs text-slate-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-200"/>
        </div>

        <button onClick={() => window.location.href = 'http://localhost:8080/oauth2/authorization/google'}
          className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 flex items-center justify-center gap-2.5 hover:border-slate-300 hover:shadow-sm transition-all font-medium font-semibold">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-xs text-slate-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold hover:underline" style={{ color:'var(--color-primary,#F68222)' }}>
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}