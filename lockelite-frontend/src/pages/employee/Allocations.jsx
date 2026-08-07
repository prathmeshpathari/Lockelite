import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const MOCK = [
  { id:1, customer:{fullName:'Prasad Mane',  id:10}, locker:{lockerNumber:'A-102',size:'SMALL',  price:1500}, tenureMonths:12, status:'PENDING',            officer1:null, officer2:null, requestedAt:'2026-08-03T10:00:00' },
  { id:2, customer:{fullName:'Rahul Sharma', id:11}, locker:{lockerNumber:'C-302',size:'LARGE',  price:4500}, tenureMonths:12, status:'PENDING',            officer1:null, officer2:null, requestedAt:'2026-08-03T11:00:00' },
  { id:3, customer:{fullName:'Meena Patil',  id:12}, locker:{lockerNumber:'D-402',size:'XLARGE', price:7000}, tenureMonths:24, status:'PARTIALLY_APPROVED', officer1:{id:5,fullName:'Prathmesh Pathari'}, officer2:null, requestedAt:'2026-08-02T14:00:00' },
  { id:4, customer:{fullName:'Suresh Nair',  id:13}, locker:{lockerNumber:'B-203',size:'MEDIUM', price:2800}, tenureMonths:12, status:'APPROVED',           officer1:{id:5}, officer2:null, requestedAt:'2026-08-01T09:00:00', approvedAt:'2026-08-01T15:00:00' },
]

const NEEDS_DUAL = ['LARGE','XLARGE']
const STATUS_LABELS = { PENDING:'Pending', PARTIALLY_APPROVED:'Step 1 Done', APPROVED:'Approved', REJECTED:'Rejected' }
const SIZE_BADGE = { SMALL:'bg-blue-50 text-blue-700 border-blue-200', MEDIUM:'bg-violet-50 text-violet-700 border-violet-200', LARGE:'bg-orange-50 text-orange-700 border-orange-200', XLARGE:'bg-rose-50 text-rose-700 border-rose-200' }

