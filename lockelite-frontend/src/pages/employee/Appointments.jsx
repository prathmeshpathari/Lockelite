import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const MOCK = [
  { id:1, customer:{fullName:'Prasad Mane'},  visitDate:'2026-08-05', visitTime:'10:00:00', purpose:'Locker Access',  status:'CONFIRMED', digitalKey:'LK-A3F9B2', digitalKeySent:true,  locker:{lockerNumber:'B-201'} },
  { id:2, customer:{fullName:'Rahul Sharma'}, visitDate:'2026-08-05', visitTime:'14:00:00', purpose:'Renewal',        status:'CONFIRMED', digitalKey:null,         digitalKeySent:false, locker:{lockerNumber:'C-302'} },
  { id:3, customer:{fullName:'Meena Patil'},  visitDate:'2026-08-06', visitTime:'11:00:00', purpose:'KYC Visit',      status:'UPCOMING',  digitalKey:null,         digitalKeySent:false, locker:null },
  { id:4, customer:{fullName:'Suresh Nair'},  visitDate:'2026-08-07', visitTime:'10:30:00', purpose:'Locker Access',  status:'UPCOMING',  digitalKey:null,         digitalKeySent:false, locker:{lockerNumber:'D-402'} },
  { id:5, customer:{fullName:'Vikram Joshi'}, visitDate:'2026-08-03', visitTime:'09:00:00', purpose:'Locker Access',  status:'COMPLETED', digitalKey:'LK-BX7R2A',  digitalKeySent:true,  locker:{lockerNumber:'A-101'} },
]

const STATUS_CFG = {
  UPCOMING:  { badge:'bg-blue-50 text-blue-700 border border-blue-200',    label:'Upcoming',   actions:['confirm','cancel']    },
  CONFIRMED: { badge:'bg-emerald-50 text-emerald-700 border border-emerald-200', label:'Confirmed',  actions:['complete','cancel'] },
  COMPLETED: { badge:'bg-slate-100 text-slate-500',                         label:'Completed',  actions:[]                      },
  CANCELLED: { badge:'bg-red-50 text-red-600 border border-red-200',        label:'Cancelled',  actions:[]                      },
}
const PURPOSE_CFG = {
  'Locker Access':{ bg:'bg-blue-50 text-blue-700',    icon:'ti-lock'       },
  'Renewal':      { bg:'bg-violet-50 text-violet-700',icon:'ti-refresh'    },
  'KYC Visit':    { bg:'bg-emerald-50 text-emerald-700',icon:'ti-file-check'},
  'General Query':{ bg:'bg-slate-100 text-slate-600', icon:'ti-message'    },
}

