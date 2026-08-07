import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import api from '../../services/api'

const SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']
const STATUS_STYLE = {
  UPCOMING:  { badge:'badge-blue',   label:'Upcoming'  },
  CONFIRMED: { badge:'badge-green',  label:'Confirmed' },
  COMPLETED: { badge:'badge-slate',  label:'Completed' },
  CANCELLED: { badge:'badge-red',    label:'Cancelled' },
}
const ALLOC_STATUS = {
  PENDING:            { badge:'badge-orange', label:'Pending'    },
  PARTIALLY_APPROVED: { badge:'badge-blue',   label:'Step 1 Done'},
  APPROVED:           { badge:'badge-green',  label:'Approved'   },
  REJECTED:           { badge:'badge-red',    label:'Rejected'   },
}

const INSURANCE_PLANS = [
  {
    id: 'none',
    name: 'No Insurance',
    icon: '🔓',
    price: 0,
    coverage: null,
    description: 'Proceed without locker insurance.',
    features: [],
    color: 'border-slate-200 bg-white',
    badge: null,
  },
  {
    id: 'basic',
    name: 'Basic Shield',
    icon: '🛡️',
    price: 499,
    coverage: 50000,
    description: 'Essential protection for your valuables.',
    features: ['₹50,000 coverage', 'Fire & theft', 'Natural disaster'],
    color: 'border-blue-200 bg-blue-50/40',
    badge: null,
  },
  {
    id: 'standard',
    name: 'Standard Guard',
    icon: '⚔️',
    price: 999,
    coverage: 150000,
    description: 'Comprehensive cover for most valuables.',
    features: ['₹1,50,000 coverage', 'Fire, theft & burglary', 'Natural disaster', '24/7 claim support'],
    color: 'border-orange-200 bg-orange-50/40',
    badge: 'Most Popular',
  },
  {
    id: 'premium',
    name: 'Premium Vault',
    icon: '👑',
    price: 1499,
    coverage: 500000,
    description: 'Maximum protection for high-value items.',
    features: ['₹5,00,000 coverage', 'All risks covered', 'Jewellery & documents', 'Priority claim processing', 'Zero deductible'],
    color: 'border-amber-300 bg-amber-50/40',
    badge: 'Best Value',
  },
]

