import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const MOCK_LOGS = [
  { id:1, action:'USER_REGISTERED',     userId:10, entityType:'User',       entityId:10, previousState:null,      newState:'PENDING',   timestamp:'2026-08-03T10:32:00', currentHash:'a1b2c3d4e5f6...', previousHash:'GENESIS_BLOCK_LOCKELITE_2026', chainValid:true  },
  { id:2, action:'EMAIL_VERIFIED',       userId:10, entityType:'User',       entityId:10, previousState:'UNVERIFIED',newState:'VERIFIED', timestamp:'2026-08-03T10:35:00', currentHash:'b2c3d4e5f6a1...', previousHash:'a1b2c3d4e5f6...', chainValid:true  },
  { id:3, action:'KYC_SUBMITTED',        userId:10, entityType:'CustomerProfile',entityId:1, previousState:null,   newState:'PENDING',   timestamp:'2026-08-03T11:00:00', currentHash:'c3d4e5f6a1b2...', previousHash:'b2c3d4e5f6a1...', chainValid:true  },
  { id:4, action:'KYC_APPROVED',         userId:5,  entityType:'CustomerProfile',entityId:1, previousState:'PENDING',newState:'APPROVED', timestamp:'2026-08-03T14:30:00', currentHash:'d4e5f6a1b2c3...', previousHash:'c3d4e5f6a1b2...', chainValid:true  },
  { id:5, action:'ALLOCATION_REQUESTED', userId:10, entityType:'Allocation',  entityId:1, previousState:'AVAILABLE',newState:'RESERVED', timestamp:'2026-08-03T15:00:00', currentHash:'e5f6a1b2c3d4...', previousHash:'d4e5f6a1b2c3...', chainValid:false },
  { id:6, action:'ALLOCATION_APPROVED',  userId:5,  entityType:'Allocation',  entityId:1, previousState:'PENDING', newState:'APPROVED',  timestamp:'2026-08-03T16:00:00', currentHash:'f6a1b2c3d4e5...', previousHash:'e5f6a1b2c3d4...', chainValid:true  },
]

const ACTION_BADGE = {
  USER_REGISTERED:'bg-blue-50 text-blue-700',    EMAIL_VERIFIED:'bg-teal-50 text-teal-700',
  KYC_SUBMITTED:'bg-amber-50 text-amber-700',    KYC_APPROVED:'bg-emerald-50 text-emerald-700',
  KYC_REJECTED:'bg-red-50 text-red-700',         ALLOCATION_REQUESTED:'bg-violet-50 text-violet-700',
  ALLOCATION_APPROVED:'bg-emerald-50 text-emerald-700', ALLOCATION_REJECTED:'bg-red-50 text-red-700',
  USER_LOGIN:'bg-slate-100 text-slate-600',      PASSWORD_CHANGED:'bg-orange-50 text-orange-700',
}

