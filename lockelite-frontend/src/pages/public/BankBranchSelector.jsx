import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

const BANKS = [
  { id:'LOCKELITE', name:'LockElite',            shortName:'LE',   color:'#F68222', sidebar:'#0f172a', icon:'🔐', desc:'Our flagship locker platform'    },
  { id:'SBI',       name:'State Bank of India',  shortName:'SBI',  color:'#2D6BB5', sidebar:'#1A3A6B', icon:'🏦', desc:"India's largest public bank"     },
  { id:'HDFC',      name:'HDFC Bank',            shortName:'HDFC', color:'#004C8F', sidebar:'#002D5A', icon:'🏛️', desc:"India's largest private bank"   },
  { id:'ICICI',     name:'ICICI Bank',           shortName:'ICICI',color:'#F58220', sidebar:'#002D72', icon:'🏢', desc:'Leading private sector bank'     },
  { id:'AXIS',      name:'Axis Bank',            shortName:'AXIS', color:'#97144D', sidebar:'#5C0D30', icon:'🏗️', desc:'New-age private bank'            },
  { id:'KOTAK',     name:'Kotak Mahindra Bank',  shortName:'KMB',  color:'#EF3E23', sidebar:'#8B0000', icon:'🏦', desc:'Smart banking solutions'         },
]

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function BankBranchSelector() {
  const [bank,      setBank]    = useState(null)
  const [branches,  setBranches]= useState([])
  const [selBranch, setSelBr]   = useState(null)
  const [coords,    setCoords]  = useState(null)
  const [cityName,  setCity]    = useState('')
  const [locating,  setLocating]= useState(false)
  const [loading,   setLoading] = useState(false)
  const [confirming,setConf]    = useState(false)
  const [searchQ,   setSearchQ] = useState('')
  const [step,      setStep]    = useState(1)   // 1=bank, 2=branch, 3=confirm
  const [radius,    setRadius]  = useState(25000)
  const { show } = useToast()
  const navigate = useNavigate()

  const fallbackIpLoc = (onSuccess, onError) => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        if (data.latitude && data.longitude) {
          const lat = parseFloat(data.latitude)
          const lng = parseFloat(data.longitude)
          setCoords({ lat, lng })
          reverseGeocode(lat, lng)
          if (onSuccess) onSuccess(lat, lng)
        } else {
          if (onError) onError()
        }
      })
      .catch(() => {
        if (onError) onError()
      })
  }

  // ── Auto-detect location on mount ──────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      fallbackIpLoc()
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        reverseGeocode(lat, lng)
      },
      () => {
        fallbackIpLoc()
      }
    )
  }, [])

  const reverseGeocode = (lat, lng) => {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12`, {
      headers: { 'User-Agent': 'LockEliteApp/1.0 (contact@lockelite.com)' }
    })
    .then(r => r.json())
    .then(d => {
      const addr = d.address || {}
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || ''
      const state = addr.state || ''
      setCity(city ? `${city}, ${state}` : state)
    })
    .catch(() => {})
  }

  // ── Fetch branches from backend (which calls Overpass) ─────────
  const fetchBranches = useCallback(async (b, lat, lng, rad = radius) => {
    const searchLat = lat ?? coords?.lat ?? 19.2183
    const searchLng = lng ?? coords?.lng ?? 72.9781

    setLoading(true); setBranches([]); setSelBr(null); setSearchQ('')
    try {
      const res = await api.get('/branches/public', {
        params: {
          bankName:      b.id,
          latitude:      searchLat,
          longitude:     searchLng,
          radiusMeters:  rad,
        }
      })
      const data = res.data || []
      // Re-sort client-side with user's exact coords in case coords updated
      const sorted = data
         .map(br => ({
           ...br,
           distanceKm: parseFloat(
             haversine(searchLat, searchLng, parseFloat(br.latitude), parseFloat(br.longitude)).toFixed(1)
           )
         }))
         .sort((a, z) => a.distanceKm - z.distanceKm)
      setBranches(sorted)
      if (sorted.length === 0) show(`No ${b.name} branches found within ${rad/1000} km — try expanding radius`, 'warning')
    } catch (err) {
      show('Could not load branches. Check your connection.', 'error')
    } finally { setLoading(false) }
  }, [coords, radius])

  // ── Locate me button ───────────────────────────────────────────
  const locateMe = () => {
    setLocating(true)
    const successCallback = (lat, lng) => {
      setLocating(false)
      show('📍 Location detected!', 'success')
      if (bank) fetchBranches(bank, lat, lng)
    }
    const errorCallback = () => {
      setLocating(false)
      show('Location access denied — using default area', 'warning')
      if (bank) fetchBranches(bank, 19.2183, 72.9781)
    }

    if (!navigator.geolocation) {
      fallbackIpLoc(successCallback, errorCallback)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        reverseGeocode(lat, lng)
        successCallback(lat, lng)
      },
      () => {
        fallbackIpLoc(successCallback, errorCallback)
      }
    )
  }

  const pickBank = (b) => {
    setBank(b); setStep(2)
    fetchBranches(b, coords?.lat, coords?.lng)
  }

  const pickBranch = (br) => {
    setSelBr(br); setStep(3)
  }

  const expandRadius = () => {
    const newRad = radius + 15000
    setRadius(newRad)
    if (bank) fetchBranches(bank, coords?.lat, coords?.lng, newRad)
  }

  const confirm = async () => {
    if (!selBranch) return
    setConf(true)
    try {
      const res = await api.post('/customer/select-branch', {
        branchId:   selBranch.id,
        bankId:     bank.id,
        branchName: selBranch.branchName,
        address:    selBranch.address,
        latitude:   selBranch.latitude,
        longitude:  selBranch.longitude,
        bankName:   bank.name,
      })
      // Store branchId so login redirect doesn't loop back to select-bank
      localStorage.setItem('le_branch_id', String(selBranch.id))
    } catch { /* backend saves what it can */ }
    show(`✅ Branch confirmed: ${selBranch.branchName}`, 'success')
    navigate('/customer/dashboard')
    setConf(false)
  }

  // Filter branches by search
  const filtered = branches.filter(br =>
    !searchQ.trim() ||
    br.branchName?.toLowerCase().includes(searchQ.toLowerCase()) ||
    br.address?.toLowerCase().includes(searchQ.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{ background:'#f1f5f9' }}>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div className="bg-slate-950 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F68222] flex items-center justify-center text-white font-bold text-sm">LE</div>
          <span className="text-white font-bold tracking-widest text-sm">LOCKELITE</span>
        </div>
        <div className="flex items-center gap-4">
          {coords && (
            <div className="flex items-center gap-1.5 text-white/50 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              <span>{cityName || `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`}</span>
            </div>
          )}
          <div className="text-white/30 text-xs">Account Setup · Step {step}/3</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Step indicator ───────────────────────────────────────── */}
        <div className="flex items-center gap-0 mb-8 bg-white rounded-2xl border border-slate-100 p-1.5 w-fit">
          {[['Choose bank','ti-building-bank'], ['Select branch','ti-map-pin'], ['Confirm','ti-circle-check']].map(([label, icon], i) => {
            const active = step === i+1
            const done   = step > i+1
            return (
              <div key={i} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active ? 'text-white' : done ? 'text-emerald-600' : 'text-slate-400'
                }`} style={active ? { background:'var(--color-primary,#F68222)' } : {}}>
                  <i className={`ti ${done ? 'ti-check' : icon} text-sm`}/>
                  {label}
                </div>
                {i < 2 && <i className="ti ti-chevron-right text-slate-300 text-xs mx-1"/>}
              </div>
            )
          })}
        </div>

        {/* ══ STEP 1 — Choose bank ══════════════════════════════════ */}
        {step >= 1 && (
          <div className={step===1 ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-lg font-bold text-slate-900">Which bank manages your locker?</h1>
                <p className="text-xs text-slate-500 mt-0.5">Select the bank — we'll find real branches near you using live map data</p>
              </div>
              {step > 1 && (
                <button onClick={() => { setStep(1); setBank(null); setBranches([]); setSelBr(null) }}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100">
                  <i className="ti ti-edit text-xs"/>Change bank
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {BANKS.map(b => (
                <button key={b.id} onClick={() => pickBank(b)}
                  className={`p-4 rounded-2xl border-2 text-left bg-white transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                    bank?.id === b.id ? 'border-2 shadow-lg' : 'border-slate-100 hover:border-slate-200'
                  }`}
                  style={bank?.id===b.id ? { borderColor: b.color } : {}}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black"
                      style={{ background: b.color }}>{b.shortName.substring(0,2)}</div>
                    {bank?.id===b.id && <i className="ti ti-circle-check-filled ml-auto text-lg" style={{color:b.color}}/>}
                  </div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">{b.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{b.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ STEP 2 — Select branch ════════════════════════════════ */}
        {bank && step >= 2 && (
          <div className={`animate-fade-in ${step===2 ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{bank.name} branches near you</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live data via OpenStreetMap · Within {radius/1000} km
                  {coords && cityName && ` · ${cityName}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Expand radius button */}
                {!loading && branches.length < 5 && (
                  <button onClick={expandRadius}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    <i className="ti ti-arrows-maximize text-xs"/>Expand to {(radius+15000)/1000}km
                  </button>
                )}
                {/* Locate me */}
                <button onClick={locateMe} disabled={locating}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: bank.color }}>
                  <i className={`ti ${locating ? 'ti-loader-2 animate-spin' : coords ? 'ti-map-pin-check' : 'ti-map-pin'} text-sm`}/>
                  {locating ? 'Detecting...' : coords ? 'Location active' : 'Use my location'}
                </button>
              </div>
            </div>

            {/* Search box */}
            {branches.length > 3 && (
              <div className="relative mb-3">
                <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"/>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder={`Search ${bank.name} branches...`}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{'--tw-ring-color': bank.color}}/>
              </div>
            )}

            {/* Branch list */}
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: bank.color, borderTopColor:'transparent' }}/>
                <p className="text-sm font-semibold text-slate-700 mb-1">Searching live map data…</p>
                <p className="text-xs text-slate-400">Querying OpenStreetMap for {bank.name} branches near you</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  {searchQ ? `No branches matching "${searchQ}"` : `No ${bank.name} branches found within ${radius/1000} km`}
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  {searchQ ? 'Try a different search term.' : 'Try expanding the search radius or using your exact location.'}
                </p>
                {!searchQ && (
                  <button onClick={expandRadius}
                    className="px-4 py-2 rounded-xl text-sm text-white font-semibold"
                    style={{ background: bank.color }}>
                    Expand to {(radius+15000)/1000} km
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 mb-5">
                {/* Found count */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-slate-500">
                    <strong className="text-slate-800">{filtered.length}</strong> branch{filtered.length!==1?'es':''} found
                    {coords ? ' · Sorted by distance' : ''}
                  </p>
                  {selBranch && step===2 && (
                    <p className="text-xs font-semibold" style={{color:bank.color}}>
                      <i className="ti ti-check mr-1"/>Selected: {selBranch.branchName}
                    </p>
                  )}
                </div>

                {filtered.map(br => {
                  const isSel = selBranch?.id === br.id
                  return (
                    <div key={br.id} onClick={() => pickBranch(br)}
                      className={`bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md flex items-center justify-between ${
                        isSel ? 'shadow-md' : 'border-slate-100 hover:border-slate-200'
                      }`}
                      style={isSel ? { borderColor: bank.color, background: `${bank.color}08` } : {}}>

                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Bank logo dot */}
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                          style={{ background: bank.color }}>
                          {bank.shortName.substring(0,3)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{br.branchName}</p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                            <i className="ti ti-map-pin text-xs flex-shrink-0"/>
                            <span className="truncate">{br.address}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                              {br.available} lockers available
                            </span>
                            <span className="text-[10px] text-slate-400">{br.lockers} total</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-4 text-right">
                        {br.distanceKm != null && (
                          <p className="text-lg font-black" style={{ color: bank.color }}>{br.distanceKm} km</p>
                        )}
                        {br.distanceKm != null && <p className="text-[10px] text-slate-400">from you</p>}
                        {isSel && (
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <i className="ti ti-circle-check-filled text-base" style={{color:bank.color}}/>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {step > 2 && (
              <button onClick={() => { setStep(2); setSelBr(null) }}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 mb-4">
                <i className="ti ti-arrow-left text-xs"/>Change branch
              </button>
            )}
          </div>
        )}

        {/* ══ STEP 3 — Confirm ══════════════════════════════════════ */}
        {selBranch && step === 3 && (
          <div className="mt-4 bg-white rounded-3xl border border-slate-100 p-6 animate-fade-in shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ti ti-circle-check text-emerald-500"/>Confirm your branch
            </h3>

            {/* Summary card */}
            <div className="rounded-2xl p-4 mb-5 border" style={{ background:`${bank?.color}0a`, borderColor:`${bank?.color}33` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm"
                  style={{ background: bank?.color }}>{bank?.shortName?.substring(0,3)}</div>
                <div>
                  <p className="font-bold text-slate-900">{selBranch.branchName}</p>
                  <p className="text-xs text-slate-500">{bank?.name}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {[
                  ['📍 Address', selBranch.address],
                  ['📏 Distance', selBranch.distanceKm != null ? `${selBranch.distanceKm} km from you` : 'N/A'],
                  ['🔐 Lockers available', `${selBranch.available} of ${selBranch.lockers}`],
                ].map(([l, v]) => (
                  <div key={l} className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500 flex-shrink-0">{l}</span>
                    <span className="text-xs font-semibold text-slate-800 text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep(2); setSelBr(null) }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-semibold">
                ← Change branch
              </button>
              <button onClick={confirm} disabled={confirming}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: bank?.color }}>
                {confirming
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Confirming…</span></>
                  : <><i className="ti ti-check"/><span>Confirm this branch</span></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
