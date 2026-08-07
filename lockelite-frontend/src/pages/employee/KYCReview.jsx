import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const MOCK_KYC = [
  { id:1, fullName:'Prasad Mane',  aadhaarMasked:'XXXX-XXXX-1234', panNumber:'ABCDE1234F', kycStatus:'PENDING', address:'Plot 12, Vasind, Maharashtra', phoneNumber:'9876543210', aadhaarVerified:true, panVerified:true, nameMatch:true,  rejectionReason:null, user:{fullName:'Prasad Mane',  email:'prasad@example.com'} },
  { id:2, fullName:'Rahul Sharma', aadhaarMasked:'XXXX-XXXX-5678', panNumber:'CDEFT5678G', kycStatus:'PENDING', address:'15 MG Road, Pune',           phoneNumber:'9123456789', aadhaarVerified:true, panVerified:true, nameMatch:false, rejectionReason:null, user:{fullName:'Rahul Sharma', email:'rahul@example.com'} },
  { id:3, fullName:'Meena Patil',  aadhaarMasked:'XXXX-XXXX-9012', panNumber:'MNAPT9012K', kycStatus:'PENDING', address:'7 Shivaji Nagar, Nashik',     phoneNumber:'9998887776', aadhaarVerified:true, panVerified:true, nameMatch:true,  rejectionReason:null, user:{fullName:'Meena Patil',  email:'meena@example.com'} },
]