export default function Appointments() {
  const [appts,  setAppts]  = useState([])
  const [sel,    setSel]    = useState(null)
  const [filter, setFilter] = useState('all')
  const [note,   setNote]   = useState('')
  const [acting, setActing] = useState(null)
  // Key verify modal
  const [showVerify,   setShowVerify]   = useState(false)
  const [verifyInput,  setVerifyInput]  = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifying,    setVerifying]    = useState(false)
  const { show } = useToast()

  useEffect(() => {
    api.get('/employee/appointments').then(r => setAppts(r.data)).catch(err => {
      console.error(err)
      setAppts([])
      show('Failed to fetch appointments from backend.', 'error')
    })
  }, [])

  const doAction = async (id, action) => {
    setActing(id)
    try {
      await api.post(`/employee/appointments/${id}/${action}`)
      const statusMap = { confirm:'CONFIRMED', complete:'COMPLETED', cancel:'CANCELLED' }
      setAppts(prev => prev.map(a => a.id===id ? {...a, status:statusMap[action]} : a))
      setSel(s  => s?.id===id  ? {...s,  status:statusMap[action]} : s)
      const msgs  = { confirm:'Appointment confirmed', complete:'Visit completed', cancel:'Appointment cancelled' }
      const types = { confirm:'success', complete:'success', cancel:'warning' }
      show(msgs[action], types[action])
    } catch(ex) { show(ex.response?.data?.message||'Action failed','error') }
    finally { setActing(null) }
  }

  const sendKey = async (id) => {
    setActing(`key_${id}`)
    try {
      const res = await api.post(`/employee/appointments/${id}/send-key`)
      const key = res.data?.digitalKey
      setAppts(prev => prev.map(a => a.id===id ? {...a, digitalKeySent:true, digitalKey:key} : a))
      setSel(s => s?.id===id ? {...s, digitalKeySent:true, digitalKey:key} : s)
      show(`🔐 Digital key ${key} sent to customer!`, 'success')
    } catch(ex) { show(ex.response?.data?.message||'Failed to send key','error') }
    finally { setActing(null) }
  }

  const verifyKey = async () => {
    if (!verifyInput.trim()) return
    setVerifying(true); setVerifyResult(null)
    try {
      const res = await api.post('/employee/appointments/verify-key', { digitalKey: verifyInput.trim().toUpperCase() })
      setVerifyResult({ ok:true, data:res.data })
      show('✅ Digital key verified — access granted!','success')
    } catch(ex) {
      setVerifyResult({ ok:false, message:ex.response?.data?.message||'Invalid key' })
      show('❌ Invalid or expired digital key','error')
    } finally { setVerifying(false) }
  }

  const today = new Date().toISOString().split('T')[0]
  const todayAppts = appts.filter(a => a.visitDate===today)
  const filtered   = appts.filter(a => filter==='all'||a.status===filter)

  const todayObj = new Date()
  const currentDay = todayObj.getDate()
  const currentMonthName = todayObj.toLocaleString('default', { month: 'long' })
  const currentYear = todayObj.getFullYear()
  const firstDayIndex = new Date(currentYear, todayObj.getMonth(), 1).getDay()
  const totalDays = new Date(currentYear, todayObj.getMonth() + 1, 0).getDate()

  const fmtDate = s => new Date(s+'T00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
  const fmtTime = s => { const [h,m]=s.split(':'); const hr=parseInt(h); return `${hr>12?hr-12:hr||12}:${m} ${hr>=12?'PM':'AM'}` }

  return (
    <SidebarLayout>
      <div className="p-7">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Appointment Desk</h1>
            <p className="text-sm text-slate-500 mt-1">Mon–Fri · 9:00 AM – 5:00 PM · Digital key auto-sent 30 min before each visit</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowVerify(true); setVerifyInput(''); setVerifyResult(null) }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background:'var(--color-primary)' }}>
              <i className="ti ti-key text-base"/>Verify Key
            </button>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {todayAppts.length} today
            </span>
          </div>
        </div>

        {/* Digital Key Verify Modal */}
        {showVerify && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <i className="ti ti-key text-[#F68222]"/>Verify Digital Key
                </h3>
                <button onClick={() => setShowVerify(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <i className="ti ti-x text-sm"/>
                </button>
              </div>

              <p className="text-sm text-slate-500 mb-4">Enter the customer's digital key (shown on their email) to verify access.</p>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Digital Access Key</label>
                <input value={verifyInput} onChange={e => setVerifyInput(e.target.value.toUpperCase())}
                  placeholder="LK-A3F9B2" maxLength={9}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-center text-xl font-mono font-bold tracking-widest focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color':'var(--color-primary)' }}
                  onKeyDown={e => e.key==='Enter' && verifyKey()}/>
              </div>

              {/* Verify result */}
              {verifyResult && (
                <div className={`rounded-2xl p-4 mb-4 ${verifyResult.ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  {verifyResult.ok ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <i className="ti ti-circle-check text-emerald-600 text-xl"/>
                        <p className="font-bold text-emerald-800 text-sm">Access Granted</p>
                      </div>
                      <div className="space-y-1.5">
                        {[['Customer',verifyResult.data.customerName],['Locker',verifyResult.data.lockerNumber],['Time',verifyResult.data.visitTime],['Purpose',verifyResult.data.purpose]].map(([l,v])=>(
                          <div key={l} className="flex justify-between text-xs">
                            <span className="text-emerald-600">{l}</span>
                            <span className="font-semibold text-emerald-900">{v}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <i className="ti ti-circle-x text-red-500 text-xl"/>
                      <p className="font-semibold text-red-700 text-sm">{verifyResult.message}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setShowVerify(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
                <button onClick={verifyKey} disabled={!verifyInput.trim()||verifying}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background:'var(--color-primary)' }}>
                  {verifying ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Verifying...</span></> : <><i className="ti ti-shield-check"/><span>Verify</span></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[['Total',appts.length,'#1e293b'],['Today',todayAppts.length,'#F68222'],['Upcoming',appts.filter(a=>a.status==='UPCOMING').length,'#3b82f6'],['Confirmed',appts.filter(a=>a.status==='CONFIRMED').length,'#10b981'],['Keys sent',appts.filter(a=>a.digitalKeySent).length,'#8b5cf6']].map(([l,v,c])=>(
            <div key={l} className="bg-white rounded-2xl border border-slate-100 p-3.5">
              <p className="text-xl font-bold" style={{color:c}}>{v}</p>
              <p className="text-xs text-slate-400 mt-0.5">{l}</p>
            </div>
          ))}
        </div>

        {/* Digital key info banner */}
        <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3.5 mb-5 flex items-start gap-3">
          <i className="ti ti-key text-violet-500 text-xl flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-bold text-violet-900 mb-0.5">Digital Access Keys — Auto-sent 30 minutes before each confirmed visit</p>
            <p className="text-xs text-violet-700">A unique one-time key (e.g. LK-A3F9B2) is automatically emailed to customers 30 minutes before their confirmed appointment. You can also manually send a key using the <strong>Send Key</strong> button. Use <strong>Verify Key</strong> to grant locker access at entry.</p>
          </div>
        </div>

        {/* Today strip */}
        {todayAppts.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-5 border-l-4" style={{borderLeftColor:'var(--color-primary)'}}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{color:'var(--color-primary)'}}>
              <i className="ti ti-sun text-sm"/>Today — {fmtDate(today)}
            </p>
            {todayAppts.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-none">
                <span className="text-xs font-bold w-16 flex-shrink-0" style={{color:'var(--color-primary)'}}>{fmtTime(a.visitTime)}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:'var(--color-primary)'}}>{a.customer?.fullName?.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.customer?.fullName}</p>
                  <p className="text-xs text-slate-400">{a.locker?.lockerNumber ? `Locker ${a.locker.lockerNumber} · ` : ''}{a.purpose}</p>
                </div>
                {/* Digital key badge */}
                {a.digitalKeySent && a.digitalKey
                  ? <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1">
                      <i className="ti ti-key text-violet-600 text-xs"/>
                      <span className="font-mono text-xs font-bold text-violet-800 tracking-widest">{a.digitalKey}</span>
                    </div>
                  : a.status==='CONFIRMED' && <button onClick={() => sendKey(a.id)} disabled={acting===`key_${a.id}`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-all disabled:opacity-40">
                      {acting===`key_${a.id}` ? <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin"/> : <i className="ti ti-key text-xs"/>}
                      Send Key
                    </button>
                }
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CFG[a.status]?.badge}`}>{STATUS_CFG[a.status]?.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {[['all','All'],['UPCOMING','Upcoming'],['CONFIRMED','Confirmed'],['COMPLETED','Completed'],['CANCELLED','Cancelled']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter===v?'text-white border-transparent':'bg-white text-slate-600 border-slate-200 hover:border-orange-200'}`}
              style={filter===v?{background:'var(--color-primary)',borderColor:'var(--color-primary)'}:{}}>{l}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Table */}
          <div className="col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="grid px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide"
                style={{gridTemplateColumns:'1.4fr 1.1fr 1.1fr 0.9fr 0.8fr'}}>
                <span>Customer</span><span>Date & Time</span><span>Purpose</span><span>Digital Key</span><span>Status</span>
              </div>
              {filtered.map(a => {
                const pcfg = PURPOSE_CFG[a.purpose]||{bg:'bg-slate-100 text-slate-600',icon:'ti-calendar'}
                return (
                  <div key={a.id} onClick={() => { setSel(a); setNote('') }}
                    className={`grid px-5 py-3 border-b border-slate-50 last:border-none items-center cursor-pointer transition-all hover:bg-orange-50/30 ${sel?.id===a.id?'bg-orange-50/50 border-l-4':'border-l-4 border-l-transparent'}`}
                    style={sel?.id===a.id?{borderLeftColor:'var(--color-primary)'}:{}}
                    >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:'var(--color-primary)'}}>{a.customer?.fullName?.charAt(0)}</div>
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.customer?.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-800">{fmtDate(a.visitDate)}</p>
                      <p className="text-xs font-bold" style={{color:'var(--color-primary)'}}>{fmtTime(a.visitTime)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${pcfg.bg}`}>
                      <i className={`ti ${pcfg.icon} text-xs`}/>{a.purpose}
                    </span>
                    {/* Digital key column */}
                    <div>
                      {a.digitalKeySent && a.digitalKey
                        ? <div className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-lg px-1.5 py-0.5 inline-flex">
                            <i className="ti ti-key text-violet-600 text-xs"/>
                            <span className="font-mono text-[10px] font-bold text-violet-800 tracking-widest">{a.digitalKey}</span>
                          </div>
                        : a.status==='CONFIRMED'
                          ? <button onClick={e=>{e.stopPropagation();sendKey(a.id)}} disabled={acting===`key_${a.id}`}
                              className="text-xs text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-lg hover:bg-violet-100 flex items-center gap-1 disabled:opacity-40">
                              {acting===`key_${a.id}`?<div className="w-3 h-3 border border-violet-400 border-t-violet-700 rounded-full animate-spin"/>:<i className="ti ti-send text-xs"/>}
                              Send
                            </button>
                          : <span className="text-xs text-slate-300">—</span>
                      }
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CFG[a.status]?.badge}`}>{STATUS_CFG[a.status]?.label}</span>
                  </div>
                )
              })}
              {filtered.length===0 && <div className="py-10 text-center text-sm text-slate-400">No appointments</div>}
            </div>
          </div>

          {/* Detail + Calendar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              {!sel ? (
                <div className="text-center py-8 text-slate-300"><i className="ti ti-calendar-event text-5xl block mb-2"/><p className="text-sm">Click a row to view</p></div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white" style={{background:'var(--color-primary)'}}>{sel.customer?.fullName?.charAt(0)}</div>
                    <div><p className="font-bold text-slate-900">{sel.customer?.fullName}</p><p className="text-xs text-slate-500">{sel.purpose} · {sel.locker?.lockerNumber||'No locker'}</p></div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {[['Date',fmtDate(sel.visitDate)],['Time',fmtTime(sel.visitTime)],['Purpose',sel.purpose],['Locker',sel.locker?.lockerNumber||'N/A']].map(([k,v])=>(
                      <div key={k} className="flex justify-between py-1 border-b border-slate-50 last:border-none">
                        <span className="text-xs text-slate-400">{k}</span>
                        <span className="text-xs font-semibold text-slate-800">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-xs text-slate-400">Status</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CFG[sel.status]?.badge}`}>{STATUS_CFG[sel.status]?.label}</span>
                    </div>
                  </div>

                  {/* Digital key section */}
                  <div className={`rounded-xl p-3 mb-4 ${sel.digitalKeySent && sel.digitalKey ? 'bg-violet-50 border border-violet-200' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 text-violet-700">
                      <i className="ti ti-key text-xs"/>Digital Access Key
                    </p>
                    {sel.digitalKeySent && sel.digitalKey ? (
                      <>
                        <p className="font-mono text-2xl font-black text-violet-900 tracking-[6px] text-center py-2">{sel.digitalKey}</p>
                        <p className="text-[10px] text-violet-500 text-center">✓ Emailed to customer</p>
                      </>
                    ) : (
                      <div className="text-center py-1">
                        <p className="text-xs text-slate-400 mb-2">{sel.status==='CONFIRMED' ? 'Auto-sends 30 min before visit' : 'Confirm appointment to enable'}</p>
                        {sel.status==='CONFIRMED' && (
                          <button onClick={() => sendKey(sel.id)} disabled={acting===`key_${sel.id}`}
                            className="w-full py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
                            style={{background:'#8b5cf6'}}>
                            {acting===`key_${sel.id}`?<><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Sending...</span></>:<><i className="ti ti-send text-xs"/><span>Send Key Now</span></>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note..." rows={2}
                    className="input-field resize-none text-xs mb-3 w-full"/>

                  <div className="space-y-2">
                    {(STATUS_CFG[sel.status]?.actions||[]).map(action => (
                      <button key={action} onClick={() => doAction(sel.id,action)} disabled={acting===sel.id}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${action==='confirm'?'text-white':action==='complete'?'bg-emerald-600 text-white':'border border-red-200 text-red-600 hover:bg-red-50'}`}
                        style={action==='confirm'?{background:'var(--color-primary)'}:{}}>
                        {acting===sel.id?<div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<i className={`ti ${action==='confirm'?'ti-circle-check':action==='complete'?'ti-check':'ti-x'} text-sm`}/>}
                        {action.charAt(0).toUpperCase()+action.slice(1)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Mini calendar */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{currentMonthName} {currentYear}</p>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} className="text-[9px] text-slate-400 py-1">{d}</div>)}
                {[...Array(firstDayIndex)].map((_,i)=><div key={`e${i}`}/>)}
                {Array.from({length:totalDays},(_,i)=>i+1).map(d=>{
                  const hasAppt = appts.some(a=>new Date(a.visitDate+'T00:00').getDate()===d)
                  const isToday = d===currentDay
                  const isWeekend = [0, 6].includes(new Date(currentYear, todayObj.getMonth(), d).getDay())
                  return (
                    <div key={d} className={`text-[11px] py-1.5 rounded-lg cursor-pointer transition-all ${
                      isToday?'text-white font-bold rounded-full':
                      hasAppt?'bg-orange-50 font-semibold':
                      isWeekend?'text-slate-200':'text-slate-500 hover:bg-slate-50'
                    }`} style={isToday?{background:'var(--color-primary)'}:hasAppt?{color:'var(--color-primary)'}:{}}>{d}</div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
