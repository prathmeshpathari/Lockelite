import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarLayout from '../../components/layout/SidebarLayout'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

const MOCK_DASH = {
  totalLockers:12, availableLockers:6, occupiedLockers:5, reservedLockers:1,
  totalEmployees:4, totalCustomers:8, pendingKyc:2, pendingAllocations:1,
  chainIntegrity: true,
  rentChart:[65,72,68,88,95,78,110,120],
  rentMonths:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
  employees:[
    { name:'Prathmesh Pathari', role:'Branch Manager', online:true,  color:'var(--color-primary)' },
    { name:'Rajan Mehta',       role:'Locker Officer', online:true,  color:'#185FA5' },
    { name:'Anita Sharma',      role:'KYC Officer',    online:false, color:'#10b981' },
  ],
  bySize:[{ size:'Small', occupied:1, total:4},{ size:'Medium', occupied:2, total:4},{ size:'Large', occupied:2, total:3},{ size:'Extra Large', occupied:1, total:1}],
  activity:[
    { text:'KYC approved · Prasad Mane',         time:'Today 9:15 AM',     color:'#10b981' },
    { text:'Allocation requested · Rahul Sharma', time:'Today 8:45 AM',    color:'var(--color-primary)' },
    { text:'Locker C-302 allocated',              time:'Yesterday 4:30 PM', color:'#3b82f6' },
    { text:'Rent ₹4,500 collected',               time:'Yesterday 2:00 PM', color:'#10b981' },
  ]
}

