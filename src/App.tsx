import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Calendar from './pages/Calendar'
import Bookings from './pages/Bookings'
import AvailabilitySlots from './pages/AvailabilitySlots'
import RequestBooking from './pages/RequestBooking'
import Stats from './pages/Stats'
import ProtectedRoute from './components/ProtectedRoute'

/**
 * Redirects authenticated users to the correct landing page based on role.
 * Priests go to /calendar, parishioners go to /request-booking.
 * Must be rendered inside AuthProvider.
 */
function HomeRedirect() {
  const { user, userProfile, loading, isPriest } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f7fa]">
        <div className="w-9 h-9 border-[3px] border-rose-100 border-t-rose-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Wait for profile to resolve before deciding destination
  if (!userProfile) return null

  return <Navigate to={isPriest ? '/calendar' : '/request-booking'} replace />
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* PRIEST-only: pastoral calendar */}
          <Route
            path="/calendar"
            element={
              <ProtectedRoute requiredRole="PRIEST">
                <Calendar />
              </ProtectedRoute>
            }
          />

          {/* PRIEST-only: manage availability slots */}
          <Route
            path="/availability"
            element={
              <ProtectedRoute requiredRole="PRIEST">
                <AvailabilitySlots />
              </ProtectedRoute>
            }
          />

          {/* PRIEST-only: statistics page */}
          <Route
            path="/stats"
            element={
              <ProtectedRoute requiredRole="PRIEST">
                <Stats />
              </ProtectedRoute>
            }
          />

          {/* Shared: bookings list (priest sees all, parishioner sees own) */}
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <Bookings />
              </ProtectedRoute>
            }
          />

          {/* Parishioner: request a pastoral meeting */}
          <Route
            path="/request-booking"
            element={
              <ProtectedRoute>
                <RequestBooking />
              </ProtectedRoute>
            }
          />

          {/* Root: role-aware redirect */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
