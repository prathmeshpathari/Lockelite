import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/common/ProtectedRoute'

// Public
import LandingPage        from './pages/public/LandingPage'
import LoginPage          from './pages/public/LoginPage'
import RegisterPage       from './pages/public/RegisterPage'
import OtpVerifyPage      from './pages/public/OtpVerifyPage'
import ForgotPassword     from './pages/public/ForgotPassword'
import ResetPassword      from './pages/public/ResetPassword'
import ChangePassword     from './pages/public/ChangePassword'
import BankBranchSelector from './pages/public/BankBranchSelector'

// Customer
import CustomerDashboard  from './pages/customer/Dashboard'
import CustomerKYC        from './pages/customer/KYCForm'
import ExploreLockers     from './pages/customer/ExploreLockers'
import MyBookings         from './pages/customer/MyBookings'

// Employee
import EmployeeDashboard  from './pages/employee/Dashboard'
import KYCReview          from './pages/employee/KYCReview'
import Allocations        from './pages/employee/Allocations'
import Appointments       from './pages/employee/Appointments'

// Admin
import AdminDashboard     from './pages/admin/Dashboard'
import Employees          from './pages/admin/Employees'
import LockersAdmin       from './pages/admin/Lockers'
import AuditLogs          from './pages/admin/AuditLogs'
import Reports            from './pages/admin/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/"                element={<LandingPage/>}/>
              <Route path="/login"           element={<LoginPage/>}/>
              <Route path="/register"        element={<RegisterPage/>}/>
              <Route path="/verify-otp"      element={<OtpVerifyPage/>}/>
              <Route path="/forgot-password" element={<ForgotPassword/>}/>
              <Route path="/reset-password"  element={<ResetPassword/>}/>
              <Route path="/change-password" element={<ChangePassword/>}/>
              <Route path="/select-bank"     element={<BankBranchSelector/>}/>

              {/* Customer */}
              <Route path="/customer" element={<ProtectedRoute role="CUSTOMER"/>}>
                <Route path="dashboard" element={<CustomerDashboard/>}/>
                <Route path="kyc"       element={<CustomerKYC/>}/>
                <Route path="lockers"   element={<ExploreLockers/>}/>
                <Route path="bookings"  element={<MyBookings/>}/>
              </Route>

              {/* Employee */}
              <Route path="/employee" element={<ProtectedRoute role="EMPLOYEE"/>}>
                <Route path="dashboard"    element={<EmployeeDashboard/>}/>
                <Route path="kyc-review"   element={<KYCReview/>}/>
                <Route path="allocations"  element={<Allocations/>}/>
                <Route path="appointments" element={<Appointments/>}/>
              </Route>

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute role="ADMIN"/>}>
                <Route path="dashboard"  element={<AdminDashboard/>}/>
                <Route path="employees"  element={<Employees/>}/>
                <Route path="lockers"    element={<LockersAdmin/>}/>
                <Route path="audit-logs" element={<AuditLogs/>}/>
                <Route path="reports"    element={<Reports/>}/>
              </Route>

              <Route path="*" element={<Navigate to="/" replace/>}/>
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
