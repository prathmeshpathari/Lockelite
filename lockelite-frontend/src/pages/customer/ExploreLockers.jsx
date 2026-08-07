import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const FLOOR_MAP = { A:'Small (Floor A)', B:'Medium (Floor B)', C:'Large (Floor C)', D:'Extra Large (Floor D)' }
const STATUS_CONFIG = {
  AVAILABLE: { dot:'bg-emerald-400', badge:'badge-green',  icon:'ti-lock-open',  label:'Available' },
  RESERVED:  { dot:'bg-amber-400',   badge:'badge-orange', icon:'ti-clock',      label:'Reserved'  },
  OCCUPIED:  { dot:'bg-slate-300',   badge:'badge-slate',  icon:'ti-lock',       label:'Occupied'  },
  SUSPENDED: { dot:'bg-red-400',     badge:'badge-red',    icon:'ti-ban',        label:'Suspended' },
}
const SIZE_COLORS = { SMALL:'bg-blue-50 border-blue-200 text-blue-700', MEDIUM:'bg-violet-50 border-violet-200 text-violet-700', LARGE:'bg-orange-50 border-orange-200 text-orange-700', XLARGE:'bg-rose-50 border-rose-200 text-rose-700' }

const MOCK = [
  { id:1, lockerNumber:'A-101', floor:'A', size:'SMALL',  price:1500, status:'AVAILABLE' },
  { id:2, lockerNumber:'A-102', floor:'A', size:'SMALL',  price:1500, status:'AVAILABLE' },
  { id:3, lockerNumber:'A-103', floor:'A', size:'SMALL',  price:1500, status:'OCCUPIED'  },
  { id:4, lockerNumber:'A-104', floor:'A', size:'SMALL',  price:1500, status:'RESERVED'  },
  { id:5, lockerNumber:'B-201', floor:'B', size:'MEDIUM', price:2800, status:'AVAILABLE' },
  { id:6, lockerNumber:'B-202', floor:'B', size:'MEDIUM', price:2800, status:'OCCUPIED'  },
  { id:7, lockerNumber:'B-203', floor:'B', size:'MEDIUM', price:2800, status:'AVAILABLE' },
  { id:8, lockerNumber:'C-301', floor:'C', size:'LARGE',  price:4500, status:'OCCUPIED'  },
  { id:9, lockerNumber:'C-302', floor:'C', size:'LARGE',  price:4500, status:'AVAILABLE' },
  { id:10,lockerNumber:'C-303', floor:'C', size:'LARGE',  price:3000, status:'AVAILABLE' },
  { id:11,lockerNumber:'D-401', floor:'D', size:'XLARGE', price:7000, status:'OCCUPIED'  },
  { id:12,lockerNumber:'D-402', floor:'D', size:'XLARGE', price:7000, status:'AVAILABLE' },
]