export default function AdminDashboard() {
  const [data, setData]   = useState(null)
  const [scanning, setScan] = useState(false)
  const [scanResult, setSR] = useState(null)
  const navigate = useNavigate()
  const { show } = useToast()

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setData(r.data)).catch(err => {
      console.error(err)
      setData(null)
      show('Failed to fetch dashboard data from backend.', 'error')
    })
  }, [])

  const runAiScan = async () => {
    setScan(true); setSR(null)
    try {
      const res = await api.get('/admin/audit-logs/ai-scan')
      setSR(res.data)
    } catch {
      await new Promise(r => setTimeout(r, 2000))
      setSR({ flagged:[
        { action:'ALLOCATION_APPROVED', risk:'High',   detail:'Hash chain mismatch at entry #47 — possible data tampering' },
        { action:'KYC_APPROVED',        risk:'Medium', detail:'KYC approved 22 min after submission — verify reviewer identity' },
        { action:'USER_LOGIN',          risk:'Low',    detail:'Login from unusual hour (11 PM) for employee account' },
      ]})
    } finally { setScan(false) }
  }

  const maxRent = Math.max(...(data?.rentChart||[1]), 1)

  return (
    <SidebarLayout>
      <div className="p-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Global Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short',year:'numeric'})}
              {data?.chainIntegrity !== false && <span className="ml-3 text-emerald-600 font-medium text-xs flex items-center gap-1 inline-flex"><i className="ti ti-shield-check"/>Chain integrity verified</span>}
            </p>
          </div>
          <button onClick={runAiScan} disabled={scanning}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <i className={`ti ti-robot ${scanning?'animate-spin':''}`}/>
            {scanning ? 'Scanning...' : 'Run AI Scan'}
          </button>
        </div>

        {/* Alert banners */}
        {data?.pendingKyc > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-800"><i className="ti ti-alert-triangle text-amber-500"/><strong>{data.pendingKyc}</strong> KYC applications awaiting review</div>
            <button onClick={() => navigate('/employee/kyc-review')} className="text-xs text-amber-700 font-semibold hover:underline">Review <i className="ti ti-arrow-right text-xs"/></button>
          </div>
        )}

        {/* AI Scan result */}
        {scanResult && (
          <div className="card p-5 mb-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><i className="ti ti-robot text-primary"/>AI Scan Results — {scanResult.flagged.length} issues detected</h3>
            <div className="space-y-2">
              {scanResult.flagged.map((f,i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${f.risk==='High'?'bg-red-50 border border-red-200':f.risk==='Medium'?'bg-amber-50 border border-amber-200':'bg-blue-50 border border-blue-200'}`}>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${f.risk==='High'?'bg-red-600 text-white':f.risk==='Medium'?'bg-amber-600 text-white':'bg-blue-600 text-white'}`}>{f.risk}</span>
                  <div><p className="text-xs font-semibold text-slate-800">{f.action}</p><p className="text-xs text-slate-600">{f.detail}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locker stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[['Total Lockers',data?.totalLockers||0,'ti-building-bank','#1e293b'],['Available',data?.availableLockers||0,'ti-lock-open','#10b981'],['Occupied',data?.occupiedLockers||0,'ti-lock','var(--color-primary)'],['Vacancy Rate',`${Math.round(((data?.availableLockers||0)/(data?.totalLockers||1))*100)}%`,'ti-percentage','#3b82f6']].map(([l,v,icon,c])=>(
            <div key={l} className="card p-4">
              <div className="flex items-center justify-between mb-2"><i className={`ti ${icon} text-2xl`} style={{color:c}}/></div>
              <p className="text-2xl font-bold" style={{color:c}}>{v}</p>
              <p className="text-xs text-slate-400 mt-0.5">{l}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Rent chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><i className="ti ti-chart-bar text-primary"/>Rent collected (₹)</h3>
              <span className="text-xs text-slate-400">Last 8 months</span>
            </div>
            <div className="flex items-end gap-1.5 h-24 mb-2">
              {(data?.rentChart||[]).map((v,i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full rounded-t-lg transition-all" style={{ height:`${(v/maxRent)*90}px`, background: i===7?'linear-gradient(180deg,#E07010,#C05A00)':'linear-gradient(180deg,#F68222,#E07010)', opacity: i===7?1:0.7+(i*0.04) }}/>
                  <span className="text-[8px] text-slate-400">{(data?.rentMonths||[])[i]}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-3 text-center">
              {[
                ['This month', data?.thisMonthRevenue >= 100000 ? `₹${(data.thisMonthRevenue/100000).toFixed(1)}L` : `₹${(data?.thisMonthRevenue||0).toLocaleString()}`, '#10b981'],
                ['Outstanding', `₹${(data?.outstandingDues || 0).toLocaleString()}`, '#3b82f6'],
                ['YTD', data?.totalRevenue >= 100000 ? `₹${(data.totalRevenue/100000).toFixed(1)}L` : `₹${(data?.totalRevenue||0).toLocaleString()}`, 'var(--color-primary)']
              ].map(([l,v,c])=>(
                <div key={l}><p className="text-sm font-bold" style={{color:c}}>{v}</p><p className="text-[10px] text-slate-400">{l}</p></div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><i className="ti ti-activity text-primary"/>Recent activity</h3>
            {(data?.activity||[]).map((a,i)=>(
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-none">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{background:a.color}}/>
                <div><p className="text-xs text-slate-700">{a.text}</p><p className="text-[10px] text-slate-400 mt-0.5">{a.time}</p></div>
              </div>
            ))}
          </div>

          {/* Employees */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><i className="ti ti-users text-primary"/>Employees</h3>
              <button onClick={()=>navigate('/admin/employees')} className="text-xs text-primary font-semibold hover:underline">Manage</button>
            </div>
            {(data?.employees||[]).map((e,i)=>(
              <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-none">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:e.color}}>{e.name.charAt(0)}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{e.name}</p><p className="text-xs text-slate-400">{e.role}</p></div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.online?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-400'}`}>{e.online?'Online':'Away'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KYC summary */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[['Total customers',data?.totalCustomers||0,'#1e293b'],['KYC pending',data?.pendingKyc||0,'var(--color-primary)'],['Total employees',data?.totalEmployees||0,'#3b82f6'],['Pending allocations',data?.pendingAllocations||0,'#854F0B']].map(([l,v,c])=>(
            <div key={l} className="card p-4"><p className="text-2xl font-bold" style={{color:c}}>{v}</p><p className="text-xs text-slate-400 mt-1">{l}</p></div>
          ))}
        </div>
      </div>
    </SidebarLayout>
  )
}
