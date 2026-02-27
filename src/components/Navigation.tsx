import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Navigation() {
  const { userProfile, signOut, isPriest } = useAuth()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path
  const [mobileOpen, setMobileOpen] = useState(false)

  const roleLabel = isPriest ? 'Svećenik' : 'Župljani'

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

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const linkClass = (path: string) =>
    `block px-4 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
      isActive(path)
        ? 'bg-rose-50 text-rose-800'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <nav className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[56px] sm:h-[60px]">

          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo-zupa.png"
              alt="Župa Presvetog Srca Isusovog"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-contain shrink-0"
            />
            <div className="leading-none min-w-0 hidden sm:block">
              <p className="text-[14px] font-semibold text-slate-900 tracking-tight leading-snug">
                Pastoralni kalendar
              </p>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5 tracking-wide truncate">
                Župa Presvetog Srca Isusovog · Visoka, Split
              </p>
            </div>
            <p className="text-[14px] font-semibold text-slate-900 tracking-tight sm:hidden">
              Kalendar
            </p>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {isPriest && (
              <Link to="/calendar" className={linkClass('/calendar')}>Kalendar</Link>
            )}
            {isPriest && (
              <Link to="/availability" className={linkClass('/availability')}>Dostupnost</Link>
            )}
            {isPriest && (
              <Link to="/stats" className={linkClass('/stats')}>Statistika</Link>
            )}
            <Link to="/bookings" className={`flex items-center gap-1.5 ${linkClass('/bookings')}`}>
              {isPriest ? 'Rezervacije' : 'Moje rezervacije'}
              {isPriest && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
            {!isPriest && (
              <Link to="/request-booking" className={linkClass('/request-booking')}>Zatraži susret</Link>
            )}
          </div>

          {/* Desktop user info */}
          <div className="hidden md:flex items-center gap-3">
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors relative"
            aria-label="Menu"
          >
            {isPriest && pendingCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {isPriest && (
              <Link to="/calendar" className={linkClass('/calendar')}>Kalendar</Link>
            )}
            {isPriest && (
              <Link to="/availability" className={linkClass('/availability')}>Dostupnost</Link>
            )}
            {isPriest && (
              <Link to="/stats" className={linkClass('/stats')}>Statistika</Link>
            )}
            <Link to="/bookings" className={`flex items-center gap-2 ${linkClass('/bookings')}`}>
              {isPriest ? 'Rezervacije' : 'Moje rezervacije'}
              {isPriest && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
            {!isPriest && (
              <Link to="/request-booking" className={linkClass('/request-booking')}>Zatraži susret</Link>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-slate-800">{userProfile?.name}</p>
              <p className="text-[11px] text-slate-400">{roleLabel}</p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Odjava
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
