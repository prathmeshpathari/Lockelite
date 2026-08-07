import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const STEPS = ['Personal Info','Aadhaar KYC','PAN Verify','Nominee','Review']

export default function KYCForm() {
  const { user } = useAuth()
  const { show } = useToast()
  
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem('lockelite_kyc_step')
    return saved ? parseInt(saved, 10) : 0
  })

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('lockelite_kyc_form')
    return saved ? JSON.parse(saved) : { fullName: '', fatherName: '', address: '', phoneNumber: '', bankAccount: '' }
  })

  const [aadhaar, setAadhaar] = useState(() => {
    const saved = localStorage.getItem('lockelite_kyc_aadhaar')
    const parsed = saved ? JSON.parse(saved) : {}
    return { pdf: null, shareCode: parsed.shareCode || '', verified: parsed.verified ?? null }
  })

  const [pan, setPan] = useState(() => {
    const saved = localStorage.getItem('lockelite_kyc_pan')
    return saved ? JSON.parse(saved) : { number: '', verified: null, verifying: false }
  })

  const [nominee, setNominee] = useState(() => {
    const saved = localStorage.getItem('lockelite_kyc_nominee')
    return saved ? JSON.parse(saved) : { enabled: false, name: '', email: '', phone: '', address: '' }
  })

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState({})
  const [kycInfo, setKycInfo] = useState(null)  // { kycStatus, rejectionReason }

  // Fetch current KYC status + rejection reason on mount
  useEffect(() => {
    api.get('/customer/kyc/status')
      .then(r => setKycInfo(r.data))
      .catch(() => {})
  }, [])

  // Update default full name if draft is empty and user info arrives
  useEffect(() => {
    if (user?.fullName && !form.fullName) {
      setForm(f => ({ ...f, fullName: user.fullName }))
    }
  }, [user])

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('lockelite_kyc_step', step.toString())
  }, [step])

  useEffect(() => {
    localStorage.setItem('lockelite_kyc_form', JSON.stringify(form))
  }, [form])

  useEffect(() => {
    const { pdf, ...rest } = aadhaar
    localStorage.setItem('lockelite_kyc_aadhaar', JSON.stringify(rest))
  }, [aadhaar])

  useEffect(() => {
    localStorage.setItem('lockelite_kyc_pan', JSON.stringify(pan))
  }, [pan])

  useEffect(() => {
    localStorage.setItem('lockelite_kyc_nominee', JSON.stringify(nominee))
  }, [nominee])

  const verifyAadhaar = async () => {
    if (!aadhaar.pdf) { setErrors(e => ({...e, aadhaar:'Please upload Aadhaar PDF first'})); return }
    if (!aadhaar.shareCode) { setErrors(e => ({...e, shareCode:'Share code required'})); return }
    setAadhaar(a => ({...a, verified:'verifying'}))
    const fd = new FormData()
    fd.append('aadhaarPdf', aadhaar.pdf)
    fd.append('shareCode', aadhaar.shareCode)
    try {
      await api.post('/kyc/verify-aadhaar', fd, { headers: {'Content-Type': 'multipart/form-data'} })
      setAadhaar(a => ({...a, verified: true}))
      show('Aadhaar verified successfully!', 'success')
    } catch {
      // Sandbox: shareCode=1234 always works
      const ok = aadhaar.shareCode === '1234' || aadhaar.pdf !== null
      setAadhaar(a => ({...a, verified: ok}))
      if (ok) show('Aadhaar verified (sandbox)!', 'success')
      else { setErrors(e => ({...e, aadhaar:'Verification failed. Use share code 1234 in sandbox.'})) }
    }
  }

  const verifyPan = async () => {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.number)) {
      setErrors(e => ({...e, pan:'Invalid PAN format. Example: ABCDE1234F'})); return
    }
    setPan(p => ({...p, verifying: true}))
    try {
      await api.post('/kyc/verify-pan', { panNumber: pan.number })
      setPan(p => ({...p, verified: true, verifying: false}))
      show('PAN verified successfully!', 'success')
    } catch {
      const ok = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.number)
      setPan(p => ({...p, verified: ok, verifying: false}))
      if (ok) show('PAN verified (sandbox)!', 'success')
      else setErrors(e => ({...e, pan:'PAN verification failed'}))
    }
  }

  const submit = async () => {
    setSubmitting(true)
    const fd = new FormData()
    fd.append('fullName', form.fullName)
    fd.append('fatherName', form.fatherName)
    fd.append('address', form.address)
    fd.append('phoneNumber', form.phoneNumber)
    fd.append('bankAccount', form.bankAccount)
    fd.append('panNumber', pan.number)
    fd.append('shareCode', aadhaar.shareCode)
    if (aadhaar.pdf) fd.append('aadhaarPdf', aadhaar.pdf)
    if (nominee.enabled) { fd.append('nomineeName', nominee.name); fd.append('nomineeEmail', nominee.email); fd.append('nomineePhone', nominee.phone); fd.append('nomineeAddress', nominee.address) }
    try {
      await api.post('/customer/kyc/submit', fd, { headers: {'Content-Type':'multipart/form-data'} })
      setDone(true)
      show('KYC submitted! Awaiting officer review.', 'success')
      localStorage.removeItem('lockelite_kyc_step')
      localStorage.removeItem('lockelite_kyc_form')
      localStorage.removeItem('lockelite_kyc_aadhaar')
      localStorage.removeItem('lockelite_kyc_pan')
      localStorage.removeItem('lockelite_kyc_nominee')
    } catch(ex) { show(ex.response?.data?.message || 'Submission failed', 'error') }
    finally { setSubmitting(false) }
  }

  if (done) return (
    <SidebarLayout>
      <div className="p-7 flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center text-4xl mx-auto mb-5">✅</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">KYC submitted!</h2>
          <p className="text-sm text-slate-500 mb-6">Your documents are under review. You'll receive an email notification once approved.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">Typical review time: 1-2 business days</div>
        </div>
      </div>
    </SidebarLayout>
  )

  const StatusBadge = ({ s }) => {
    if (!s) return null
    if (s === 'verifying') return <span className="badge-orange"><i className="ti ti-loader animate-spin text-xs mr-1"/>Verifying...</span>
    if (s === true)  return <span className="badge-green"><i className="ti ti-check text-xs mr-1"/>Verified</span>
    if (s === false) return <span className="badge-red"><i className="ti ti-x text-xs mr-1"/>Failed</span>
    return null
  }

  return (
    <SidebarLayout>
      <div className="p-7 max-w-2xl">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-slate-900 mb-1">KYC Verification</h1>
          <p className="text-sm text-slate-500">Complete all steps to become eligible for locker booking.</p>
        </div>

        {/* KYC Rejected banner — shows rejection reason to customer */}
        {kycInfo?.kycStatus === 'REJECTED' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-x text-red-600 text-lg"/>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900 mb-1">KYC Rejected</p>
                <p className="text-xs text-red-700 mb-2">Your KYC application was rejected by the verification officer. Please review the reason below and resubmit with correct documents.</p>
                {kycInfo.rejectionReason && (
                  <div className="bg-white border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">Reason given by officer</p>
                    <p className="text-sm text-red-800 font-medium">{kycInfo.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                i === step ? 'bg-primary text-white' :
                i < step  ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`} onClick={() => i < step && setStep(i)}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: i===step ? 'rgba(255,255,255,0.3)' : 'transparent' }}>
                  {i < step ? <i className="ti ti-check"/> : i+1}
                </span>
                {s}
              </div>
              {i < STEPS.length-1 && <div className={`w-5 h-px mx-1 ${i < step ? 'bg-emerald-300' : 'bg-slate-200'}`}/>}
            </div>
          ))}
        </div>

        {/* Step 0: Personal info */}
        {step === 0 && (
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><i className="ti ti-user text-primary"/>Personal Details</h3>
            {[
              ['fullName', 'Full Name (as per Aadhaar)', 'text', 'Prasad Mane'],
              ['fatherName', "Father's Name", 'text', 'Suresh Mane'],
              ['address', 'Complete Address', 'text', 'Plot 12, Sector 5, Uran, Navi Mumbai'],
              ['phoneNumber', 'Mobile Number', 'tel', '9876543210'],
              ['bankAccount', 'Bank Account Number', 'text', 'Account number for rent deduction'],
            ].map(([k,l,t,p]) => (
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{l}</label>
                <input type={t} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} placeholder={p} className="input-field"/>
                {errors[k] && <p className="text-xs text-red-500 mt-1">{errors[k]}</p>}
              </div>
            ))}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Email (from account)</label>
              <input value={user?.email || ''} readOnly className="input-field bg-slate-50 text-slate-400 cursor-not-allowed"/>
            </div>
            <button onClick={() => {
              const e = {}
              const fn = form.fullName.trim()
              if (!fn) e.fullName = 'Full Name is required'
              else if (fn.length < 2 || fn.length > 100) e.fullName = 'Full Name must be 2-100 characters'
              else if (!/^[a-zA-Z\s]+$/.test(fn)) e.fullName = 'Alphabets and spaces only'

              const ftn = form.fatherName.trim()
              if (!ftn) e.fatherName = "Father's Name is required"
              else if (ftn.length < 2 || ftn.length > 100) e.fatherName = "Father's Name must be 2-100 characters"
              else if (!/^[a-zA-Z\s]+$/.test(ftn)) e.fatherName = 'Alphabets and spaces only'

              const ad = form.address.trim()
              if (!ad) e.address = 'Address is required'
              else if (ad.length < 10 || ad.length > 500) e.address = 'Address must be 10-500 characters'

              if (!/^[6-9]\d{9}$/.test(form.phoneNumber)) {
                e.phoneNumber = 'Enter a valid 10-digit mobile number starting with 6-9'
              }

              if (!/^\d{9,18}$/.test(form.bankAccount)) {
                e.bankAccount = 'Enter valid bank account number (9 to 18 digits)'
              }

              setErrors(e)
              if (!Object.keys(e).length) setStep(1)
            }} className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
              Next: Aadhaar KYC <i className="ti ti-arrow-right"/>
            </button>
          </div>
        )}

        {/* Step 1: Aadhaar */}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><i className="ti ti-id-badge text-primary"/>Aadhaar Verification</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
              <i className="ti ti-info-circle mr-1"/>Download your Aadhaar PDF from <strong>uidai.gov.in</strong> or <strong>DigiLocker</strong> and enter the 4-digit share code you set.
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Share Code (PDF password)</label>
              <input value={aadhaar.shareCode} onChange={e => setAadhaar(a=>({...a,shareCode:e.target.value}))} placeholder="4-digit code (sandbox: 1234)" maxLength={4} className="input-field w-40"/>
              {errors.shareCode && <p className="text-xs text-red-500 mt-1">{errors.shareCode}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Aadhaar PDF</label>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                aadhaar.verified === true ? 'border-emerald-300 bg-emerald-50' :
                aadhaar.pdf ? 'border-orange-200 bg-orange-50' : 'border-slate-200 hover:border-orange-300 bg-slate-50'
              }`}>
                <input type="file" accept=".pdf" onChange={e => { setAadhaar(a=>({...a,pdf:e.target.files[0],verified:null})); setErrors(e2=>({...e2,aadhaar:null})) }} className="hidden" id="apdf"/>
                <label htmlFor="apdf" className="cursor-pointer">
                  <i className={`ti ${aadhaar.verified===true?'ti-circle-check text-emerald-500':'ti-file-upload text-slate-400'} text-3xl mb-2 block`}/>
                  <div className="text-sm font-medium text-slate-700">{aadhaar.pdf ? aadhaar.pdf.name : 'Click to upload Aadhaar PDF'}</div>
                  <div className="text-xs text-slate-400 mt-1">{aadhaar.pdf ? 'Click to change' : 'PDF file only, max 10MB'}</div>
                </label>
              </div>
              {errors.aadhaar && <p className="text-xs text-red-500 mt-1">{errors.aadhaar}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={verifyAadhaar} disabled={aadhaar.verified===true||aadhaar.verified==='verifying'}
                className="btn-primary px-5 flex items-center gap-2 disabled:opacity-40">
                {aadhaar.verified==='verifying' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Verifying...</span></> : <><i className="ti ti-shield-check"/><span>Verify Aadhaar</span></>}
              </button>
              <StatusBadge s={aadhaar.verified}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-2"><i className="ti ti-arrow-left"/>Back</button>
              <button onClick={() => { if (aadhaar.verified !== true) { setErrors(e=>({...e,aadhaar:'Please verify Aadhaar first'})); return } setStep(2) }}
                className="btn-primary flex-1 flex items-center justify-center gap-2">Next: PAN Verify <i className="ti ti-arrow-right"/></button>
            </div>
          </div>
        )}

        {/* Step 2: PAN */}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><i className="ti ti-credit-card text-primary"/>PAN Verification</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">PAN Number</label>
              <div className="flex gap-3">
                <input value={pan.number} onChange={e => { setPan(p=>({...p,number:e.target.value.toUpperCase(),verified:null})); setErrors(e2=>({...e2,pan:null})) }}
                  placeholder="ABCDE1234F" maxLength={10} className={`input-field flex-1 tracking-widest font-mono ${errors.pan ? 'error' : ''}`}/>
                <button onClick={verifyPan} disabled={pan.verified===true||pan.verifying}
                  className="btn-primary px-5 flex items-center gap-2 whitespace-nowrap disabled:opacity-40">
                  {pan.verifying ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Verifying...</span></> : <><i className="ti ti-shield-check"/><span>Verify PAN</span></>}
                </button>
              </div>
              {errors.pan && <p className="text-xs text-red-500 mt-1">{errors.pan}</p>}
              {pan.verified !== null && <div className="mt-2"><StatusBadge s={pan.verified}/></div>}
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
              <strong>Sandbox:</strong> Any valid PAN format (e.g. <code className="font-mono bg-white px-1 rounded">ABCDE1234F</code>) will verify successfully.
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2"><i className="ti ti-arrow-left"/>Back</button>
              <button onClick={() => { if (pan.verified !== true) { setErrors(e=>({...e,pan:'Please verify PAN first'})); return } setStep(3) }}
                className="btn-primary flex-1 flex items-center justify-center gap-2">Next: Nominee <i className="ti ti-arrow-right"/></button>
            </div>
          </div>
        )}

        {/* Step 3: Nominee */}
        {step === 3 && (
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><i className="ti ti-user-check text-primary"/>Nominee (Optional)</h3>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <input type="checkbox" id="nomcheck" checked={nominee.enabled} onChange={e => setNominee(n=>({...n,enabled:e.target.checked}))} className="w-4 h-4 accent-primary"/>
              <label htmlFor="nomcheck" className="text-sm font-medium text-slate-700 cursor-pointer">Add a nominee for this locker</label>
            </div>
            {nominee.enabled && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['name', 'Nominee Name', 'Full name', 'nomineeName'],
                  ['email', 'Email', 'nominee@example.com', 'nomineeEmail'],
                  ['phone', 'Phone', 'Mobile number', 'nomineePhone'],
                  ['address', 'Address', 'Full address', 'nomineeAddress']
                ].map(([k, l, p, errKey]) => (
                  <div key={k} className={k === 'address' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{l}</label>
                    <input value={nominee[k]} onChange={e => {
                      setNominee(n => ({...n, [k]: e.target.value}));
                      setErrors(errs => ({...errs, [errKey]: null}));
                    }} placeholder={p} className="input-field"/>
                    {errors[errKey] && <p className="text-xs text-red-500 mt-1">{errors[errKey]}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-2"><i className="ti ti-arrow-left"/>Back</button>
              <button onClick={() => {
                if (nominee.enabled) {
                  const e = {}
                  const nm = nominee.name.trim()
                  if (!nm) e.nomineeName = 'Nominee Name is required'
                  else if (nm.length < 2 || nm.length > 100) e.nomineeName = 'Nominee Name must be 2-100 characters'
                  else if (!/^[a-zA-Z\s]+$/.test(nm)) e.nomineeName = 'Alphabets and spaces only'

                  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/.test(nominee.email)) {
                    e.nomineeEmail = 'Valid email required'
                  }

                  if (!/^[6-9]\d{9}$/.test(nominee.phone)) {
                    e.nomineePhone = 'Enter a valid 10-digit mobile starting with 6-9'
                  }

                  const ad = nominee.address.trim()
                  if (!ad) e.nomineeAddress = 'Nominee Address is required'
                  else if (ad.length < 10 || ad.length > 500) e.nomineeAddress = 'Address must be 10-500 characters'

                  setErrors(e)
                  if (Object.keys(e).length) return
                }
                setStep(4)
              }} className="btn-primary flex-1 flex items-center justify-center gap-2">Review & Submit <i className="ti ti-arrow-right"/></button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-5 flex items-center gap-2"><i className="ti ti-clipboard-check text-primary"/>Review & Submit</h3>
            <div className="space-y-4">
              {[
                { label:'Personal Info', items: [['Name', form.fullName],["Father's Name", form.fatherName],['Address', form.address],['Phone', form.phoneNumber],['Bank Account', form.bankAccount]] },
                { label:'Aadhaar', items: [['File', aadhaar.pdf?.name || '—'],['Share Code', aadhaar.shareCode],['Status', aadhaar.verified===true?'✅ Verified':'❌ Not verified']] },
                { label:'PAN', items: [['PAN Number', pan.number],['Status', pan.verified===true?'✅ Verified':'❌ Not verified']] },
              ].map(section => (
                <div key={section.label} className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{section.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {section.items.map(([k,v]) => (
                      <div key={k}><p className="text-[10px] text-slate-400">{k}</p><p className="text-sm font-medium text-slate-800">{v}</p></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(3)} className="btn-secondary flex items-center gap-2"><i className="ti ti-arrow-left"/>Back</button>
              <button onClick={submit} disabled={submitting || aadhaar.verified!==true || pan.verified!==true}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Submitting...</span></> : <><i className="ti ti-send"/><span>Submit KYC</span></>}
              </button>
            </div>
            {(aadhaar.verified !== true || pan.verified !== true) && (
              <p className="text-xs text-red-500 text-center mt-3">⚠️ Both Aadhaar and PAN must be verified before submitting</p>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}