export default function MyBookings() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [allocations, setAllocations] = useState([])
  const [visits, setVisits]           = useState([])
  const [paidAllocationIds, setPaidAllocationIds] = useState(new Set())
  const [date,    setDate]    = useState('')
  const [time,    setTime]    = useState('')
  const [purpose, setPurpose] = useState('')
  const [selSlot, setSelSlot] = useState(null)
  const [dateErr, setDateErr] = useState('')
  const [timeErr, setTimeErr] = useState('')
  const [scheduling, setSch]  = useState(false)
  const { show } = useToast()

  const [insuranceModal, setInsuranceModal] = useState(null)
  const [selPlan, setSelPlan] = useState('standard')

  useEffect(() => {
    api.get('/customer/bookings/my-allocations').then(r => setAllocations(r.data)).catch(() => setAllocations([]))
    api.get('/customer/bookings/my-visits').then(r => setVisits(r.data)).catch(() => setVisits([]))
    api.get('/payments')
      .then(r => {
        const successful = r.data.filter(p => p.status === 'SUCCESS').map(p => p.allocationId)
        setPaidAllocationIds(new Set(successful))
      })
      .catch(() => {})
  }, [])

  const loadRazorpayScript = () => new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

  const handlePayRent = async (allocation, insurancePlan) => {
    setInsuranceModal(null)
    try {
      show('Initiating payment transaction...', 'info')

      // Always calculate total on frontend — rent + insurance
      const totalAmount = (allocation.rentAmount + insurancePlan.price) * 100

      const res = await api.post('/payments/create-order', {
        allocationId:   allocation.id,
        insurancePlanId: insurancePlan.id,
        insuranceAmount: insurancePlan.price,
        totalAmount:    allocation.rentAmount + insurancePlan.price,
      })
      const { key, orderId, currency } = res.data

      const loaded = await loadRazorpayScript()
      if (!loaded) { show('Failed to load Razorpay SDK.', 'error'); return }

      const cleanKey = key && !key.includes('dummy') && !key.includes('mock')
        ? key : 'rzp_test_LzQe2D8Bf2n1P9'

      const description = insurancePlan.id === 'none'
        ? `Locker ${allocation.lockerNumber} Rent`
        : `Locker ${allocation.lockerNumber} Rent + ${insurancePlan.name} Insurance`

      const options = {
        key: cleanKey,
        amount: totalAmount,   // always frontend-calculated
        currency: currency || 'INR',
        name: 'LockElite',
        description,
        handler: async (response) => {
          try {
            show('Verifying payment...', 'info')
            await api.post('/payments/verify-payment', {
              razorpayOrderId:   orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature || 'mock_signature',
            })
            show(
              insurancePlan.id === 'none'
                ? 'Rent paid successfully! 🎉'
                : `Rent + ${insurancePlan.name} insurance activated! 🎉`,
              'success'
            )
            setPaidAllocationIds(prev => { const s = new Set(prev); s.add(allocation.id); return s })
          } catch (ex) {
            show(ex.response?.data?.message || 'Payment verification failed', 'error')
          }
        },
        prefill: { name: user?.fullName || '', email: user?.email || '' },
        theme: { color: theme?.primary || '#F68222' },
        notes: {
          insurance_plan:     insurancePlan.id,
          insurance_coverage: insurancePlan.coverage || 'none',
        },
      }

      if (orderId && !orderId.startsWith('order_mock_')) options.order_id = orderId
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (ex) {
      show(ex.response?.data?.message || 'Failed to start payment', 'error')
    }
  }

  const getTodayLocalDate = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  const validateDate = (val) => {
    setDate(val); setDateErr(''); setSelSlot(null); setTime('')
    if (!val) return
    if (val < getTodayLocalDate()) { setDateErr('Cannot select a past date'); return }
    const day = new Date(val).getDay()
    if (day === 0) { setDateErr('Branch is closed on Sundays'); return }
    if (day === 6) { setDateErr('Branch is closed on Saturdays'); return }
  }

  const validateTime = (val) => {
    setTime(val); setTimeErr('')
    if (!val) return
    const [h, m] = val.split(':').map(Number)
    const mins = h * 60 + m
    if (mins < 9*60)   { setTimeErr('Branch opens at 9:00 AM'); return }
    if (mins >= 17*60) { setTimeErr('Branch closes at 5:00 PM'); return }
    if (date) {
      const conflict = visits.some(v =>
        v.status !== 'CANCELLED' && v.visitDate === date && v.visitTime.substring(0,5) === val.substring(0,5)
      )
      if (conflict) setTimeErr('You already have a visit at this time')
    }
  }

  const pickSlot = (s) => { setSelSlot(s); validateTime(s) }
  const hasApprovedAllocation = allocations.some(a => a.status === 'APPROVED')
  const canSchedule = date && !dateErr && time && !timeErr && hasApprovedAllocation

  const schedule = async () => {
    if (!canSchedule) return
    setSch(true)
    try {
      await api.post('/customer/bookings/schedule-visit', { visitDate: date, visitTime: time+':00', purpose: purpose || 'Locker Access' })
      setVisits(prev => [{ id: Date.now(), visitDate: date, visitTime: time+':00', purpose: purpose || 'Locker Access', status:'UPCOMING' }, ...prev])
      setDate(''); setTime(''); setPurpose(''); setSelSlot(null)
      show('Visit scheduled successfully!', 'success')
    } catch(ex) { show(ex.response?.data?.message || 'Scheduling failed', 'error') }
    finally { setSch(false) }
  }

  const fmtDate = (s) => {
    if (!s) return '—'
    const p = (s.includes('T') ? s.split('T')[0] : s).split('-')
    if (p.length === 3) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return `${parseInt(p[2])} ${months[parseInt(p[1])-1]} ${p[0]}`
    }
    return s
  }
  const fmtTime = (s) => { const [h,m] = s.split(':'); const hr=parseInt(h); return `${hr>12?hr-12:hr}:${m} ${hr>=12?'PM':'AM'}` }

  const selectedPlanObj = INSURANCE_PLANS.find(p => p.id === selPlan)

  return (
    <SidebarLayout>
      <div className="p-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">My Bookings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your locker allocations and branch visit appointments.</p>
        </div>

        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <i className="ti ti-lock text-primary"/>Active locker allocations
        </h2>
        {allocations.length === 0 ? (
          <div className="card p-6 text-center mb-6 text-sm text-slate-400">
            <i className="ti ti-lock text-3xl text-slate-200 block mb-2"/>No locker allocations yet
          </div>
        ) : (
          <div className="space-y-3 mb-7">
            {allocations.map(a => (
              <div key={a.id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center text-xl">🔐</div>
                    <div>
                      <p className="font-bold text-slate-900">Locker {a.lockerNumber || a.locker?.lockerNumber}</p>
                      <p className="text-xs text-slate-500">{a.size || a.locker?.size} · {a.locker?.branch?.branchName || a.branchName || 'Vasind Branch'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <span className={ALLOC_STATUS[a.status]?.badge || 'badge-slate'}>{ALLOC_STATUS[a.status]?.label || a.status}</span>
                    {a.status === 'APPROVED' && (
                      paidAllocationIds.has(a.id) ? (
                        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1 py-1 px-2.5">
                          <i className="ti ti-circle-check text-emerald-500 text-xs"/> Paid
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="badge bg-rose-50 text-rose-700 border border-rose-100 py-1 px-2.5">Unpaid</span>
                          <button
                            onClick={() => { setInsuranceModal(a); setSelPlan('standard') }}
                            className="px-3.5 py-1.5 rounded-xl text-white text-xs font-bold transition-all duration-200 hover:scale-[1.02] shadow-sm flex items-center gap-1.5"
                            style={{ background: 'var(--color-primary)' }}
                          >
                            <i className="ti ti-credit-card text-xs"/> Pay Rent
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-50 text-sm">
                  {[['Rent/Year', `₹${(a.rentAmount||0).toLocaleString()}`],['Tenure', `${a.tenureMonths} months`],['Approved', a.approvedAt ? fmtDate(a.approvedAt) : '—'],['Expiry', a.approvedAt ? fmtDate(new Date(new Date(a.approvedAt).setMonth(new Date(a.approvedAt).getMonth()+(a.tenureMonths||12))).toISOString()) : '—']].map(([k,v])=>(
                    <div key={k} className="px-4 py-3"><p className="text-xs text-slate-400 mb-0.5">{k}</p><p className="font-semibold text-slate-800">{v}</p></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2"><i className="ti ti-calendar-plus text-primary"/>Schedule a branch visit</h3>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 mb-4 text-xs text-amber-700">
                <i className="ti ti-clock text-sm"/><span><strong>Branch hours:</strong> Monday–Friday · 9:00 AM – 5:00 PM only</span>
              </div>
              {!hasApprovedAllocation && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 mb-4 text-xs text-rose-700 font-medium">
                  <i className="ti ti-alert-triangle text-sm flex-shrink-0"/>
                  <span>Your locker request is pending approval. You can schedule a visit after approval.</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Date</label>
                  <input type="date" value={date} min={getTodayLocalDate()} onChange={e => validateDate(e.target.value)}
                    disabled={!hasApprovedAllocation}
                    className={`input-field ${!hasApprovedAllocation ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''} ${dateErr ? 'error' : date&&!dateErr ? 'border-emerald-300' : ''}`}/>
                  {dateErr && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs"/>{dateErr}</p>}
                  {date && !dateErr && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><i className="ti ti-check text-xs"/>Valid date</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Time</label>
                  <input type="time" value={time} onChange={e => validateTime(e.target.value)}
                    disabled={!hasApprovedAllocation}
                    className={`input-field ${!hasApprovedAllocation ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''} ${timeErr ? 'error' : time&&!timeErr ? 'border-emerald-300' : ''}`}/>
                  {timeErr && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs"/>{timeErr}</p>}
                  {time && !timeErr && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><i className="ti ti-check text-xs"/>Valid time</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Purpose</label>
                  <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Locker access"
                    disabled={!hasApprovedAllocation}
                    className={`input-field ${!hasApprovedAllocation ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}/>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Quick slots</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {SLOTS.map(s => {
                    const [h] = s.split(':').map(Number)
                    const lbl = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`
                    return (
                      <button key={s} onClick={() => pickSlot(s)}
                        disabled={!date || !!dateErr || !hasApprovedAllocation}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                          selSlot===s ? 'bg-primary text-white border-primary' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-primary hover:text-white hover:border-primary'
                        }`}>{lbl}</button>
                    )
                  })}
                </div>
              </div>
              <button onClick={schedule} disabled={!canSchedule || scheduling || !hasApprovedAllocation}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
                {scheduling ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Scheduling...</span></>
                ) : !hasApprovedAllocation ? (
                  <><i className="ti ti-calendar-x"/><span>Locker approval pending</span></>
                ) : canSchedule ? (
                  <><i className="ti ti-calendar-check"/><span>Confirm appointment</span></>
                ) : (
                  <><i className="ti ti-calendar-x"/><span>Select a valid date & time</span></>
                )}
              </button>
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><i className="ti ti-history text-primary"/>Visit history</h3>
                <span className="text-xs text-slate-400">{visits.length} total</span>
              </div>
              <div className="grid px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide"
                style={{ gridTemplateColumns:'1.2fr 1fr 1.5fr 1fr' }}>
                <span>Date</span><span>Time</span><span>Purpose</span><span>Status</span>
              </div>
              {visits.map(v => (
                <div key={v.id} className="grid px-5 py-3 border-b border-slate-50 last:border-none items-center text-sm"
                  style={{ gridTemplateColumns:'1.2fr 1fr 1.5fr 1fr' }}>
                  <span className="font-medium text-slate-800">{fmtDate(v.visitDate)}</span>
                  <span className="text-slate-600">{fmtTime(v.visitTime)}</span>
                  <span className="text-slate-600">{v.purpose}</span>
                  <span className={STATUS_STYLE[v.status]?.badge || 'badge-slate'}>{STATUS_STYLE[v.status]?.label || v.status}</span>
                </div>
              ))}
              {visits.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No visits scheduled yet</div>}
            </div>
          </div>

          <div className="space-y-3">
            {[
              { icon:'ti-calendar-event', label:'Upcoming',  count: visits.filter(v=>v.status==='UPCOMING').length,  color:'text-blue-600',    bg:'bg-blue-50' },
              { icon:'ti-circle-check',   label:'Confirmed', count: visits.filter(v=>v.status==='CONFIRMED').length, color:'text-emerald-600', bg:'bg-emerald-50' },
              { icon:'ti-check',          label:'Completed', count: visits.filter(v=>v.status==='COMPLETED').length, color:'text-slate-600',   bg:'bg-slate-50' },
              { icon:'ti-x',             label:'Cancelled',  count: visits.filter(v=>v.status==='CANCELLED').length, color:'text-red-600',    bg:'bg-red-50' },
            ].map(s => (
              <div key={s.label} className="card p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <i className={`ti ${s.icon} text-lg ${s.color}`}/>
                </div>
                <div><p className={`text-xl font-bold ${s.color}`}>{s.count}</p><p className="text-xs text-slate-500">{s.label} visits</p></div>
              </div>
            ))}
            <div className="card p-4 bg-orange-50 border-orange-100">
              <p className="text-xs font-bold text-orange-600 mb-1 flex items-center gap-1"><i className="ti ti-clock text-xs"/>Branch Hours</p>
              <p className="text-xs text-orange-700 leading-relaxed">Mon–Fri<br/>9:00 AM – 5:00 PM<br/>Weekends: Closed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Insurance Modal */}
      {insuranceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-fade-in overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-1">Locker {insuranceModal.lockerNumber}</p>
                  <h2 className="text-white font-bold text-lg">Add Locker Insurance?</h2>
                  <p className="text-white/70 text-xs mt-0.5">Protect your valuables — choose a plan or skip</p>
                </div>
                <button onClick={() => setInsuranceModal(null)}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                  <i className="ti ti-x text-sm"/>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 mb-5">
                {INSURANCE_PLANS.map(plan => (
                  <button key={plan.id} onClick={() => setSelPlan(plan.id)}
                    className={`relative text-left rounded-2xl border-2 p-4 transition-all duration-200 ${plan.color} ${
                      selPlan === plan.id
                        ? 'ring-2 ring-orange-400 ring-offset-1 border-orange-400'
                        : 'hover:border-orange-200'
                    }`}>
                    {plan.badge && selPlan !== plan.id && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        {plan.badge}
                      </span>
                    )}
                    {selPlan === plan.id && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <i className="ti ti-check text-white text-[10px]"/>
                      </span>
                    )}
                    <div className="text-2xl mb-2">{plan.icon}</div>
                    <p className="font-bold text-slate-900 text-sm">{plan.name}</p>
                    <p className="text-xs text-slate-500 mb-2">{plan.description}</p>
                    {plan.price > 0 ? (
                      <p className="font-bold text-orange-600 text-base">+₹{plan.price.toLocaleString()}<span className="text-xs font-normal text-slate-400">/year</span></p>
                    ) : (
                      <p className="font-bold text-slate-400 text-base">Free</p>
                    )}
                    {plan.features.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <i className="ti ti-check text-emerald-500 text-[10px]"/>{f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 mb-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-slate-500">Locker Rent</span>
                    <span className="font-semibold text-slate-900">₹{(insuranceModal.rentAmount||0).toLocaleString()}/yr</span>
                  </div>
                  {selectedPlanObj?.price > 0 && (
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-slate-500">{selectedPlanObj.name}</span>
                      <span className="font-semibold text-orange-600">+₹{selectedPlanObj.price.toLocaleString()}/yr</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total payable</p>
                  <p className="text-xl font-bold text-slate-900">
                    ₹{((insuranceModal.rentAmount||0) + (selectedPlanObj?.price||0)).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedPlanObj?.id !== 'none' && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4 text-xs text-emerald-700">
                  <i className="ti ti-shield-check text-emerald-500 mt-0.5 flex-shrink-0"/>
                  <span>
                    Your locker contents will be covered up to <strong>₹{(selectedPlanObj.coverage||0).toLocaleString()}</strong> under {selectedPlanObj.name}.
                    Insurance is activated instantly upon payment.
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setInsuranceModal(null)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={() => handlePayRent(insuranceModal, selectedPlanObj)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-white text-sm font-bold transition-all hover:scale-[1.01] shadow-sm"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <i className="ti ti-credit-card"/>
                  Pay ₹{((insuranceModal.rentAmount||0) + (selectedPlanObj?.price||0)).toLocaleString()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}