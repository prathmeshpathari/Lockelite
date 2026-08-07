import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

const Field = ({ name, label, type = 'text', placeholder, half, values, setValues, errors }) => (
  <div className={half ? '' : 'col-span-2'}>
    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
    <input type={type} value={values[name]} onChange={e => setValues({...values,[name]:e.target.value})}
      placeholder={placeholder}
      className={`input-field ${errors[name] ? 'error' : ''}`}/>
    {errors[name] && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs"/>{errors[name]}</p>}
  </div>
)

export default function RegisterPage() {
  const [f, setF] = useState({ fullName:'', email:'', username:'', password:'', confirm:'', phoneNumber:'', dateOfBirth:'' })
  const [agreed, setAgreed]   = useState(false)
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [apiErr, setApiErr]   = useState('')
  const { show } = useToast()
  const navigate = useNavigate()

  const validate = () => {
    const e = {}
    if (!f.fullName.trim()) {
      e.fullName = 'Full name is required'
    } else if (f.fullName.length < 2 || f.fullName.length > 100) {
      e.fullName = 'Full name must be 2-100 characters'
    } else if (!/^[a-zA-Z\s]+$/.test(f.fullName)) {
      e.fullName = 'Full name can only contain alphabets and spaces'
    }

    if (!f.email.trim()) {
      e.email = 'Email is required'
    } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/.test(f.email)) {
      e.email = 'Valid email format required'
    }

    if (!f.username || f.username.length < 3) e.username = 'Min 3 characters'
    else if (!/^[a-zA-Z0-9_]+$/.test(f.username)) e.username = 'Only letters, numbers, underscore'

    if (!f.password) {
      e.password = 'Password is required'
    } else if (f.password.length < 8) {
      e.password = 'Password must be at least 8 characters'
    } else if (!/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/.test(f.password)) {
      e.password = 'Password must contain at least one letter, one number, and one special character'
    }

    if (f.password !== f.confirm) e.confirm = 'Passwords do not match'

    if (!/^[6-9]\d{9}$/.test(f.phoneNumber)) {
      e.phoneNumber = 'Enter a valid 10-digit mobile number starting with 6-9'
    }

    if (!f.dateOfBirth) e.dateOfBirth = 'Date of birth required'
    if (!agreed) e.agreed = 'Please accept terms & conditions'
    return e
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(); setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true); setApiErr('')
    try {
      await api.post('/auth/register', { ...f, termsAccepted: true })
      show('Account created! Check your email for OTP.', 'success')
      navigate('/verify-otp', { state: { email: f.email } })
    } catch(ex) { setApiErr(ex.response?.data?.message || 'Registration failed. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all shadow-sm">
            <i className="ti ti-arrow-left text-xs"/>
            Back
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold">LE</div>
            <span className="font-bold text-slate-900 tracking-widest text-sm">LOCKELITE</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 mb-6">We'll send a 6-digit OTP to verify your email.</p>

          {apiErr && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              <i className="ti ti-alert-circle flex-shrink-0 mt-0.5"/><span>{apiErr}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field name="fullName"    label="Full Name"     placeholder="Prasad Mane" values={f} setValues={setF} errors={errors} />
              <Field name="email"       label="Email Address" type="email" placeholder="you@example.com" values={f} setValues={setF} errors={errors} />
              <Field name="username"    label="Username"      placeholder="prasad_m"  half values={f} setValues={setF} errors={errors} />
              <Field name="phoneNumber" label="Mobile Number" type="tel"  placeholder="9876543210" half values={f} setValues={setF} errors={errors} />
              <Field name="dateOfBirth" label="Date of Birth" type="date" half values={f} setValues={setF} errors={errors} />
              <div/>
              <Field name="password"    label="Password"         type="password" placeholder="Min 8 chars, letters+numbers" half values={f} setValues={setF} errors={errors} />
              <Field name="confirm"     label="Confirm Password" type="password" placeholder="Repeat password" half values={f} setValues={setF} errors={errors} />
            </div>

            <div className="flex items-start gap-2.5 mb-5">
              <input type="checkbox" id="tc" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"/>
              <label htmlFor="tc" className="text-xs text-slate-600 cursor-pointer leading-relaxed">
                I agree to the <span className="text-primary font-medium">Terms & Conditions</span> and <span className="text-primary font-medium">Privacy Policy</span>
              </label>
            </div>
            {errors.agreed && <p className="text-xs text-red-500 mb-3 flex items-center gap-1"><i className="ti ti-alert-circle text-xs"/>{errors.agreed}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Creating account...</span></>
              ) : (
                <><i className="ti ti-user-plus"/><span>Create account & verify email</span></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
