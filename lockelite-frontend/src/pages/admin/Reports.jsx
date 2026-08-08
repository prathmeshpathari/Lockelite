import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

const COLOR_MAPS = {
  'Small': 'var(--color-primary)',
  'Medium': '#3b82f6',
  'Large': '#10b981',
  'Extra Lg': '#ef4444',
  'Registered': '#185FA5',
  'KYC submitted': '#854F0B',
  'KYC approved': '#10b981',
  'Locker allocated': 'var(--color-primary)'
}

export default function Reports() {
  const [range, setRange] = useState('6m')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const { show } = useToast()

  useEffect(() => {
    api.get('/admin/reports')
      .then(res => {
        setStats(res.data)
        setLoading(false)
      })
      .catch(err => {
        show(err.response?.data?.message || 'Failed to fetch reporting statistics', 'error')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent"/>
        </div>
      </SidebarLayout>
    )
  }

  if (!stats) {
    return (
      <SidebarLayout>
        <div className="p-7 text-center text-slate-400 mt-20">
          <i className="ti ti-alert-triangle text-3xl block mb-2"/>
          Failed to load reports. Please try again.
        </div>
      </SidebarLayout>
    )
  }

  // Monthly rent chart logic
  const months = stats.months || []
  const rent = stats.monthlyRent || []
  
  const sliceCount = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const startIndex = Math.max(0, months.length - sliceCount)
  
  const slicedMonths = months.slice(startIndex)
  const slicedRent = rent.slice(startIndex)
  const maxRentVal = Math.max(...slicedRent, 1)

  // Format revenue helper
  const formatRevenue = (val) => {
    if (!val) return '₹0'
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`
    }
    return `₹${val.toLocaleString()}`
  }

  return (
    <SidebarLayout>
      <div className="p-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500 mt-1">Branch financial and operational overview</p>
          </div>
          <div className="flex gap-1.5">
            {['3m','6m','1y'].map(r=>(
              <button key={r} onClick={()=>setRange(r)} className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${range===r?'bg-primary text-white border-primary':'bg-white text-slate-600 border-slate-200'}`}>{r}</button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Revenue YTD', value: formatRevenue(stats.totalRevenue), sub: 'Overall transaction value', color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Avg Occupancy', value: `${stats.avgOccupancy}%`, sub: `${stats.totalOccupied} of ${stats.totalLockersCount} lockers active`, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Outstanding Dues', value: `₹${(stats.outstandingDues || 0).toLocaleString()}`, sub: 'Unpaid approved allocations', color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Penalties', value: `₹${(stats.penalties || 0).toLocaleString()}`, sub: `${stats.penaltyCount} overdue allocations`, color: 'text-amber-700', bg: 'bg-amber-50' }
          ].map((item)=>(
            <div key={item.label} className={`card p-4 ${item.bg} border-0`}>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-600 mt-1 font-medium">{item.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Rent bar chart */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ti ti-chart-bar text-primary"/>Monthly rent collected (₹K)
            </h3>
            <div className="flex items-end gap-2 h-32 mb-2">
              {slicedRent.map((v,i)=>(
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[9px] text-slate-400 font-medium">{v}K</span>
                  <div className="w-full rounded-t-lg transition-all duration-500"
                    style={{ height:`${(v/maxRentVal)*118}px`, background: i===slicedRent.length-1?'linear-gradient(180deg,#E07010,#C05A00)':'linear-gradient(180deg,#F68222,#E07010)', opacity:0.7+(i*0.02) }}/>
                  <span className="text-[9px] text-slate-400">{slicedMonths[i]}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between text-xs">
              <span className="text-slate-400">Average: ₹{slicedRent.length === 0 ? 0 : Math.round(slicedRent.reduce((a,b)=>a+Number(b),0)/slicedRent.length)}K/month</span>
              <span className="font-bold text-primary">Total: ₹{slicedRent.reduce((a,b)=>a+Number(b),0).toFixed(1)}K</span>
            </div>
          </div>

          {/* Occupancy by size */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ti ti-chart-donut text-primary"/>Locker occupancy by size
            </h3>
            <div className="space-y-3.5">
              {(stats.occupancyBySize || []).map((item)=>(
                <div key={item.size} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">{item.size}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width:`${item.percentage}%`, background: COLOR_MAPS[item.size] || 'var(--color-primary)' }}/>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 w-8 text-right">{item.occupied}/{item.total}</span>
                  <span className="text-xs font-bold w-8 text-right" style={{color: COLOR_MAPS[item.size] || 'var(--color-primary)'}}>{item.percentage}%</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 mt-4 pt-3 flex justify-between text-xs text-slate-500">
              <span>Total: {stats.totalOccupied}/{stats.totalLockersCount} occupied</span>
              <span className="font-bold text-primary">{stats.avgOccupancy}% full</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* KYC funnel */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ti ti-filter text-primary"/>Customer KYC funnel
            </h3>
            {(stats.kycFunnel || []).map((item)=>(
              <div key={item.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-bold" style={{color: COLOR_MAPS[item.label] || 'var(--color-primary)'}}>{item.count} ({item.percentage}%)</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${item.percentage}%`, background: COLOR_MAPS[item.label] || 'var(--color-primary)'}}/>
                </div>
              </div>
            ))}
          </div>

          {/* Recent payments */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ti ti-credit-card text-primary"/>Recent rent payments
            </h3>
            {(!stats.recentPayments || stats.recentPayments.length === 0) ? (
              <div className="text-center py-10 text-xs text-slate-400">
                <i className="ti ti-credit-card text-2xl block mb-1"/>
                No recent payment transactions recorded.
              </div>
            ) : (
              <div className="card overflow-hidden border-0 shadow-none">
                <div className="grid text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 border-b border-slate-100" style={{gridTemplateColumns:'1fr 0.7fr 0.8fr 0.8fr'}}>
                  <span>Customer</span><span>Locker</span><span>Amount</span><span>Status</span>
                </div>
                {stats.recentPayments.map((item, idx)=>(
                  <div key={idx} className="grid py-2.5 border-b border-slate-50 last:border-none items-center" style={{gridTemplateColumns:'1fr 0.7fr 0.8fr 0.8fr'}}>
                    <span className="text-xs font-medium text-slate-800">{item.customer}</span>
                    <span className="text-xs text-slate-500">{item.locker}</span>
                    <span className="text-xs font-semibold text-slate-800">₹{item.amount.toLocaleString()}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block text-center ${item.status==='Paid'?'badge-green':item.status==='Overdue'?'badge-red':'badge-orange'}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
