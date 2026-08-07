// Customer Dashboard
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

export default function CustomerDashboard() {
  const { user } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState({
    kycStatus: 'NOT_SUBMITTED', activeLockers: 0, rentDue: 0, nextVisit: null,
    locker: null, recentActivity: [], notifications: []
  })

  useEffect(() => {
    // Fetch dashboard + payments in parallel
    Promise.all([
      api.get('/customer/dashboard'),
      api.get('/payments').catch(() => ({ data: [] }))
    ]).then(([dashRes, paymentsRes]) => {
      const dashData = dashRes.data
      const payments = paymentsRes.data || []

      // Recalculate rentDue using payment-service data (separate DB)
      // If any allocation has a SUCCESS payment, rent is paid
      const paidAllocationIds = new Set(
        payments.filter(p => p.status === 'SUCCESS').map(p => p.allocationId)
      )

      // Override rentDue using payment-service records (separate DB from monolith)
      // If ANY payment is SUCCESS, consider rent paid regardless of allocationId match
      const hasPaidRent = payments.some(p => p.status === 'SUCCESS')
      let recalcRentDue = hasPaidRent ? 0 : (dashData.rentDue || 0)

      // Also update notifications
      const updatedNotifications = (dashData.notifications || []).filter(n =>
        !n.message?.includes('Rent payment')
      )
      if (recalcRentDue > 0) {
        updatedNotifications.unshift({
          message: `Rent payment of ₹${recalcRentDue} is outstanding.`,
          urgent: true
        })
      }

      setData({
        ...dashData,
        rentDue: recalcRentDue,
        paidAllocationIds: [...paidAllocationIds],
        notifications: updatedNotifications
      })
    }).catch(err => {
      console.error(err)
      setData({
        kycStatus: 'NOT_SUBMITTED', activeLockers: 0, rentDue: 0, nextVisit: null,
        locker: null, recentActivity: [], notifications: []
      })
      show('Failed to fetch dashboard data from backend.', 'error')
    })
  }, [])

  const kycBadge = { NOT_SUBMITTED: 'badge-slate', PENDING: 'badge-orange', APPROVED: 'badge-green', REJECTED: 'badge-red' }
  const kycIcon  = { NOT_SUBMITTED: 'ti-clock', PENDING: 'ti-loader', APPROVED: 'ti-check', REJECTED: 'ti-x' }

  return (
    <SidebarLayout>
      <div className="p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Welcome back, {user?.fullName?.split(' ')[0]} 👋</h1>
            <p className="text-sm text-slate-500 mt-1">Here's a summary of your LockElite account.</p>
          </div>
          <div className="text-xs text-slate-400 bg-white border border-slate-100 rounded-full px-3 py-1.5">
            {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'short', year:'numeric' })}
          </div>
        </div>

        {/* KYC alert if not submitted */}
        {data?.kycStatus === 'NOT_SUBMITTED' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center"><i className="ti ti-alert-triangle text-amber-600 text-lg"/></div>
              <div><div className="text-sm font-semibold text-amber-900">KYC not submitted</div><div className="text-xs text-amber-700">Complete your KYC to book a locker</div></div>
            </div>
            <button onClick={() => navigate('/customer/kyc')} className="btn-primary text-xs px-4 py-2">Complete KYC <i className="ti ti-arrow-right ml-1"/></button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label:'KYC Status', value: data?.kycStatus?.replace('_',' ') || '—', badge: kycBadge[data?.kycStatus], icon: kycIcon[data?.kycStatus] },
            { label:'Active Lockers', value: data?.activeLockers || 0, icon: 'ti-lock' },
            { label:'Rent Due', value: data?.rentDue ? `₹${data.rentDue.toLocaleString()}` : '₹0', icon: 'ti-credit-card', urgent: data?.rentDue > 0 },
            { label:'Next Visit', value: data?.nextVisit || 'None scheduled', icon: 'ti-calendar' },
          ].map(c => (
            <div key={c.label} className={`card p-4 ${c.urgent ? 'border-red-200 bg-red-50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-400">{c.label}</p>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.urgent ? 'bg-red-100' : 'bg-slate-50'}`}>
                  <i className={`ti ${c.icon} text-sm ${c.urgent ? 'text-red-500' : 'text-slate-400'}`}/>
                </div>
              </div>
              {c.badge
                ? <span className={c.badge}><i className={`ti ${c.icon} text-xs mr-1`}/>{c.value}</span>
                : <p className={`text-xl font-bold ${c.urgent ? 'text-red-600' : 'text-slate-900'}`}>{c.value}</p>
              }
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* My Locker */}
          <div className="col-span-2 space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-lock text-primary"/>My Locker</h3>
              {data?.locker ? (
                <div>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl">🔐</div>
                      <div>
                        <p className="font-bold text-slate-900">Locker {data.locker.lockerId}</p>
                        <p className="text-xs text-slate-500">{data.locker.size} · {data.locker.branch}</p>
                      </div>
                    </div>
                    <span className="badge-green"><i className="ti ti-check text-xs mr-1"/>Active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><p className="text-xs text-slate-400 mb-1">Annual rent</p><p className="font-semibold">₹{data.locker.rent?.toLocaleString()}</p></div>
                    <div><p className="text-xs text-slate-400 mb-1">Since</p><p className="font-semibold">{data.locker.since}</p></div>
                    <div><p className="text-xs text-slate-400 mb-1">Renewal</p><p className="font-semibold">{data.locker.renewal}</p></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3 opacity-20">🔒</div>
                  <p className="text-sm text-slate-400 mb-4">No active locker yet</p>
                  <button onClick={() => navigate('/customer/lockers')} className="btn-primary text-sm px-5">
                    <i className="ti ti-search mr-1"/>Explore lockers
                  </button>
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-activity text-primary"/>Recent activity</h3>
              {(data?.recentActivity || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No recent activity</p>
              ) : data.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-none">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"/>
                    <span className="text-sm text-slate-700">{a.type}</span>
                  </div>
                  <span className="text-xs text-slate-400">{a.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-bolt text-primary"/>Quick actions</h3>
              <div className="space-y-2">
                {[
                  { label:'Browse lockers',    icon:'ti-building-bank', path:'/customer/lockers' },
                  { label:'Schedule a visit',  icon:'ti-calendar-plus', path:'/customer/bookings' },
                  { label:'Update KYC',        icon:'ti-file-check',    path:'/customer/kyc' },
                  { label:'Contact branch',    icon:'ti-phone',         path:null },
                ].map(a => (
                  <button key={a.label} onClick={() => {
                    if (a.path) {
                      navigate(a.path);
                    } else if (a.label === 'Contact branch') {
                      show('Support Helpdesk: 1800-LOCK-ELITE (1800-5625-35483) or email support@lockelite.com', 'info');
                    }
                  }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-orange-50 hover:border-orange-200 border border-slate-100 text-sm text-slate-700 text-left transition-all">
                    <i className={`ti ${a.icon} text-primary text-base`}/>{a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-bell text-primary"/>Notifications</h3>
              {(data?.notifications || []).length === 0 ? (
                <div className="text-center py-3">
                  <i className="ti ti-check text-emerald-400 text-2xl mb-1 block"/>
                  <p className="text-xs text-slate-400">All caught up!</p>
                </div>
              ) : data.notifications.map((n, i) => (
                <div key={i} className={`rounded-xl px-3 py-2 text-xs mb-2 ${n.urgent ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-50 text-slate-600'}`}>
                  {n.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}