export default function ExploreLockers() {
  const [lockers, setLockers] = useState([])
  const [view,    setView]    = useState('vault')
  const [filter,  setFilter]  = useState('ALL')
  const [sel,     setSel]     = useState(null)
  const [booking, setBooking] = useState(false)
  const [booked,  setBooked]  = useState(false)
  const [branch,  setBranch]  = useState(null)
  const { show } = useToast()

  useEffect(() => {
    api.get('/customer/lockers/available').then(r => setLockers(r.data)).catch(err => {
      console.error(err)
      setLockers([])
      show('Failed to fetch available lockers from backend.', 'error')
    })
    api.get('/customer/branch/details').then(r => setBranch(r.data)).catch(() => {})
  }, [])

  const filtered = lockers.filter(l => filter === 'ALL' || l.status === filter)
  const floors = [...new Set(filtered.map(l => l.floor))].sort()

  const book = async () => {
    if (!sel || sel.status !== 'AVAILABLE') return
    setBooking(true)
    try {
      await api.post('/customer/bookings/request', { lockerId: sel.id, tenureMonths: 12 })
      setBooked(true)
      setSel(null)
      show('Locker booking request submitted! Awaiting officer approval.', 'success')
      setLockers(prev => prev.map(l => l.id === sel.id ? {...l, status:'RESERVED'} : l))
    } catch(ex) {
      show(ex.response?.data?.message || 'Booking failed. Ensure your KYC is approved.', 'error')
    } finally { setBooking(false) }
  }

  return (
    <SidebarLayout>
      <div className="p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Explore Lockers</h1>
            <p className="text-sm text-slate-500 mt-1">
              {branch ? `${branch.branchName} · ` : ''}Click any locker to inspect details and book
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('vault')} className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${view==='vault'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              <i className="ti ti-building-bank text-sm"/>Vault
            </button>
            <button onClick={() => setView('list')} className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${view==='list'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              <i className="ti ti-list text-sm"/>List
            </button>
          </div>
        </div>

        {/* Filter + legend */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-2">
            {['ALL','AVAILABLE','RESERVED','OCCUPIED'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter===f?'bg-primary text-white border-primary':'bg-white text-slate-600 border-slate-200 hover:border-orange-200'}`}>
                {f === 'ALL' ? 'All lockers' : f.charAt(0)+f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {Object.entries(STATUS_CONFIG).slice(0,3).map(([k,v]) => (
              <div key={k} className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${v.dot}`}/>{v.label}</div>
            ))}
          </div>
        </div>

        {/* Vault view */}
        {view === 'vault' && (
          <div className="space-y-6">
            {floors.map(fl => {
              const items = filtered.filter(l => l.floor === fl)
              if (!items.length) return null
              return (
                <div key={fl}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{FLOOR_MAP[fl] || `Floor ${fl}`}</span>
                    <div className="flex-1 h-px bg-slate-100"/>
                    <span className="text-xs text-slate-400">{items.filter(l=>l.status==='AVAILABLE').length} available</span>
                  </div>
                  <div className="grid grid-cols-6 gap-3">
                    {items.map(l => {
                      const cfg = STATUS_CONFIG[l.status]
                      const isSelected = sel?.id === l.id
                      return (
                        <div key={l.id} onClick={() => setSel(isSelected ? null : l)}
                          className={`rounded-2xl p-3.5 text-center cursor-pointer border-2 transition-all duration-200 hover:-translate-y-0.5 ${
                            isSelected
                              ? 'border-primary shadow-lg shadow-orange-100 bg-orange-50'
                              : l.status === 'AVAILABLE'
                                ? 'border-slate-100 bg-white hover:border-orange-200 hover:shadow-md'
                                : 'border-slate-100 bg-slate-50 opacity-70'
                          }`}>
                          <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${cfg.dot}`}/>
                          <i className={`ti ${cfg.icon} text-xl block mb-1 ${isSelected ? 'text-primary' : 'text-slate-400'}`}/>
                          <div className="text-xs font-bold text-slate-800">{l.lockerNumber}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{l.size.charAt(0)+l.size.slice(1).toLowerCase()}</div>
                          <div className="text-xs font-semibold text-primary mt-1">₹{l.price.toLocaleString()}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="card overflow-hidden">
            <div className="grid px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide"
              style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 120px' }}>
              <span>Locker</span><span>Floor</span><span>Size</span><span>Price/Year</span><span>Status</span><span className="text-right">Action</span>
            </div>
            {filtered.map(l => {
              const cfg = STATUS_CONFIG[l.status]
              return (
                <div key={l.id} onClick={() => setSel(sel?.id===l.id?null:l)}
                  className={`grid px-5 py-3.5 border-b border-slate-50 last:border-none items-center cursor-pointer hover:bg-orange-50/30 transition-all ${sel?.id===l.id?'bg-orange-50/50':''}`}
                  style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 120px' }}>
                  <span className="font-bold text-slate-900 font-mono">{l.lockerNumber}</span>
                  <span className="text-sm text-slate-600">Floor {l.floor}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border inline-block ${SIZE_COLORS[l.size]||''}`}>{l.size.charAt(0)+l.size.slice(1).toLowerCase()}</span>
                  <span className="text-sm font-semibold text-slate-800">₹{l.price.toLocaleString()}</span>
                  <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${cfg.dot}`}/><span className="text-xs text-slate-600">{cfg.label}</span></div>
                  <div className="flex justify-end">
                    {l.status === 'AVAILABLE'
                      ? <button onClick={e => { e.stopPropagation(); setSel(l) }} className="btn-primary text-xs px-3 py-1.5">Book</button>
                      : <span className="text-xs text-slate-400">Unavailable</span>
                    }
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <div className="py-12 text-center text-sm text-slate-400">No lockers match this filter</div>}
          </div>
        )}

        {/* Detail panel */}
        {sel && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 w-96 z-30 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <i className="ti ti-lock text-primary text-xl"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Locker {sel.lockerNumber}</h3>
                  <span className={STATUS_CONFIG[sel.status].badge}>{STATUS_CONFIG[sel.status].label}</span>
                </div>
              </div>
              <button onClick={() => setSel(null)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                <i className="ti ti-x text-sm"/>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              {[['Size', sel.size.charAt(0)+sel.size.slice(1).toLowerCase()],['Floor', `Floor ${sel.floor}`],['Annual Rent', `₹${sel.price.toLocaleString()}`],['Monthly', `₹${Math.round(sel.price/12).toLocaleString()}`]].map(([k,v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-slate-400 mb-0.5">{k}</p>
                  <p className="font-semibold text-slate-900">{v}</p>
                </div>
              ))}
            </div>
            <button onClick={book} disabled={sel.status!=='AVAILABLE'||booking}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 py-3">
              {booking ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Booking...</span></>
              ) : sel.status === 'AVAILABLE' ? (
                <><i className="ti ti-check"/><span>Book this locker</span></>
              ) : (
                <><i className="ti ti-ban"/><span>Not available</span></>
              )}
            </button>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
