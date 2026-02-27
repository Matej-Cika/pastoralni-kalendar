import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../lib/supabase'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, userProfile, loading, authError } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f7fa]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-[15px] font-medium text-slate-500 tracking-wide">Učitavanje…</p>
        </div>
      </div>
    )
  }

  if (authError && !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f7fa]">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Greška autentikacije</h2>
          <p className="text-slate-500 text-sm mb-6">{authError}</p>
          <button
            onClick={() => window.location.replace('/login')}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Povratak na prijavu
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f7fa]">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-8 max-w-md text-center">
          <div className="text-amber-500 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Profil nije pronađen</h2>
          <p className="text-slate-500 text-sm mb-6">
            Korisnički profil nije moguće učitati. Molimo kontaktirajte administratora ili se odjavite i prijavite ponovo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Pokušaj ponovo
          </button>
        </div>
      </div>
    )
  }

  if (requiredRole && userProfile.role !== requiredRole) {
    // Redirect to the appropriate landing for this user's role
    const fallback = userProfile.role === 'PRIEST' ? '/calendar' : '/request-booking'
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}
