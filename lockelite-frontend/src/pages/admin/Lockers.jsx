import { useState, useEffect } from 'react'
import SidebarLayout from '../../components/layout/SidebarLayout'
import { useToast } from '../../context/ToastContext'
import api from '../../services/api'

const MOCK = [
  { id:1, lockerNumber:'A-101', floor:'A', size:'SMALL',  price:1500, status:'AVAILABLE', branch:{branchName:'Vasind Branch'} },
  { id:2, lockerNumber:'A-102', floor:'A', size:'SMALL',  price:1500, status:'AVAILABLE', branch:{branchName:'Vasind Branch'} },
  { id:3, lockerNumber:'A-103', floor:'A', size:'SMALL',  price:1500, status:'OCCUPIED',  branch:{branchName:'Vasind Branch'} },
  { id:4, lockerNumber:'B-201', floor:'B', size:'MEDIUM', price:2800, status:'AVAILABLE', branch:{branchName:'Vasind Branch'} },
  { id:5, lockerNumber:'B-202', floor:'B', size:'MEDIUM', price:2800, status:'RESERVED',  branch:{branchName:'Vasind Branch'} },
  { id:6, lockerNumber:'C-301', floor:'C', size:'LARGE',  price:4500, status:'OCCUPIED',  branch:{branchName:'Vasind Branch'} },
  { id:7, lockerNumber:'C-302', floor:'C', size:'LARGE',  price:4500, status:'AVAILABLE', branch:{branchName:'Vasind Branch'} },
  { id:8, lockerNumber:'D-401', floor:'D', size:'XLARGE', price:7000, status:'OCCUPIED',  branch:{branchName:'Vasind Branch'} },
  { id:9, lockerNumber:'D-402', floor:'D', size:'XLARGE', price:7000, status:'AVAILABLE', branch:{branchName:'Vasind Branch'} },
]
const STATUS_CFG = { AVAILABLE:'bg-emerald-50 border-emerald-200 text-emerald-700', OCCUPIED:'bg-slate-100 border-slate-200 text-slate-500', RESERVED:'bg-amber-50 border-amber-200 text-amber-700', SUSPENDED:'bg-red-50 border-red-200 text-red-600' }
const STATUS_ICON = { AVAILABLE:'ti-lock-open', OCCUPIED:'ti-lock', RESERVED:'ti-clock', SUSPENDED:'ti-ban' }
const FLOORS = { A:'Small', B:'Medium', C:'Large', D:'Extra Large' }

