import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navigation from '../components/Navigation'
import PastoralCalendar from '../components/PastoralCalendar'
import UpcomingPanel from '../components/UpcomingPanel'
import QuickAddPanel from '../components/QuickAddPanel'
import ObligationCheckModal from '../components/ObligationCheckModal'

// ── Helpers ────────────────────────────────────────────────
const HR_MONTHS: Record<number, string> = {
  0: 'siječnja', 1: 'veljače', 2: 'ožujka', 3: 'travnja',
  4: 'svibnja', 5: 'lipnja', 6: 'srpnja', 7: 'kolovoza',
  8: 'rujna', 9: 'listopada', 10: 'studenoga', 11: 'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0: 'ned', 1: 'pon', 2: 'uto', 3: 'sri', 4: 'čet', 5: 'pet', 6: 'sub',
}
function fmt(dateStr: string, start: string, end: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${HR_WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${HR_MONTHS[d.getMonth()]} · ${start} – ${end}`
}

// ── localStorage helpers ───────────────────────────────────
const SEEN_KEY = 'priest_seen_cancel_v2'
function getSeenIds(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') } catch { return [] }
}
function persistSeen(ids: string[]) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids))
}

// ── Types ─────────────────────────────────────────────────
interface CancelInfo {
  id:          string
  name:        string
  phone:       string | null
  dateLabel:   string
  updatedAt:   string
}

// ── Cancellation Alert Banner ─────────────────────────────
function CancellationBanner() {
  const [items,    setItems]    = useState<CancelInfo[]>([])
  const [seenIds,  setSeenIds]  = useState<string[]>(getSeenIds)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    load()
    window.addEventListener('bookings-updated', load)
    return () => window.removeEventListener('bookings-updated', load)
  }, [])

  async function load() {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('bookings')
      .select('id, parishioner_first_name, parishioner_last_name, parishioner_phone, requested_start_time, requested_end_time, updated_at, availability_slot:availability_slots(date, start_time, end_time)')
      .eq('cancelled_by', 'PARISHIONER')
      .eq('cancelled_from_status', 'CONFIRMED')
      .gte('updated_at', twoDaysAgo)
      .order('updated_at', { ascending: false })

    setItems((data ?? []).map(b => {
      const slotRaw = b.availability_slot
      const slot = Array.isArray(slotRaw) ? slotRaw[0] : (slotRaw as { date: string; start_time: string; end_time: string } | null)
      return {
        id:        b.id,
        name:      [b.parishioner_first_name, b.parishioner_last_name].filter(Boolean).join(' ') || '—',
        phone:     b.parishioner_phone ?? null,
        dateLabel: slot
          ? fmt(slot.date, b.requested_start_time ?? slot.start_time, b.requested_end_time ?? slot.end_time)
          : '—',
        updatedAt: b.updated_at,
      }
    }))
  }

  function dismiss(id: string) {
    const next = [...new Set([...seenIds, id])]
    setSeenIds(next)
    persistSeen(next)
    window.dispatchEvent(new Event('bookings-updated'))
  }

  function dismissAll() {
    const next = [...new Set([...seenIds, ...items.map(i => i.id)])]
    setSeenIds(next)
    persistSeen(next)
    setExpanded(false)
    window.dispatchEvent(new Event('bookings-updated'))
  }

  const visible = items.filter(i => !seenIds.includes(i.id))
  if (visible.length === 0) return null

  const n = visible.length

  return (
    <div className="mb-5 sm:mb-7 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(220,38,38,0.22)] border-2 border-red-400">
      {/* ── Main clickable header (collapsed summary) ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left bg-gradient-to-r from-red-700 via-red-600 to-rose-600 px-3 sm:px-5 py-4 sm:py-5 flex items-center justify-between gap-3 sm:gap-4 hover:from-red-800 hover:via-red-700 hover:to-rose-700 transition-all"
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-400 rounded-full border-2 border-red-700 animate-bounce flex items-center justify-center">
              <span className="text-[10px] font-black text-red-800">{n}</span>
            </span>
          </div>
          <div>
            <p className="text-white font-bold text-[14px] sm:text-[17px] leading-tight">
              ⚠️ Otkazani susreti
            </p>
            <p className="text-red-100 text-[12px] sm:text-[13px] mt-0.5 sm:mt-1 font-medium">
              {n === 1
                ? '1 župljani/ca otkazao/la potvrđeni susret'
                : `${n} župljana otkazalo potvrđene susrete`}
              {' '}· Kliknite za detalje
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="hidden sm:inline-block px-3 py-1 bg-white/20 text-white text-[12px] font-semibold rounded-xl">
            {expanded ? 'Sakrij' : 'Prikaži detalje'}
          </span>
          <svg
            className={`w-5 h-5 text-white/80 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Expanded details ── */}
      {expanded && (
        <>
          <div className="bg-white divide-y divide-red-50">
            {visible.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <span className="text-[14px] font-bold text-red-600">
                      {item.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-800">{item.name}</p>
                    <p className="text-[13px] text-slate-500">{item.dateLabel}</p>
                    {item.phone && (
                      <a href={`tel:${item.phone}`} className="text-[12px] text-indigo-500 hover:underline">
                        {item.phone}
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismiss(item.id)}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Vidjeno
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-red-50 border-t border-red-100 px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <p className="text-[12px] text-red-400">Automatski nestaje nakon 48 sati od otkazivanja</p>
            <div className="flex items-center gap-3">
              <button
                onClick={dismissAll}
                className="px-3.5 py-1.5 text-[12px] font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-xl transition-colors"
              >
                Označi sve vidjenim
              </button>
              <Link
                to="/bookings"
                className="flex items-center gap-1 text-[12px] font-semibold text-red-600 hover:text-red-800 transition-colors"
              >
                Sve rezervacije
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function Calendar() {
  const { isPriest } = useAuth()
  const [currentMonth, setCurrentMonth]             = useState(new Date())
  const [eventsVersion, setEventsVersion]           = useState(0)
  const [showObligationCheck, setShowObligationCheck] = useState(false)

  // Refresh both UpcomingPanel and PastoralCalendar whenever a booking changes
  // (confirmation creates an event, cancellation soft-deletes it)
  useEffect(() => {
    function onBookingsUpdated() { setEventsVersion(v => v + 1) }
    window.addEventListener('bookings-updated', onBookingsUpdated)
    return () => window.removeEventListener('bookings-updated', onBookingsUpdated)
  }, [])

  return (
    <div className="min-h-screen bg-[#f6f7fa]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="mb-5 sm:mb-7 flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] sm:text-[26px] font-semibold text-slate-900 tracking-tight">Pastoralni kalendar</h1>
            <p className="text-[13px] sm:text-[14px] text-slate-400 mt-0.5 sm:mt-1">Pobožnosti, aktivnosti i sakramenti</p>
          </div>
          <button
            onClick={() => setShowObligationCheck(true)}
            className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[12px] sm:text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors mt-0.5"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline">Provjera obveza</span>
            <span className="sm:hidden">Obveze</span>
          </button>
        </div>

        {/* Prominent cancellation alert — priest only */}
        {isPriest && <CancellationBanner />}

        <UpcomingPanel refreshKey={eventsVersion} />

        <QuickAddPanel
          currentMonth={currentMonth}
          onEventsChanged={() => setEventsVersion(v => v + 1)}
          onMonthChange={setCurrentMonth}
        />

        <PastoralCalendar
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onEventsChanged={() => setEventsVersion(v => v + 1)}
          refreshKey={eventsVersion}
        />
      </div>

      {showObligationCheck && (
        <ObligationCheckModal onClose={() => setShowObligationCheck(false)} />
      )}
    </div>
  )
}
