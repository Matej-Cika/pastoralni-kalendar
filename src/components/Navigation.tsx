import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Navigation() {
  const { userProfile, signOut, isPriest } = useAuth()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  const roleLabel = isPriest ? 'Svećenik' : 'Župljani'

  // ── Bookings badge (priest only) ────────────────────────────
  // Shows only PENDING booking requests — cancelled bookings require no action
  const [pendingCount, setPendingCount] = useState(0)

  async function fetchBadgeCounts() {
    if (!isPriest) return
    const { count: pending } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
    setPendingCount(pending ?? 0)
  }

  useEffect(() => {
    if (!isPriest) return
    fetchBadgeCounts()
    window.addEventListener('bookings-updated', fetchBadgeCounts)
    return () => window.removeEventListener('bookings-updated', fetchBadgeCounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPriest])

  return (
    <nav className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between h-[60px]">

          {/* ── Brand ── */}
          <div className="flex items-center gap-7">
            <div className="flex items-center gap-3">
              {/* Parish seal */}
              <img
                src="/logo-zupa.png"
                alt="Župa Presvetog Srca Isusovog"
                className="w-9 h-9 rounded-full object-contain shrink-0"
              />
              {/* Title block */}
              <div className="leading-none">
                <p className="text-[14px] font-semibold text-slate-900 tracking-tight leading-snug">
                  Pastoralni kalendar
                </p>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5 tracking-wide">
                  Župa Presvetog Srca Isusovog · Visoka, Split
                </p>
              </div>
            </div>

            {/* ── Nav links ── */}
            <div className="flex items-center gap-0.5">
              {/* Calendar — PRIEST only */}
              {isPriest && (
                <Link
                  to="/calendar"
                  className={`px-4 py-2 rounded-xl text-[13.5px] font-medium transition-colors ${isActive('/calendar')
                      ? 'bg-rose-50 text-rose-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  Kalendar
                </Link>
              )}

              {/* Availability — PRIEST only */}
              {isPriest && (
                <Link
                  to="/availability"
                  className={`px-4 py-2 rounded-xl text-[13.5px] font-medium transition-colors ${isActive('/availability')
                      ? 'bg-rose-50 text-rose-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  Dostupnost
                </Link>
              )}

              {/* Statistics — PRIEST only */}
              {isPriest && (
                <Link
                  to="/stats"
                  className={`px-4 py-2 rounded-xl text-[13.5px] font-medium transition-colors ${isActive('/stats')
                      ? 'bg-rose-50 text-rose-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  Statistika
                </Link>
              )}

              {/* Bookings — with pending badge for priest */}
              <Link
                to="/bookings"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13.5px] font-medium transition-colors ${isActive('/bookings')
                    ? 'bg-rose-50 text-rose-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                {isPriest ? 'Rezervacije' : 'Moje rezervacije'}
                {isPriest && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>

              {/* Request booking — PARISHIONER only */}
              {!isPriest && (
                <Link
                  to="/request-booking"
                  className={`px-4 py-2 rounded-xl text-[13.5px] font-medium transition-colors ${isActive('/request-booking')
                      ? 'bg-rose-50 text-rose-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  Zatraži susret
                </Link>
              )}
            </div>
          </div>

          {/* ── User info + sign out ── */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[13.5px] font-medium text-slate-800 leading-tight">{userProfile?.name}</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{roleLabel}</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <button
              onClick={signOut}
              className="px-4 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Odjava
            </button>
          </div>

        </div>
      </div>
    </nav>
  )
}