export default function LockersAdmin() {
  const [lockers, setLockers] = useState([])
  const [sel, setSel]         = useState(null)
  const [filter, setFilter]   = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [newL, setNewL] = useState({ lockerNumber:'', floor:'A', size:'SMALL', price:'', branchId:1 })
  const [adding, setAdding] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editL, setEditL] = useState({ id: null, lockerNumber: '', floor: 'A', size: 'SMALL', price: '', branchId: 1 })
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('ALL')
  const { show } = useToast()

  useEffect(() => {
    api.get('/admin/lockers').then(r => setLockers(r.data)).catch(err => {
      console.error(err)
      setLockers([])
      show('Failed to fetch lockers from backend.', 'error')
    })
    api.get('/admin/branches').then(r => {
      setBranches(r.data);
      if (r.data && r.data.length > 0) {
        const vasind = r.data.find(b => b.branchName.toLowerCase().includes('vasind'));
        setBranchFilter(String(vasind ? vasind.id : r.data[0].id));
      }
    }).catch(() => {})
  }, [])

  const addLocker = async () => {
    if (!newL.lockerNumber || !newL.price) { show('Locker number and price required','error'); return }
    setAdding(true)
    try {
      const res = await api.post('/admin/lockers', { ...newL, price: parseFloat(newL.price) })
      setLockers(prev => [...prev, { id:res.data?.id||Date.now(), ...newL, price:parseFloat(newL.price), status:'AVAILABLE', branch:{branchName:'Vasind Branch'} }])
      setShowModal(false)
      setNewL({ lockerNumber:'', floor:'A', size:'SMALL', price:'', branchId:1 })
      show('Locker added successfully', 'success')
    } catch(ex) { show(ex.response?.data?.message||'Failed to add locker','error') }
    finally { setAdding(false) }
  }

  const toggleLockerSuspension = async (locker) => {
    const newStatus = locker.status === 'SUSPENDED' ? 'AVAILABLE' : 'SUSPENDED';
    const confirmMsg = newStatus === 'SUSPENDED' 
      ? "Are you sure you want to suspend this locker? Customers won't be able to book it."
      : "Are you sure you want to unsuspend this locker and make it available?";
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await api.put(`/admin/lockers/${locker.id}/status`, { status: newStatus });
      setLockers(prev => prev.map(l => l.id === locker.id ? { ...l, status: newStatus } : l));
      setSel(prev => prev?.id === locker.id ? { ...prev, status: newStatus } : prev);
      show(`Locker status updated to ${newStatus}`, 'success');
    } catch (ex) {
      show(ex.response?.data?.message || 'Failed to update locker status', 'error');
    }
  }

  const openEditModal = (locker) => {
    setEditL({
      id: locker.id,
      lockerNumber: locker.lockerNumber,
      floor: locker.floor,
      size: locker.size,
      price: locker.price,
      branchId: locker.branchId || locker.branch?.id || 1
    });
    setShowEditModal(true);
  }

  const saveLockerEdit = async () => {
    if (!editL.lockerNumber || !editL.price) { show('Locker number and price required', 'error'); return }
    try {
      await api.put(`/admin/lockers/${editL.id}`, { ...editL, price: parseFloat(editL.price) });
      setLockers(prev => prev.map(l => l.id === editL.id ? { ...l, lockerNumber: editL.lockerNumber, floor: editL.floor, size: editL.size, price: parseFloat(editL.price) } : l));
      setSel(prev => prev?.id === editL.id ? { ...prev, lockerNumber: editL.lockerNumber, floor: editL.floor, size: editL.size, price: parseFloat(editL.price) } : prev);
      setShowEditModal(false);
      show('Locker updated successfully', 'success');
    } catch (ex) {
      show(ex.response?.data?.message || 'Failed to update locker', 'error');
    }
  }

  const filtered = lockers.filter(l => {
    const matchesStatus = filter === 'ALL' || l.status === filter;
    const lockerBranchId = l.branchId || l.branch?.id;
    const matchesBranch = branchFilter === 'ALL' || String(lockerBranchId) === String(branchFilter);
    return matchesStatus && matchesBranch;
  })
  const floors = [...new Set(filtered.map(l=>l.floor))].sort()

  const branchLockers = lockers.filter(l => {
    const lockerBranchId = l.branchId || l.branch?.id;
    return branchFilter === 'ALL' || String(lockerBranchId) === String(branchFilter);
  })

  return (
    <SidebarLayout>
      <div className="p-7">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-xl font-bold text-slate-900">Locker Management</h1><p className="text-sm text-slate-500 mt-1">View and manage branch locker inventory</p></div>
          <button onClick={()=>setShowModal(true)} className="btn-primary flex items-center gap-2"><i className="ti ti-plus"/>Add Locker</button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-5">
          {[['Total',branchLockers.length,'#1e293b'],['Available',branchLockers.filter(l=>l.status==='AVAILABLE').length,'#10b981'],['Occupied',branchLockers.filter(l=>l.status==='OCCUPIED').length,'var(--color-primary)'],['Reserved',branchLockers.filter(l=>l.status==='RESERVED').length,'#3b82f6']].map(([l,v,c])=>(
            <div key={l} className="card p-4"><p className="text-2xl font-bold" style={{color:c}}>{v}</p><p className="text-xs text-slate-400 mt-1">{l}</p></div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-2">
            {['ALL','AVAILABLE','OCCUPIED','RESERVED','SUSPENDED'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter===f?'bg-primary text-white border-primary':'bg-white text-slate-600 border-slate-200'}`}>
                {f==='ALL'?'All':f.charAt(0)+f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-xs text-slate-400 font-semibold uppercase">Branch:</span>
            <select 
              value={branchFilter} 
              onChange={e => setBranchFilter(e.target.value)} 
              className="text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
            >
              <option value="ALL">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.bankName} - {b.branchName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-5">
            {floors.map(fl => {
              const items = filtered.filter(l=>l.floor===fl)
              if (!items.length) return null
              return (
                <div key={fl}>
                  <div className="flex items-center gap-3 mb-3"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Floor {fl} — {FLOORS[fl]}</span><div className="flex-1 h-px bg-slate-100"/><span className="text-xs text-slate-300">{items.filter(l=>l.status==='AVAILABLE').length} available</span></div>
                  <div className="grid grid-cols-5 gap-3">
                    {items.map(l => {
                      const cfg = STATUS_CFG[l.status]
                      const isSelected = sel?.id===l.id
                      return (
                        <div key={l.id} onClick={()=>setSel(isSelected?null:l)}
                          className={`rounded-2xl p-3.5 text-center cursor-pointer border-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected?'border-primary shadow-lg shadow-orange-100 bg-orange-50':cfg}`}>
                          <i className={`ti ${STATUS_ICON[l.status]} text-2xl block mb-1 ${isSelected?'text-primary':''}`}/>
                          <p className="text-xs font-bold text-slate-800">{l.lockerNumber}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{l.size.charAt(0)+l.size.slice(1).toLowerCase()}</p>
                          {branchFilter === 'ALL' && (
                            <p className="text-[9px] text-slate-500 font-semibold truncate mt-0.5" title={l.branch?.branchName}>{l.branch?.branchName || 'Vasind Branch'}</p>
                          )}
                          <p className="text-xs font-semibold text-primary mt-1">₹{l.price.toLocaleString()}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card p-5">
            {!sel ? (
              <div className="text-center py-10 text-slate-300"><i className="ti ti-lock text-5xl block mb-2"/><p className="text-sm">Click a locker to view details</p></div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-50">
                  <h3 className="font-bold text-slate-900">Locker {sel.lockerNumber}</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_CFG[sel.status]}`}>{sel.status}</span>
                </div>
                <div className="space-y-3 mb-5">
                  {[['Size',sel.size.charAt(0)+sel.size.slice(1).toLowerCase()],['Floor',`Floor ${sel.floor}`],['Annual Rent',`₹${sel.price.toLocaleString()}`],['Branch',sel.branch?.branchName||'—']].map(([k,v])=>(
                    <div key={k} className="flex justify-between py-1 border-b border-slate-50 last:border-none">
                      <span className="text-xs text-slate-400">{k}</span>
                      <span className="text-xs font-semibold text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <button onClick={() => openEditModal(sel)} className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><i className="ti ti-edit"/>Edit locker</button>
                  {sel.status === 'AVAILABLE' && (
                    <button onClick={() => toggleLockerSuspension(sel)} className="w-full py-2 rounded-xl border border-red-200 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 font-semibold">
                      <i className="ti ti-ban"/>Suspend locker
                    </button>
                  )}
                  {sel.status === 'SUSPENDED' && (
                    <button onClick={() => toggleLockerSuspension(sel)} className="w-full py-2 rounded-xl border border-emerald-200 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5 font-semibold">
                      <i className="ti ti-check"/>Unsuspend locker
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">Add New Locker</h3>
              <button onClick={()=>setShowModal(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><i className="ti ti-x text-sm"/></button>
            </div>
            <div className="space-y-3 mb-5">
              <div><label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Locker Number</label>
                <input value={newL.lockerNumber} onChange={e=>setNewL({...newL,lockerNumber:e.target.value})} placeholder="e.g. E-501" className="input-field"/></div>
              <div><label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Annual Price (₹)</label>
                <input type="number" value={newL.price} onChange={e=>setNewL({...newL,price:e.target.value})} placeholder="e.g. 5000" className="input-field"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Floor</label>
                  <select value={newL.floor} onChange={e=>setNewL({...newL,floor:e.target.value})} className="input-field">
                    {['A','B','C','D','E'].map(f=><option key={f}>{f}</option>)}</select></div>
                <div><label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Size</label>
                  <select value={newL.size} onChange={e=>setNewL({...newL,size:e.target.value})} className="input-field">
                    {['SMALL','MEDIUM','LARGE','XLARGE'].map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={addLocker} disabled={adding} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {adding?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Adding...</span></>:<><i className="ti ti-plus"/><span>Add Locker</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Locker Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">Edit Locker Details</h3>
              <button onClick={() => setShowEditModal(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><i className="ti ti-x text-sm"/></button>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Locker Number</label>
                <input value={editL.lockerNumber} onChange={e => setEditL({ ...editL, lockerNumber: e.target.value })} placeholder="e.g. E-501" className="input-field"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Annual Price (₹)</label>
                <input type="number" value={editL.price} onChange={e => setEditL({ ...editL, price: e.target.value })} placeholder="e.g. 5000" className="input-field"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Floor</label>
                  <select value={editL.floor} onChange={e => setEditL({ ...editL, floor: e.target.value })} className="input-field">
                    {['A', 'B', 'C', 'D', 'E'].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Size</label>
                  <select value={editL.size} onChange={e => setEditL({ ...editL, size: e.target.value })} className="input-field">
                    {['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveLockerEdit} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <i className="ti ti-circle-check"/><span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
