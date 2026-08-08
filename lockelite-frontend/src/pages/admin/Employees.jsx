import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const MOCK_EMP = [
  { id:1, fullName:'Prathmesh Pathari', email:'prathmesh@lockelite.com', username:'emp001', role:'EMPLOYEE', isActive:true,  branchId:1, createdAt:'2024-01-15', color:'var(--color-primary)' },
  { id:2, fullName:'Rajan Mehta',       email:'rajan@lockelite.com',     username:'emp002', role:'EMPLOYEE', isActive:true,  branchId:1, createdAt:'2024-03-10', color:'#185FA5' },
  { id:3, fullName:'Anita Sharma',      email:'anita@lockelite.com',     username:'emp003', role:'EMPLOYEE', isActive:false, branchId:1, createdAt:'2023-11-05', color:'#10b981' },
]

const BANK_THEMES = {
  'State Bank of India': {
    headerAccent: '#0080FF',
    buttonBg: 'bg-[#0080FF] hover:bg-[#0080FF]/90 text-white',
    focusBorder: 'focus:border-[#0080FF] focus:ring-[#0080FF]/20',
    title: 'State Bank of India'
  },
  'Axis Bank': {
    headerAccent: '#97144D',
    buttonBg: 'bg-[#97144D] hover:bg-[#97144D]/90 text-white',
    focusBorder: 'focus:border-[#97144D] focus:ring-[#97144D]/20',
    title: 'Axis Bank'
  },
  'HDFC Bank': {
    headerAccent: '#004B8D',
    buttonBg: 'bg-[#ED232A] hover:bg-[#ED232A]/90 text-white',
    focusBorder: 'focus:border-[#004B8D] focus:ring-[#004B8D]/20',
    title: 'HDFC Bank'
  },
  'ICICI Bank': {
    headerAccent: '#052F5F',
    buttonBg: 'bg-[#F37021] hover:bg-[#F37021]/90 text-white',
    focusBorder: 'focus:border-[#F37021] focus:ring-[#F37021]/20',
    title: 'ICICI Bank'
  },
  'LOCKELITE': {
    headerAccent: '#E07A5F',
    buttonBg: 'bg-[#E07A5F] hover:bg-[#E07A5F]/90 text-white',
    focusBorder: 'focus:border-[#E07A5F] focus:ring-[#E07A5F]/20',
    title: 'LockElite'
  }
};

