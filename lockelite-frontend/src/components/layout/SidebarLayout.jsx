import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useState } from 'react'

const NAV = {
  CUSTOMER: [
    { to:'/customer/dashboard', icon:'ti-layout-dashboard', label:'Dashboard'       },
    { to:'/customer/kyc',       icon:'ti-file-check',       label:'My KYC'          },
    { to:'/customer/lockers',   icon:'ti-building-bank',    label:'Explore Lockers' },
    { to:'/customer/bookings',  icon:'ti-calendar',         label:'My Bookings'     },
  ],
  EMPLOYEE: [
    { to:'/employee/dashboard',    icon:'ti-layout-dashboard', label:'Dashboard'    },
    { to:'/employee/kyc-review',   icon:'ti-file-check',       label:'KYC Review'  },
    { to:'/employee/allocations',  icon:'ti-lock',             label:'Allocations' },
    { to:'/employee/appointments', icon:'ti-calendar-event',   label:'Appointments'},
  ],
  ADMIN: [
    { to:'/admin/dashboard',  icon:'ti-layout-dashboard', label:'Dashboard'  },
    { to:'/admin/employees',  icon:'ti-users',            label:'Employees'  },
    { to:'/admin/lockers',    icon:'ti-lock',             label:'Lockers'    },
    { to:'/admin/audit-logs', icon:'ti-shield-check',     label:'Audit Logs' },
    { to:'/admin/reports',    icon:'ti-chart-bar',        label:'Reports'    },
  ]
}

// Role badge colours
const ROLE_BADGE = {
  EMPLOYEE: 'bg-emerald-500/20 text-emerald-300',
  ADMIN:    'bg-amber-500/20 text-amber-300',
  CUSTOMER: 'bg-blue-500/20 text-blue-300',
}

