import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

// Fallback themes (used only if JWT doesn't carry theme — shouldn't happen)
const FALLBACK = {
  LOCKELITE: { primary:'#F68222', sidebar:'#0f172a', bg:'#F5F0E8', accent:'#FFF0E0', name:'LockElite',           logo:'LE',   layout:'sidebar'      },
  SBI:       { primary:'#2D6BB5', sidebar:'#1A3A6B', bg:'#F0F4F8', accent:'#E6EEF8', name:'State Bank of India', logo:'SBI',  layout:'top-nav'      },
  HDFC:      { primary:'#004C8F', sidebar:'#002D5A', bg:'#EEF4FA', accent:'#E0EBF5', name:'HDFC Bank',           logo:'HDFC', layout:'panel'        },
  ICICI:     { primary:'#F58220', sidebar:'#002D72', bg:'#F5F5F5', accent:'#FFF0E0', name:'ICICI Bank',          logo:'ICICI',layout:'tab-nav'      },
  AXIS:      { primary:'#97144D', sidebar:'#5C0D30', bg:'#FDF5F8', accent:'#F9E8EF', name:'Axis Bank',           logo:'AXIS', layout:'icon-sidebar' },
  KOTAK:     { primary:'#EF3E23', sidebar:'#8B0000', bg:'#FFF5F5', accent:'#FFE8E8', name:'Kotak Mahindra Bank', logo:'KMB',  layout:'sidebar'      },
}

const DEFAULT_THEME = FALLBACK.LOCKELITE

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth()
  const [theme, setTheme] = useState(DEFAULT_THEME)

  useEffect(() => {
    let t

    if (user && user.role !== 'CUSTOMER') {
      // ── Priority 1: Theme comes directly from JWT claims ────────────
      // Backend embeds primaryColor, sidebarColor, etc. into the token.
      // This means each employee sees their bank's theme the moment they log in.
      if (user.primaryColor && user.sidebarColor) {
        t = {
          primary: user.primaryColor,
          sidebar: user.sidebarColor,
          bg:      user.bgColor      || '#F5F0E8',
          accent:  user.accentColor  || '#FFF0E0',
          name:    user.bankName     || 'LockElite',
          logo:    user.logoText     || 'LE',
          layout:  user.layout       || 'sidebar',
          code:    user.bankCode     || 'LOCKELITE',
        }
      }
      // ── Priority 2: Fall back to static map via bankCode ────────────
      else if (user.bankCode && FALLBACK[user.bankCode]) {
        t = FALLBACK[user.bankCode]
      }
      // ── Priority 3: Fall back via numeric bankId ────────────────────
      else {
        t = DEFAULT_THEME
      }
    } else {
      t = DEFAULT_THEME
    }

    // Apply to CSS variables so ALL components pick it up automatically
    document.documentElement.style.setProperty('--color-primary', t.primary)
    document.documentElement.style.setProperty('--color-sidebar', t.sidebar)
    document.documentElement.style.setProperty('--color-bg',      t.bg)
    document.documentElement.style.setProperty('--color-accent',  t.accent)

    // Smooth transition on theme switch
    document.documentElement.style.setProperty('--theme-transition', 'all 0.35s ease')

    setTheme(t)

    // Log for debugging
    console.log(`[Theme] Applied: ${t.name} | Primary: ${t.primary} | Sidebar: ${t.sidebar}`)
  }, [user])

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