export function Employees() {
  const [employees, setEmployees] = useState([])
  const [sel, setSel]             = useState(null)
  const [search, setSearch]       = useState('')
  const [filterActive, setFA]     = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [tempPasswordMap, setTempPasswordMap] = useState({})
  const [newEmp, setNewEmp]       = useState({
    fullName: '',
    email: '',
    designation: 'Manager',
    bankCode: '',
    bankName: '',
    branchName: '',
    branchAddress: '',
    branchId: null,
    latitude: 0,
    longitude: 0,
  })
  const [adding, setAdding]       = useState(false)
  const adminCoordsRef = useRef({ lat: 19.2183, lng: 72.9781 })
  const [loadedBranches, setLoadedBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [branches, setBranches] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [editEmp, setEditEmp] = useState({ id: null, fullName: '', email: '' })
  const { show } = useToast()

  useEffect(() => {
    api.get('/admin/employees').then(r => setEmployees(r.data)).catch(err => {
      console.error(err)
      setEmployees([])
      show('Failed to fetch employees from backend.', 'error')
    })
    api.get('/admin/branches').then(r => setBranches(r.data)).catch(() => {})
    
    // Get admin coordinates
    navigator.geolocation.getCurrentPosition(
      pos => {
        adminCoordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {}
    );
  }, [])

  const activeTheme = useMemo(
    () => BANK_THEMES[newEmp.bankName] || BANK_THEMES['LOCKELITE'],
    [newEmp.bankName]
  )

  const getBranchName = (branchId) => {
    const b = branches.find(x => x.id === branchId)
    return b ? `${b.bankName} - ${b.branchName}` : `Branch #${branchId}`
  }

  // Uses same backend Overpass API as BankBranchSelector — real live OSM data
  const handleBankChange = useCallback(async (bankCode) => {
    // Single state update — reset everything in one shot to avoid double re-render flicker
    setNewEmp(prev => ({ ...prev, bankCode, bankName: bankCode, branchName: '', branchAddress: '', branchId: null, latitude: 0, longitude: 0 }))
    setLoadedBranches([])
    if (!bankCode) return
    setLoadingBranches(true)
    try {
      const lat = adminCoordsRef.current?.lat ?? 19.2183
      const lng = adminCoordsRef.current?.lng ?? 72.9781
      const res = await api.get('/branches/public', {
        params: { bankName: bankCode, latitude: lat, longitude: lng, radiusMeters: 40000 }
      })
      const list = (res.data || []).map(b => ({
        id:         b.id,
        branchName: b.branchName,
        address:    b.address,
        distanceKm: b.distanceKm,
        latitude:   parseFloat(b.latitude),
        longitude:  parseFloat(b.longitude),
        available:  b.available,
        lockers:    b.lockers,
      }))
      setLoadedBranches(list)
      if (list.length > 0) {
        // Single batched update — branch auto-select after API response
        setNewEmp(prev => ({
          ...prev,
          branchName:    list[0].branchName,
          branchAddress: list[0].address,
          branchId:      list[0].id,
          latitude:      list[0].latitude,
          longitude:     list[0].longitude,
        }))
      } else {
        show(`No branches found within 40 km — try a different bank`, 'warning')
      }
    } catch (err) {
      show('Could not load branches from map — check backend is running', 'error')
    } finally {
      setLoadingBranches(false)
    }
  }, [show])

  const resetPassword = async (id) => {
    if (!window.confirm("Are you sure you want to reset this employee's password? A new temporary password will be sent to their email.")) return;
    try {
      const res = await api.post(`/admin/employees/${id}/reset-password`);
      const tempPass = res.data?.tempPassword;
      if (tempPass) {
        setTempPasswordMap(prev => ({ ...prev, [id]: tempPass }));
        show("Password reset successfully. Temporary password shown in details panel.", "success");
      } else {
        show("Password reset successfully. Credentials sent to email.", "success");
      }
    } catch (ex) {
      show(ex.response?.data?.message || "Failed to reset password", "error");
    }
  }

  const openEditModal = (emp) => {
    setEditEmp({ id: emp.id, fullName: emp.fullName, email: emp.email });
    setShowEditModal(true);
  }

  const saveEmployeeEdit = async () => {
    if (!editEmp.fullName || !editEmp.email) { show('Name and email required', 'error'); return }
    try {
      await api.put(`/admin/employees/${editEmp.id}`, { fullName: editEmp.fullName, email: editEmp.email });
      setEmployees(prev => prev.map(x => x.id === editEmp.id ? { ...x, fullName: editEmp.fullName, email: editEmp.email } : x));
      setSel(prev => prev?.id === editEmp.id ? { ...prev, fullName: editEmp.fullName, email: editEmp.email } : prev);
      setShowEditModal(false);
      show("Employee details updated successfully", "success");
    } catch (ex) {
      show(ex.response?.data?.message || "Failed to save updates", "error");
    }
  }

  const toggleStatus = async (id) => {
    const e = employees.find(x => x.id===id)
    try { await api.put(`/admin/employees/${id}/status`, { active: !e.isActive }) } catch {}
    setEmployees(prev => prev.map(x => x.id===id ? {...x, isActive:!x.isActive} : x))
    setSel(s => s?.id===id ? {...s, isActive:!s.isActive} : s)
    show(e.isActive ? `${e.fullName} deactivated` : `${e.fullName} reactivated`, e.isActive?'warning':'success')
  }

  const addEmployee = async () => {
    if (!newEmp.fullName || !newEmp.email) { show('Name and email required','error'); return }
    if (newEmp.bankName !== 'LOCKELITE' && !newEmp.branchName) { show('Please select a branch','error'); return }
    setAdding(true)
    try {
      const res = await api.post('/admin/employees', newEmp)
      const emp = { 
        id: res.data?.id || Date.now(), 
        fullName: newEmp.fullName, 
        email: newEmp.email, 
        username: res.data?.empCode || `emp${Date.now()}`, 
        role: 'EMPLOYEE', 
        isActive: true, 
        branchId: res.data?.branchId || newEmp.branchId,
        bankName: res.data?.bankName || newEmp.bankName,
        branchName: res.data?.branchName || newEmp.branchName,
        createdAt: new Date().toISOString(), 
        color: activeTheme.headerAccent 
      }
      setEmployees(prev => [emp, ...prev])
      
      const tempPass = res.data?.tempPassword;
      if (tempPass) {
        setTempPasswordMap(prev => ({ ...prev, [emp.id]: tempPass }));
      }
      
      setSel(emp);
      setShowModal(false)
      setNewEmp({ fullName:'',email:'',designation:'Manager',bankCode:'',bankName:'',branchName:'',branchAddress:'',branchId:null,latitude:0,longitude:0 })
      setLoadedBranches([])
      
      if (tempPass) {
        show(`${newEmp.fullName} added. Temporary password shown in details panel.`, 'success')
      } else {
        show(`${newEmp.fullName} added. Credentials sent to email.`, 'success')
      }
    } catch(ex) { show(ex.response?.data?.message||'Failed to add employee','error') }
    finally { setAdding(false) }
  }

  const filtered = employees.filter(e => {
    if (filterActive==='active' && !e.isActive) return false
    if (filterActive==='inactive' && e.isActive) return false
    if (search && !e.fullName.toLowerCase().includes(search) && !e.email.toLowerCase().includes(search)) return false
    return true
  })

  const fmtDate = s => new Date(s).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})

  return (
    <SidebarLayout>
      <div className="p-7">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-xl font-bold text-slate-900">Employees</h1><p className="text-sm text-slate-500 mt-1">Manage branch staff and access</p></div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><i className="ti ti-user-plus"/>Add Employee</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[['Total',employees.length,'#1e293b'],['Active',employees.filter(e=>e.isActive).length,'#10b981'],['Inactive',employees.filter(e=>!e.isActive).length,'#ef4444'],['Branches',branches.length,'#3b82f6']].map(([l,v,c])=>(
            <div key={l} className="card p-4"><p className="text-2xl font-bold" style={{color:c}}>{v}</p><p className="text-xs text-slate-400 mt-1">{l}</p></div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          {[['all','All'],['active','Active'],['inactive','Inactive']].map(([v,l])=>(
            <button key={v} onClick={()=>setFA(v)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterActive===v?'bg-primary text-white border-primary':'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
          ))}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex-1 max-w-xs">
            <i className="ti ti-search text-slate-400 text-sm"/>
            <input value={search} onChange={e=>setSearch(e.target.value.toLowerCase())} placeholder="Search name or email..." className="text-xs outline-none bg-transparent flex-1"/>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 card overflow-hidden">
            <div className="grid px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{gridTemplateColumns:'1.5fr 1.8fr 1fr 0.8fr 0.8fr'}}>
              <span>Employee</span><span>Email</span><span>Branch</span><span>Status</span><span>Action</span>
            </div>
            {filtered.map(e => (
              <div key={e.id} onClick={()=>setSel(e)}
                className={`grid px-5 py-3.5 border-b border-slate-50 last:border-none items-center cursor-pointer hover:bg-orange-50/30 transition-all ${sel?.id===e.id?'bg-orange-50/50 border-l-4 border-l-primary':''}`}
                style={{gridTemplateColumns:'1.5fr 1.8fr 1fr 0.8fr 0.8fr'}}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:e.color}}>{e.fullName.charAt(0)}</div>
                  <div><p className="text-sm font-semibold text-slate-800">{e.fullName}</p><p className="text-[10px] text-slate-400">Since {fmtDate(e.createdAt)}</p></div>
                </div>
                <span className="text-xs text-slate-500 truncate">{e.email}</span>
                <span className="text-xs text-slate-500 truncate" title={getBranchName(e.branchId)} style={{maxWidth: '150px'}}>{getBranchName(e.branchId)}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.isActive?'badge-green':'badge-red'}`}>{e.isActive?'Active':'Inactive'}</span>
                <button onClick={ev=>{ev.stopPropagation();toggleStatus(e.id)}} className={`text-xs px-2 py-1 rounded-lg border font-semibold transition-all ${e.isActive?'border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600':'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                  {e.isActive?'Deactivate':'Activate'}
                </button>
              </div>
            ))}
            {filtered.length===0&&<div className="py-10 text-center text-sm text-slate-400">No employees found</div>}
          </div>

          {/* Detail */}
          <div className="card p-5">
            {!sel ? (
              <div className="text-center py-10 text-slate-300"><i className="ti ti-user text-5xl block mb-2"/><p className="text-sm">Click a row to view details</p></div>
            ) : (
              <>
                <div className="flex flex-col items-center mb-5 pb-5 border-b border-slate-50">
                  <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center text-xl font-bold mb-2" style={{background:sel.color}}>{sel.fullName.charAt(0)}</div>
                  <p className="font-bold text-slate-900 text-center">{sel.fullName}</p>
                  <p className="text-xs text-slate-400">Employee · {getBranchName(sel.branchId)}</p>
                  <span className={`mt-2 text-xs font-semibold px-3 py-1 rounded-full ${sel.isActive?'badge-green':'badge-red'}`}>{sel.isActive?'Active':'Inactive'}</span>
                </div>
                <div className="space-y-2 mb-5">
                  {[['Email',sel.email],['Username',sel.username],['Joined',fmtDate(sel.createdAt)]].map(([k,v])=>(
                    <div key={k} className="flex justify-between"><span className="text-xs text-slate-400">{k}</span><span className="text-xs font-semibold text-slate-800 truncate ml-2">{v}</span></div>
                  ))}
                  {tempPasswordMap[sel.id] && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl animate-fade-in">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Temp Password</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(tempPasswordMap[sel.id]);
                            show("Password copied to clipboard!", "success");
                          }}
                          className="text-[10px] font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                        >
                          <i className="ti ti-copy"/>Copy
                        </button>
                      </div>
                      <p className="text-sm font-bold text-amber-950 font-mono select-all bg-white/60 px-2.5 py-1.5 rounded-lg border border-amber-100/50">{tempPasswordMap[sel.id]}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <button onClick={() => openEditModal(sel)} className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"><i className="ti ti-edit text-sm"/>Edit Details</button>
                  <button onClick={() => resetPassword(sel.id)} className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"><i className="ti ti-key text-sm"/>Reset Password</button>
                  <button onClick={()=>toggleStatus(sel.id)} className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition-all ${sel.isActive?'border-red-200 text-red-600 hover:bg-red-50':'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                    <i className={`ti ${sel.isActive?'ti-ban':'ti-check'} text-sm`}/>{sel.isActive?'Deactivate':'Reactivate'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in overflow-hidden relative">
            <div className="h-2 rounded-t-3xl -mx-6 -mt-6 mb-5" style={{ backgroundColor: activeTheme.headerAccent }} />
            
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">Add New Employee</h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setNewEmp({ fullName:'',email:'',designation:'Manager',bankCode:'',bankName:'',branchName:'',branchAddress:'',branchId:null,latitude:0,longitude:0 })
                  setLoadedBranches([])
                }} 
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <i className="ti ti-x text-sm"/>
              </button>
            </div>
            
            <div className="space-y-3 mb-5">
              {[['fullName','Full Name','Prathmesh Pathari','text'],['email','Email Address','emp@lockelite.com','email']].map(([k,l,p,t])=>(
                <div key={k}>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{l}</label>
                  <input 
                    type={t} 
                    value={newEmp[k]} 
                    onChange={e=>setNewEmp({...newEmp,[k]:e.target.value})} 
                    placeholder={p} 
                    className={`input-field transition-all duration-200 outline-none focus:ring-2 ${activeTheme.focusBorder}`}
                  />
                </div>
              ))}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Designation</label>
                  <select 
                    value={newEmp.designation} 
                    onChange={e=>setNewEmp({...newEmp,designation:e.target.value})} 
                    className={`input-field transition-all duration-200 outline-none focus:ring-2 ${activeTheme.focusBorder}`}
                  >
                    {['Manager','Senior Manager','KYC Officer','Locker Officer','Front Desk'].map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Select Bank</label>
                  <select 
                    value={newEmp.bankName} 
                    onChange={e => handleBankChange(e.target.value)} 
                    className={`input-field transition-all duration-200 outline-none focus:ring-2 ${activeTheme.focusBorder}`}
                  >
                    <option value="">— Select a bank —</option>
                    <option value="LOCKELITE">LockElite (Default)</option>
                    <option value="SBI">State Bank of India</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="ICICI">ICICI Bank</option>
                    <option value="AXIS">Axis Bank</option>
                    <option value="KOTAK">Kotak Mahindra Bank</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                  Select Branch
                  {loadingBranches && <span className="inline-block w-3 h-3 border border-slate-300 border-t-slate-600 rounded-full animate-spin"/>}
                  {!loadingBranches && loadedBranches.length > 0 && (
                    <span className="text-emerald-600 font-semibold normal-case tracking-normal">· {loadedBranches.length} found via OpenStreetMap</span>
                  )}
                </label>
                <select
                  value={loadedBranches.findIndex(b => b.branchName === newEmp.branchName)}
                  onChange={e => {
                    const idx = parseInt(e.target.value)
                    if (idx >= 0 && loadedBranches[idx]) {
                      const b = loadedBranches[idx]
                      setNewEmp(prev => ({
                        ...prev,
                        branchName:    b.branchName,
                        branchAddress: b.address,
                        branchId:      b.id,
                        latitude:      b.latitude,
                        longitude:     b.longitude,
                      }))
                    }
                  }}
                  disabled={!newEmp.bankName || loadingBranches || loadedBranches.length === 0}
                  className={`input-field transition-all duration-200 outline-none focus:ring-2 ${activeTheme.focusBorder} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {!newEmp.bankName ? (
                    <option value={-1}>Select a bank first</option>
                  ) : loadingBranches ? (
                    <option value={-1}>Searching OpenStreetMap...</option>
                  ) : loadedBranches.length === 0 ? (
                    <option value={-1}>No branches found — try expanding area</option>
                  ) : (
                    loadedBranches.map((b, idx) => (
                      <option key={idx} value={idx}>
                        {b.branchName}{b.distanceKm ? ` · ${b.distanceKm} km` : ''}
                      </option>
                    ))
                  )}
                </select>
                {/* Selected branch address card */}
                {newEmp.branchAddress && !loadingBranches && (
                  <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-start gap-1.5">
                      <span className="text-red-400 text-xs flex-shrink-0 mt-0.5">📍</span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-600 leading-relaxed">{newEmp.branchAddress}</p>
                        {newEmp.branchId && loadedBranches.find(b=>b.branchName===newEmp.branchName)?.distanceKm && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                            {loadedBranches.find(b=>b.branchName===newEmp.branchName)?.distanceKm} km from your location
                            {loadedBranches.find(b=>b.branchName===newEmp.branchName)?.available != null &&
                              ` · ${loadedBranches.find(b=>b.branchName===newEmp.branchName).available} lockers available`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setShowModal(false);
                  setNewEmp({ fullName:'',email:'',designation:'Manager',bankCode:'',bankName:'',branchName:'',branchAddress:'',branchId:null,latitude:0,longitude:0 })
                  setLoadedBranches([])
                }} 
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={addEmployee} 
                disabled={adding || !newEmp.bankCode || !newEmp.branchName || !newEmp.fullName || !newEmp.email} 
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTheme.buttonBg} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {adding ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Adding...</span></>
                ) : (
                  <><i className="ti ti-user-plus"/><span>Add Employee</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Employee Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in overflow-hidden relative">
            <div className="h-2 rounded-t-3xl -mx-6 -mt-6 mb-5" style={{ backgroundColor: activeTheme.headerAccent }} />
            
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">Edit Employee Details</h3>
              <button onClick={() => setShowEditModal(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><i className="ti ti-x text-sm"/></button>
            </div>
            
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Full Name</label>
                <input 
                  type="text" 
                  value={editEmp.fullName} 
                  onChange={e => setEditEmp({ ...editEmp, fullName: e.target.value })} 
                  className={`input-field transition-all duration-200 outline-none focus:ring-2 ${activeTheme.focusBorder}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Email Address</label>
                <input 
                  type="email" 
                  value={editEmp.email} 
                  onChange={e => setEditEmp({ ...editEmp, email: e.target.value })} 
                  className={`input-field transition-all duration-200 outline-none focus:ring-2 ${activeTheme.focusBorder}`}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveEmployeeEdit} className={`btn-primary flex-1 flex items-center justify-center gap-2 ${activeTheme.buttonBg}`}>
                <i className="ti ti-circle-check"/><span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}

export default Employees