export function KYCReview() {
  const [list, setList]     = useState([])
  const [sel, setSel]       = useState(null)
  const [tab, setTab]       = useState('aadhaar')
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    api.get('/employee/kyc/pending').then(r => setList(r.data)).catch(err => {
      console.error(err)
      setList([])
      show('Failed to fetch pending KYC requests from backend.', 'error')
    })
  }, [])

  const act = async (id, action) => {
    setActing(true)
    try {
      if (action === 'approve') await api.post(`/employee/kyc/${id}/approve`)
      else                      await api.post(`/employee/kyc/${id}/reject`, { reason })
      setList(prev => prev.map(k => k.id===id ? {...k, kycStatus: action==='approve'?'APPROVED':'REJECTED'} : k))
      setSel(s => s?.id===id ? {...s, kycStatus: action==='approve'?'APPROVED':'REJECTED'} : s)
      show(action==='approve' ? '✅ KYC approved successfully' : '✕ KYC rejected', action==='approve'?'success':'warning')
      setReason('')
    } catch(ex) { show(ex.response?.data?.message||'Action failed','error') }
    finally { setActing(false) }
  }

  const statusBadge = s => ({ PENDING:'badge-orange', APPROVED:'badge-green', REJECTED:'badge-red' }[s] || 'badge-slate')

  const formatDate = (dateStr) => {
    if (!dateStr) return '15/05/1999'
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  }

  const AadhaarCard = ({ d }) => (
    <div className="w-80 mx-auto rounded-2xl overflow-hidden shadow-lg border border-slate-200">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 px-4 py-2.5 flex justify-between items-center">
        <div><div className="text-white font-bold text-sm">आधार</div><div className="text-emerald-200 text-[9px]">AADHAAR</div></div>
        <div className="text-emerald-200 text-[9px] text-right"><div>Unique Identification</div><div>Authority of India</div></div>
      </div>
      <div className="bg-white p-4 flex gap-3">
        <div className="w-14 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">👤</div>
        <div>
          <p className="font-bold text-base text-slate-900">{d.fullName}</p>
          <p className="text-xs text-slate-500 mt-0.5">DOB: {formatDate(d.user?.dateOfBirth)}</p>
          <p className="text-xs text-slate-500">Gender: Male</p>
          <p className="text-xs text-slate-400 mt-1">{d.address?.split(',').slice(0,2).join(',')}</p>
          <p className="font-bold text-emerald-700 tracking-[3px] text-sm mt-1.5">{d.aadhaarMasked?.replace(/-/g,' ')}</p>
        </div>
      </div>
      <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-t border-slate-100">
        <span className="text-[10px] text-slate-400">Setu Verified</span>
        {d.aadhaarVerified && <span className="badge-green text-[10px]"><i className="ti ti-check mr-1"/>Verified</span>}
      </div>
    </div>
  )

  const PanCard = ({ d }) => (
    <div className="w-80 mx-auto rounded-2xl overflow-hidden shadow-lg border border-slate-200">
      <div className="bg-[#1a237e] px-4 py-2.5 flex justify-between items-center">
        <div><div className="text-white font-bold text-xs">INCOME TAX DEPT</div><div className="text-blue-200 text-[9px]">GOVT. OF INDIA</div></div>
        <span className="text-2xl">🇮🇳</span>
      </div>
      <div className="bg-white p-4 flex gap-3">
        <div className="w-14 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">👤</div>
        <div>
          <div className="mb-1"><p className="text-[9px] text-slate-400">NAME</p><p className="font-bold text-sm text-slate-900">{d.fullName?.toUpperCase()}</p></div>
          <div className="mb-1"><p className="text-[9px] text-slate-400">FATHER'S NAME</p><p className="text-xs font-semibold text-slate-800">{(d.fatherName || 'Suresh Mane').toUpperCase()}</p></div>
          <div><p className="text-[9px] text-slate-400">DATE OF BIRTH</p><p className="text-xs font-semibold text-slate-800">{formatDate(d.user?.dateOfBirth)}</p></div>
        </div>
      </div>
      <div className="bg-[#f5f5f5] px-4 py-2.5 text-center border-t border-slate-100">
        <p className="text-lg font-bold tracking-[4px] text-[#1a237e]">{d.panNumber}</p>
      </div>
      <div className="bg-emerald-50 px-4 py-1.5 flex items-center justify-center border-t border-emerald-100">
        <span className="badge-green text-[10px]"><i className="ti ti-check mr-1"/>Setu PAN Verified</span>
      </div>
    </div>
  )

  return (
    <SidebarLayout>
      <div className="flex h-full min-h-screen">
        {/* Left list */}
        <div className="w-60 flex-shrink-0 border-r border-slate-100 bg-white flex flex-col">
          <div className="px-4 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">KYC Requests</p>
            <p className="text-xs text-slate-400 mt-0.5">{list.filter(l=>l.kycStatus==='PENDING').length} pending review</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.map(k => (
              <div key={k.id} onClick={() => { setSel(k); setTab('aadhaar') }}
                className={`px-4 py-3.5 border-b border-slate-50 cursor-pointer transition-all ${sel?.id===k.id?'bg-orange-50 border-l-4 border-l-primary':'hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">{k.fullName}</p>
                  <span className={`${statusBadge(k.kycStatus)} text-[10px]`}>{k.kycStatus}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{k.panNumber}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!sel ? (
            <div className="flex items-center justify-center h-full text-slate-300">
              <div className="text-center"><i className="ti ti-file-check text-6xl block mb-3"/><p className="text-sm">Select a KYC request to review</p></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="ti ti-user-check text-primary"/>Reviewing: {sel.fullName}
                  <span className={statusBadge(sel.kycStatus)}>{sel.kycStatus}</span>
                </h2>
                {sel.kycStatus === 'PENDING' && (
                  <div className="flex gap-2">
                    <button onClick={() => act(sel.id,'reject')} disabled={acting} className="btn-secondary flex items-center gap-1.5 text-red-600 border-red-200 hover:border-red-300 disabled:opacity-40">
                      <i className="ti ti-x"/>Reject
                    </button>
                    <button onClick={() => act(sel.id,'approve')} disabled={acting} className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
                      {acting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="ti ti-check"/>}
                      Approve KYC
                    </button>
                  </div>
                )}
              </div>

              {/* Verified data */}
              <div className="card p-5 mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="ti ti-shield-check text-primary"/>Setu Verified Details</p>
                <div className="grid grid-cols-3 gap-4">
                  {[['Full Name',sel.fullName],["Father's Name",sel.fatherName || 'Suresh Mane'],['Aadhaar (masked)',sel.aadhaarMasked],['PAN Number',sel.panNumber],['Phone',sel.phoneNumber],['Aadhaar Verified',sel.aadhaarVerified?'✅ Yes':'❌ No'],['PAN Verified',sel.panVerified?'✅ Yes':'❌ No'],['Name Match',sel.nameMatch?'✅ Matched':'⚠️ Mismatch']].map(([l,v])=>(
                    <div key={l}><p className="text-[10px] text-slate-400 mb-0.5">{l}</p><p className={`text-sm font-semibold ${l==='Name Match'?(sel.nameMatch?'text-emerald-700':'text-amber-700'):'text-slate-900'}`}>{v}</p></div>
                  ))}
                  <div className="col-span-3"><p className="text-[10px] text-slate-400 mb-0.5">Address</p><p className="text-sm font-semibold text-slate-900">{sel.address}</p></div>
                </div>
              </div>

              {/* Name mismatch warning */}
              {!sel.nameMatch && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 flex items-center gap-2">
                  <i className="ti ti-alert-triangle text-amber-500"/>Name mismatch between Aadhaar and PAN — verify manually before approving.
                </div>
              )}

              {/* Document tabs */}
              <div className="card p-5 mb-4">
                <div className="flex border-b border-slate-100 mb-4">
                  {[['aadhaar','🪪 Aadhaar Document'],['pan','💳 PAN Card']].map(([t,l]) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-all ${tab===t?'border-primary text-primary':'border-transparent text-slate-400 hover:text-slate-600'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="py-2">
                  {tab === 'aadhaar' ? <AadhaarCard d={sel}/> : <PanCard d={sel}/>}
                  <p className="text-center text-xs text-slate-400 mt-3">Submitted by {sel.user?.email}</p>
                </div>
              </div>

              {/* Rejection reason */}
              {sel.kycStatus === 'PENDING' && (
                <div className="card p-5">
                  <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Rejection reason (if rejecting)</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Enter reason for rejection..."
                    className="input-field resize-none"/>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}

export default KYCReview