export default function SidebarLayout({ children }) {
  const { user, logout } = useAuth()
  const { theme }        = useTheme()
  const navigate         = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const nav = NAV[user?.role] || []

  const handleLogout = () => { logout(); navigate('/') }

  const layout = theme.layout || 'sidebar'
  const isTopNav = layout === 'top-nav'
  const isTabNav = layout === 'tab-nav'
  const isHeaderNav = isTopNav || isTabNav
  const isIconSidebar = layout === 'icon-sidebar'
  const isPanel = layout === 'panel'

  const actualCollapsed = isIconSidebar ? true : collapsed

  if (isHeaderNav) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', transition: 'background 0.35s ease' }}>
        {/* ─── Top Navbar ─────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/10 text-white z-30 shadow-md" style={{ background: theme.sidebar }}>
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0 shadow-lg"
              style={{ background: theme.primary }}>
              {theme.logo || 'LE'}
            </div>
            <div>
              <div className="text-white font-bold text-xs tracking-widest uppercase">
                {theme.logo === 'LE' ? 'LOCKELITE' : theme.logo}
              </div>
              <div className="text-white/40 text-[9px]">{theme.name}</div>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="flex items-center gap-1">
            {nav.map(n => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 text-xs transition-all duration-200
                  ${isActive ? 'text-white font-semibold' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`
                }
                style={({ isActive }) => isActive ? (isTabNav ? { borderBottom: `3px solid ${theme.primary}`, borderRadius: '0px', background: 'transparent' } : { background: theme.primary, borderRadius: '0.75rem' }) : {}}
              >
                <i className={`ti ${n.icon} text-sm`}/>
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User profile & controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ background: theme.primary }}>
                {user?.fullName?.charAt(0) || '?'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-white/85 text-[10px] font-semibold truncate leading-none">{user?.fullName?.split(' ')[0]}</div>
                <span className={`text-[8px] font-semibold uppercase tracking-wider ${ROLE_BADGE[user?.role] || ''}`} style={{ fontSize: '7.5px' }}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button onClick={handleLogout} className="text-white/45 hover:text-red-400 text-xs flex items-center gap-1 transition-colors">
              <i className="ti ti-logout text-sm"/>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* ─── Main Content ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-auto min-w-0">
          <div className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between border-b border-black/5 backdrop-blur-sm"
            style={{ background: `${theme.bg}ee` }}>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} 
                className="mr-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all shadow-sm">
                <i className="ti ti-arrow-left text-xs"/>
                Back
              </button>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: theme.primary }}/>
              <span className="text-sm font-semibold text-slate-700">{theme.name} Portal</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">Locker Administration Platform</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                <span>System live</span>
              </div>
              <span className="text-slate-300">|</span>
              <span>{new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}</span>
            </div>
          </div>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)', transition: 'background 0.35s ease' }}>

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`flex-shrink-0 flex flex-col transition-all duration-300 relative 
          ${isPanel ? 'm-3 rounded-2xl shadow-lg border border-white/5' : ''} 
          ${actualCollapsed ? 'w-16' : 'w-60'}`}
        style={{ background: theme.sidebar }}>

        {/* ── Bank branding header ────────────────────────────────── */}
        <div className={`border-b border-white/10 transition-all ${actualCollapsed ? 'px-2 py-4' : 'px-4 py-4'}`}>
          <div className={`flex items-center gap-3 ${actualCollapsed ? 'justify-center' : ''}`}>
            {/* Bank logo badge */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0 shadow-lg"
              style={{ background: theme.primary }}>
              {theme.logo || 'LE'}
            </div>

            {/* Bank name + platform name */}
            {!actualCollapsed && (
              <div className="min-w-0">
                <div className="text-white font-bold text-xs tracking-widest truncate uppercase">
                  {theme.logo === 'LE' ? 'LOCKELITE' : theme.logo}
                </div>
                <div className="text-white/40 text-[10px] truncate">{theme.name}</div>
              </div>
            )}
          </div>

          {/* Thin color stripe under logo — bank colour accent */}
          {!actualCollapsed && (
            <div className="mt-3 h-0.5 rounded-full opacity-40" style={{ background: theme.primary }}/>
          )}
        </div>

        {/* ── Bank theme pill (visible when expanded) ─────────────── */}
        {!actualCollapsed && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: `${theme.primary}22` }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: theme.primary }}/>
              <span className="text-[10px] font-semibold truncate" style={{ color: theme.primary }}>
                {theme.name} Portal
              </span>
            </div>
          </div>
        )}

        {/* ── Navigation links ────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group
                ${isActive ? 'text-white font-semibold shadow-sm' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}
                ${actualCollapsed ? 'justify-center px-2' : ''}`
              }
              style={({ isActive }) => isActive ? { background: theme.primary } : {}}
              title={actualCollapsed ? n.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <i className={`ti ${n.icon} text-base flex-shrink-0 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}/>
                  {!actualCollapsed && <span>{n.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── User profile + controls ─────────────────────────────── */}
        <div className="px-2 py-3 border-t border-white/10 space-y-1">
          {/* User card */}
          {!actualCollapsed && (
            <div className="px-3 py-2.5 rounded-xl mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {/* Avatar circle */}
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: theme.primary }}>
                  {user?.fullName?.charAt(0) || '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-white/85 text-xs font-semibold truncate">{user?.fullName}</div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[user?.role] || ''}`}>
                    {user?.role}
                  </span>
                </div>
              </div>
              <div className="text-white/30 text-[10px] truncate pl-0.5">{user?.email}</div>
            </div>
          )}

          {/* Collapse toggle (hidden on icon-sidebar) */}
          {!isIconSidebar && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 w-full transition-all ${actualCollapsed ? 'justify-center' : ''}`}
              title={actualCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <i className={`ti ${actualCollapsed ? 'ti-chevrons-right' : 'ti-chevrons-left'} text-base`}/>
              {!actualCollapsed && <span className="text-xs">Collapse</span>}
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-white/5 w-full transition-all ${actualCollapsed ? 'justify-center' : ''}`}
            title={actualCollapsed ? 'Sign out' : undefined}>
            <i className="ti ti-logout text-base"/>
            {!actualCollapsed && <span className="text-xs">Sign out</span>}
          </button>
        </div>

        {/* ── Thin colored left/right border accent on sidebar ──────────── */}
        {!isPanel && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 opacity-60" style={{ background: theme.primary }}/>
        )}
      </aside>

      {/* ─── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Top header bar with bank branding */}
        <div className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between border-b border-black/5 backdrop-blur-sm"
          style={{ background: `${theme.bg}ee` }}>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} 
              className="mr-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all shadow-sm">
              <i className="ti ti-arrow-left text-xs"/>
              Back
            </button>
            {/* Bank colour dot */}
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: theme.primary }}/>
            <span className="text-sm font-semibold text-slate-700">{theme.name}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500">Locker Administration Platform</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              <span>System live</span>
            </div>
            <span className="text-slate-300">|</span>
            <span>{new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}</span>
          </div>
        </div>

        {children}
      </main>
    </div>
  )
}