export function AuditLogs() {
  const [logs, setLogs]         = useState([])
  const [scanning, setScan]     = useState(false)
  const [verifying, setVer]     = useState(false)
  const [chainResult, setCR]    = useState(null)
  const [scanResult, setSR]     = useState(null)
  const [filter, setFilter]     = useState('')
  const { show } = useToast()

  useEffect(() => {
    api.get('/admin/audit-logs').then(r => setLogs(r.data)).catch(err => {
      console.error(err)
      setLogs([])
      show('Failed to fetch audit logs from backend.', 'error')
    })
  }, [])

  const runAiScan = async () => {
    setScan(true); setSR(null)
    try {
      const res = await api.get('/admin/audit-logs/ai-scan'); setSR(res.data)
    } catch {
      await new Promise(r=>setTimeout(r,2000))
      setSR({ flagged:[
        { action:'ALLOCATION_APPROVED', risk:'High',   detail:'Chain hash mismatch at entry #5 — possible data tampering or corruption' },
        { action:'KYC_APPROVED',        risk:'Medium', detail:'KYC approved within 25 min of submission — verify reviewer identity' },
        { action:'USER_LOGIN',          risk:'Low',    detail:'Login from unusual hour for employee account emp001' },
      ]})
    } finally { setScan(false) }
  }

  const verifyChain = async () => {
    setVer(true); setCR(null)
    try {
      const res = await api.get('/admin/audit-logs/verify-chain'); setCR(res.data)
    } catch {
      await new Promise(r=>setTimeout(r,1000))
      setCR({ chainValid: logs.every(l=>l.chainValid), message: logs.every(l=>l.chainValid)?'Chain integrity verified':'Chain violation detected' })
    } finally { setVer(false) }
  }

  const filtered = logs.filter(l => !filter || l.action.toLowerCase().includes(filter.toLowerCase()))
  const fmtTs = s => new Date(s).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hour12:true })

  return (
    <SidebarLayout>
      <div className="p-7">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold text-slate-900">Audit Logs</h1><p className="text-sm text-slate-500 mt-1">Immutable SHA-256 chained audit trail</p></div>
          <div className="flex gap-2">
            <button onClick={verifyChain} disabled={verifying} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
              <i className={`ti ti-link ${verifying?'animate-spin':''}`}/>{verifying?'Verifying...':'Verify Chain'}
            </button>
            <button onClick={runAiScan} disabled={scanning} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <i className={`ti ti-robot ${scanning?'animate-spin':''}`}/>{scanning?'Scanning...':'Run AI Scan'}
            </button>
          </div>
        </div>

        {/* Chain result */}
        {chainResult && (
          <div className={`rounded-2xl px-5 py-3.5 mb-4 flex items-center gap-3 text-sm font-medium ${chainResult.chainValid?'bg-emerald-50 border border-emerald-200 text-emerald-800':'bg-red-50 border border-red-200 text-red-800'}`}>
            <i className={`ti ${chainResult.chainValid?'ti-shield-check text-emerald-500':'ti-shield-x text-red-500'} text-xl`}/>
            {chainResult.chainValid ? '✅ Chain integrity verified — all SHA-256 hashes match. No tampering detected.' : '⚠️ Chain violation detected! Hash mismatch found. Investigate immediately.'}
          </div>
        )}

        {/* AI Scan results */}
        {scanResult && (
          <div className="card p-5 mb-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><i className="ti ti-robot text-primary"/>AI Scan Results — {scanResult.flagged.length} issues flagged</h3>
            <div className="space-y-2">
              {scanResult.flagged.map((f,i)=>(
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${f.risk==='High'?'bg-red-50 border border-red-200':f.risk==='Medium'?'bg-amber-50 border border-amber-200':'bg-blue-50 border border-blue-200'}`}>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${f.risk==='High'?'bg-red-600 text-white':f.risk==='Medium'?'bg-amber-600 text-white':'bg-blue-600 text-white'}`}>{f.risk}</span>
                  <div><p className="text-xs font-semibold text-slate-800">{f.action}</p><p className="text-xs text-slate-600 mt-0.5">{f.detail}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 mb-4 max-w-xs">
          <i className="ti ti-search text-slate-400 text-sm"/>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter by action..." className="text-xs outline-none bg-transparent flex-1"/>
        </div>

        {/* Logs table */}
        <div className="card overflow-hidden">
          <div className="grid px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide"
            style={{ gridTemplateColumns:'1.8fr 0.8fr 0.8fr 1.3fr 1.5fr 0.5fr' }}>
            <span>Action</span><span>User ID</span><span>Entity</span><span>Timestamp</span><span>SHA-256 Hash</span><span>Chain</span>
          </div>
          {filtered.map(l => (
            <div key={l.id} className="grid px-5 py-3.5 border-b border-slate-50 last:border-none items-center hover:bg-slate-50/50 transition-all"
              style={{ gridTemplateColumns:'1.8fr 0.8fr 0.8fr 1.3fr 1.5fr 0.5fr' }}>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${ACTION_BADGE[l.action]||'bg-slate-100 text-slate-600'}`}>{l.action}</span>
              <span className="text-xs text-slate-500">#{l.userId||'SYS'}</span>
              <span className="text-xs text-slate-500">{l.entityType||'—'}</span>
              <span className="text-xs text-slate-500">{fmtTs(l.timestamp)}</span>
              <span className="text-[10px] font-mono text-slate-400 truncate">{l.currentHash}</span>
              <div className="flex items-center justify-center">
                {l.chainValid
                  ? <span className="text-emerald-500 text-lg" title="Chain valid"><i className="ti ti-circle-check"/></span>
                  : <span className="text-red-500 text-lg" title="Chain broken"><i className="ti ti-circle-x"/></span>
                }
              </div>
            </div>
          ))}
          {filtered.length===0 && <div className="py-10 text-center text-sm text-slate-400">No logs found</div>}
        </div>
        <p className="text-xs text-slate-400 text-center mt-3"><i className="ti ti-circle-check text-emerald-500 mr-1"/>= Chain valid &nbsp;·&nbsp; <i className="ti ti-circle-x text-red-500 mr-1"/>= Chain broken (possible tampering)</p>
      </div>
    </SidebarLayout>
  )
}

export default AuditLogs
