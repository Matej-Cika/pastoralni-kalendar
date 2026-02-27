import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, userProfile, isPriest, signInWithGoogle, loading } = useAuth()
  const navigate = useNavigate()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect after login based on role — wait for both user AND profile to be ready
  useEffect(() => {
    if (user && userProfile && !loading) {
      navigate(isPriest ? '/calendar' : '/request-booking', { replace: true })
    }
  }, [user, userProfile, isPriest, loading, navigate])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f7fa]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-rose-100 border-t-rose-600 rounded-full animate-spin" />
          <p className="text-[15px] font-medium text-slate-500 tracking-wide">Učitavanje…</p>
        </div>
      </div>
    )
  }

  async function handleSignIn() {
    try {
      setError(null)
      setSigningIn(true)
      await signInWithGoogle()
    } catch {
      setError('Prijava nije uspjela. Molimo pokušajte ponovo.')
      setSigningIn(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7fa] px-4">
      <div className="w-full max-w-[420px]">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-slate-200/60 px-10 py-10">

          {/* Parish identity */}
          <div className="text-center mb-9">

            {/* Parish seal */}
            <div className="flex justify-center mb-5">
              <img
                src="/logo-zupa.png"
                alt="Župa Presvetog Srca Isusovog"
                className="w-24 h-24 rounded-full object-contain drop-shadow-sm"
              />
            </div>

            <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight leading-snug mb-1.5">
              Pastoralni kalendar
            </h1>
            <p className="text-[14px] font-medium text-rose-800/80 leading-snug mb-1">
              Župa Presvetog Srca Isusovog
            </p>
            <p className="text-[12px] text-slate-400 tracking-wide">
              Visoka · Split
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100 mb-7" />

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
              {error}
            </div>
          )}

          {/* Sign in */}
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-[14px] font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {signingIn ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span>Prijava u tijeku…</span>
              </>
            ) : (
              <>
                {/* Google "G" logo */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Prijava putem Google računa</span>
              </>
            )}
          </button>

          <p className="text-[12px] text-slate-400 text-center mt-5 leading-relaxed">
            Prijavi se putem Google računa i pristupi pastoralnom kalendaru.
          </p>
        </div>

        <p className="text-center text-[11.5px] text-slate-400 mt-5 leading-relaxed">
          © {new Date().getFullYear()} Župa Presvetog Srca Isusovog, Visoka · Split
        </p>
      </div>
    </div>
  )
}
