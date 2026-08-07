import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const MOCK = {
  pendingKyc:3, pendingAllocations:2, upcomingAppointments:4, rentCollected:120000,
  pendingKycList:[
    { id:1, customerName:'Prasad Mane',  locker:'B-201', size:'MEDIUM', time:'2h ago',  color:'#F68222' },
    { id:2, customerName:'Rahul Sharma', locker:'C-302', size:'LARGE',  time:'4h ago',  color:'#185FA5' },
    { id:3, customerName:'Meena Patil',  locker:'A-101', size:'SMALL',  time:'Today',   color:'#3B6D11' },
  ],
  appointments:[
    { id:1, customerName:'Prasad Mane',  date:'04', month:'AUG', time:'10:00 AM', purpose:'Locker Access' },
    { id:2, customerName:'Rahul Sharma', date:'05', month:'AUG', time:'11:30 AM', purpose:'Renewal' },
    { id:3, customerName:'Meena Patil',  date:'07', month:'AUG', time:'02:00 PM', purpose:'KYC Visit' },
  ],
  occupancy:{ total:12, occupied:8, available:4 },
  bySize:[
    { size:'Small',       occupied:3, total:4  },
    { size:'Medium',      occupied:2, total:4  },
    { size:'Large',       occupied:2, total:3  },
    { size:'Extra Large', occupied:1, total:1  },
  ],
  activity:[
    { text:'KYC approved for Prasad Mane',       time:'Today 9:15 AM',     color:'#10b981' },
    { text:'New allocation request from R.Sharma', time:'Today 8:45 AM',    color:'#F68222' },
    { text:'Appointment confirmed for Meena',     time:'Yesterday 4:30 PM', color:'#3b82f6' },
    { text:'Rent ₹2,800 collected from Suresh',   time:'Yesterday 2:00 PM', color:'#10b981' },
  ]
}

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/employee/dashboard').then(r => setData(r.data)).catch(err => {
      console.error(err)
      setData(null)
      show('Failed to fetch dashboard data from backend.', 'error')
    })
  }, [])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })
  const dateStr = now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'short', year:'numeric' })

  const StatCard = ({ label, value, icon, change, changeBg, changeColor }) => (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
          <i className={`ti ${icon} text-[#F68222] text-lg`}/>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${changeBg} ${changeColor}`}>{change}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )

  return (
    <SidebarLayout>
      <div className="p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Good morning, {user?.fullName?.split(' ')[0]} 👋</h1>
            <p className="text-sm text-slate-500 mt-1">{data?.branchName || 'Vasind Branch'} · {dateStr}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-full px-3 py-1.5">
            <i className="ti ti-clock text-[#F68222] text-sm"/>
            <span className="text-xs font-semibold text-slate-600">{timeStr}</span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Pending KYC"       value={data?.pendingKyc||0}           icon="ti-file-check"      change="+2 today"  changeBg="bg-amber-50"    changeColor="text-amber-700"/>
          <StatCard label="Pending Approvals"  value={data?.pendingAllocations||0}   icon="ti-lock"            change="Action needed" changeBg="bg-blue-50"  changeColor="text-blue-700"/>
          <StatCard label="Today's Visits"     value={data?.upcomingAppointments||0} icon="ti-calendar-event"  change="This week"  changeBg="bg-slate-100"  changeColor="text-slate-600"/>
          <StatCard label="Rent Collected"     value={`₹${((data?.rentCollected||0)/1000).toFixed(1).replace('.0','') + 'K'}`} icon="ti-currency-rupee" change="↑ 12%" changeBg="bg-emerald-50" changeColor="text-emerald-700"/>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Left+Middle */}
          <div className="col-span-2 space-y-4">
            {/* Pending KYC */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><i className="ti ti-file-check text-[#F68222]"/>Latest pending KYC</h3>
                <button onClick={() => navigate('/employee/kyc-review')} className="text-xs text-[#F68222] font-semibold hover:underline flex items-center gap-1">View all <i className="ti ti-arrow-right text-xs"/></button>
              </div>
              <div className="space-y-0">
                {(data?.pendingKycList||[]).map(k => (
                  <div key={k.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: k.color }}>{k.customerName.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{k.customerName}</p>
                        <p className="text-xs text-slate-400">Locker {k.locker} · {k.size} · {k.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-orange">Pending</span>
                      <button onClick={() => navigate('/employee/kyc-review')} className="btn-primary text-xs px-3 py-1.5">Review</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming appointments */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><i className="ti ti-calendar-event text-[#F68222]"/>Upcoming appointments</h3>
                <button onClick={() => navigate('/employee/appointments')} className="text-xs text-[#F68222] font-semibold hover:underline flex items-center gap-1">View all <i className="ti ti-arrow-right text-xs"/></button>
              </div>
              {(data?.appointments||[]).map(a => (
                <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-none">
                  <div className="w-11 h-11 rounded-2xl bg-orange-50 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#F68222] leading-none">{a.date}</span>
                    <span className="text-[9px] text-[#F68222] tracking-widest">{a.month}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{a.customerName}</p>
                    <p className="text-xs text-slate-400">{a.purpose}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#F68222]">{a.time}</span>
                </div>
              ))}
            </div>

            {/* Occupancy */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-chart-bar text-[#F68222]"/>Locker occupancy</h3>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>{data?.occupancy?.occupied||0} occupied</span>
                  <span className="font-semibold text-[#F68222]">{Math.round(((data?.occupancy?.occupied||0)/(data?.occupancy?.total||1))*100)}% full</span>
                  <span>{data?.occupancy?.available||0} available</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#F68222] to-orange-400 rounded-full transition-all"
                    style={{ width:`${Math.round(((data?.occupancy?.occupied||0)/(data?.occupancy?.total||1))*100)}%` }}/>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                {(data?.bySize||[]).map(s => (
                  <div key={s.size} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-24">{s.size}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#F68222] rounded-full" style={{ width:`${(s.occupied/s.total)*100}%` }}/>
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{s.occupied}/{s.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-bolt text-[#F68222]"/>Quick actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:'Review KYC',   icon:'ti-file-check', path:'/employee/kyc-review' },
                  { label:'Allocations',  icon:'ti-lock',       path:'/employee/allocations' },
                  { label:'Appointments', icon:'ti-calendar',   path:'/employee/appointments' },
                  { label:'View lockers', icon:'ti-building-bank', path:null },
                ].map(a => (
                  <button key={a.label} onClick={() => {
                    if (a.path) {
                      navigate(a.path);
                    } else if (a.label === 'View lockers') {
                      show(`Branch Locker Inventory: ${data?.occupancy?.occupied || 0} occupied, ${data?.occupancy?.available || 0} available. Manage lockers in the Allocations tab.`, 'info');
                    }
                  }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-100 text-xs text-orange-700 font-semibold transition-all">
                    <i className={`ti ${a.icon} text-xl text-[#F68222]`}/>{a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-activity text-[#F68222]"/>Recent activity</h3>
              {(data?.activity||[]).map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-none">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: a.color }}/>
                  <div>
                    <p className="text-xs text-slate-700 leading-relaxed">{a.text}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
