import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ role }) {
  const { user, loading, redirectPath } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg" style={{ background: 'var(--color-primary)' }}>LE</div>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}/>
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace/>

  // Cross-role block — already logged in as different role
  if (user.role !== role) {
    return <Navigate to={redirectPath(user.role)} replace/>
  }

  // Employee must change password on first login
  if (user.role === 'EMPLOYEE' && user.passwordChanged === false) {
    return <Navigate to="/change-password" replace/>
  }

  return <Outlet/>
}