export default function Allocations() {
  const { user } = useAuth()
  const { show } = useToast()
  const [requests, setRequests] = useState([])
  const [filter, setFilter]     = useState('all')
  const [acting, setActing]     = useState(null)
  const officerId = user?.userId || 1

  useEffect(() => {
    api.get('/employee/allocations/pending').then(r => setRequests(r.data)).catch(err => {
      console.error(err)
      setRequests([])
      show('Failed to fetch pending allocation requests from backend.', 'error')
    })
  }, [])

  const doApprove = async (id) => {
    setActing(id)
    try {
      const res = await api.post(`/employee/allocations/${id}/approve`)
      const status = res.data?.status || 'APPROVED'
      setRequests(prev => prev.map(r => {
        if (r.id !== id) return r
        if (!NEEDS_DUAL.includes(r.locker.size)) return { ...r, status:'APPROVED', officer1:{ id:officerId } }
        if (!r.officer1) return { ...r, status:'PARTIALLY_APPROVED', officer1:{ id:officerId, fullName:user?.fullName } }
        return { ...r, status:'APPROVED', officer2:{ id:officerId } }
      }))
      show(status === 'APPROVED' ? '✅ Locker fully approved!' : '⏳ Step 1 approved. Waiting for second officer.', status==='APPROVED'?'success':'info')
    } catch(ex) {
      show(ex.response?.data?.message || 'Approval failed', 'error')
    } finally { setActing(null) }
  }

  const doReject = async (id) => {
    setActing(id)
    try {
      await api.post(`/employee/allocations/${id}/reject`, { reason:'Rejected by officer' })
      setRequests(prev => prev.map(r => r.id===id ? {...r, status:'REJECTED'} : r))
      show('Allocation rejected', 'warning')
    } catch { show('Reject failed','error') }
    finally { setActing(null) }
  }

  const fmtDate = s => new Date(s).toLocaleDateString('en-IN', { day:'numeric', month:'short' })

  const StepCircles = ({ r }) => {
    const dual = NEEDS_DUAL.includes(r.locker.size)
    if (!dual) {
      return (
        <div className="flex items-center gap-1.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${r.officer1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
            {r.officer1 ? <i className="ti ti-check text-xs"/> : '1'}
          </div>
          <span className="text-xs text-slate-400">{r.officer1 ? 'Done' : 'Pending'}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${r.officer1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
          {r.officer1 ? <i className="ti ti-check text-xs"/> : '1'}
        </div>
        <div className={`w-6 h-0.5 ${r.officer1 ? 'bg-emerald-300' : 'bg-slate-200'}`}/>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          r.officer2 ? 'bg-emerald-500 text-white' :
          r.officer1 ? 'bg-amber-400 text-white animate-pulse' :
          'bg-slate-100 text-slate-400 border border-slate-200'
        }`}>
          {r.officer2 ? <i className="ti ti-check text-xs"/> : '2'}
        </div>
        <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">Dual</span>
      </div>
    )
  }

  const ActionCell = ({ r }) => {
    const isLoading = acting === r.id
    if (r.status === 'APPROVED') return <span className="badge-green"><i className="ti ti-check mr-1"/>Approved</span>
    if (r.status === 'REJECTED') return <span className="badge-red"><i className="ti ti-x mr-1"/>Rejected</span>
    const dual = NEEDS_DUAL.includes(r.locker.size)
    const canApprove = !dual || !r.officer1 || (r.officer1 && r.officer1.id !== officerId && !r.officer2)
    const waitingSecond = dual && r.officer1 && r.officer1.id === officerId && !r.officer2
    if (waitingSecond) return (
      <div>
        <span className="badge-orange"><i className="ti ti-clock mr-1"/>Awaiting Officer 2</span>
        <p className="text-[10px] text-slate-400 mt-0.5">You approved Step 1</p>
      </div>
    )
    const btnLabel = dual && r.officer1 ? 'Approve (Step 2)' : dual ? 'Approve (Step 1)' : 'Approve'
    const btnColor = dual && r.officer1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-orange-600'
    return (
      <div className="flex items-center gap-1.5">
        {canApprove && (
          <button onClick={() => doApprove(r.id)} disabled={!!acting}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-semibold transition-all disabled:opacity-40 ${btnColor}`}>
            {isLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="ti ti-check text-xs"/>}
            {btnLabel}
          </button>
        )}
        <button onClick={() => doReject(r.id)} disabled={!!acting}
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:border-red-200 hover:text-red-500 transition-all disabled:opacity-40">
          <i className="ti ti-x"/>
        </button>
      </div>
    )
  }

  const filtered = requests.filter(r => {
    if (filter === 'pending')   return r.status === 'PENDING' || r.status === 'PARTIALLY_APPROVED'
    if (filter === 'dual')      return NEEDS_DUAL.includes(r.locker?.size) && (r.status==='PENDING'||r.status==='PARTIALLY_APPROVED')
    if (filter === 'done')      return r.status === 'APPROVED' || r.status === 'REJECTED'
    return true
  })

  return (
    <SidebarLayout>
      <div className="p-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Allocation Requests</h1>
            <p className="text-sm text-slate-500 mt-1">Review and approve customer locker booking requests</p>
          </div>
          <span className="badge-orange text-sm px-3 py-1.5">{requests.filter(r=>r.status==='PENDING'||r.status==='PARTIALLY_APPROVED').length} pending</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[['Total',requests.length,'ti-list','text-slate-800'],['Pending',requests.filter(r=>r.status==='PENDING').length,'ti-clock','text-amber-600'],['Approved',requests.filter(r=>r.status==='APPROVED').length,'ti-check','text-emerald-600'],['Dual required',requests.filter(r=>NEEDS_DUAL.includes(r.locker?.size)&&(r.status==='PENDING'||r.status==='PARTIALLY_APPROVED')).length,'ti-shield-check','text-blue-600']].map(([l,v,icon,c])=>(
            <div key={l} className="card p-4 flex items-center gap-3">
              <i className={`ti ${icon} text-2xl ${c}`}/>
              <div><p className={`text-xl font-bold ${c}`}>{v}</p><p className="text-xs text-slate-400">{l}</p></div>
            </div>
          ))}
        </div>

        {/* Dual approval info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 mb-4 text-sm text-blue-700 flex items-center gap-3">
          <i className="ti ti-shield-check text-xl text-blue-500"/>
          <div>
            <strong>Four-Eyes Policy:</strong> Large & Extra Large lockers require approval from <strong>two different officers</strong>. The same officer cannot approve twice.
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {[['all','All requests'],['pending','Pending'],['dual','Needs dual approval'],['done','Completed']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter===v?'bg-primary text-white border-primary':'bg-white text-slate-600 border-slate-200 hover:border-orange-200'}`}>{l}</button>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="grid px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide"
            style={{ gridTemplateColumns:'1.5fr 0.8fr 0.8fr 0.7fr 0.8fr 1.4fr 1.6fr' }}>
            <span>Customer</span><span>Locker</span><span>Size</span><span>Tenure</span><span>Rent</span><span>Approval Steps</span><span>Action</span>
          </div>
          {filtered.map(r => (
            <div key={r.id} className="grid px-5 py-4 border-b border-slate-50 last:border-none items-center hover:bg-slate-50/50 transition-all"
              style={{ gridTemplateColumns:'1.5fr 0.8fr 0.8fr 0.7fr 0.8fr 1.4fr 1.6fr' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {r.customer?.fullName?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.customer?.fullName}</p>
                  <p className="text-[10px] text-slate-400">Requested {fmtDate(r.requestedAt)}</p>
                </div>
              </div>
              <span className="font-mono font-bold text-sm text-slate-800">{r.locker?.lockerNumber}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border inline-block ${SIZE_BADGE[r.locker?.size]||''}`}>{r.locker?.size}</span>
              <span className="text-xs text-slate-600">{r.tenureMonths} mo</span>
              <span className="text-sm font-semibold text-slate-800">₹{(r.locker?.price||0).toLocaleString()}</span>
              <StepCircles r={r}/>
              <ActionCell r={r}/>
            </div>
          ))}
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-slate-400"><i className="ti ti-check text-3xl text-emerald-300 block mb-2"/>All clear in this category</div>}
        </div>
      </div>
    </SidebarLayout>
  )
}
