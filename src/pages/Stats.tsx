import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Navigation from '../components/Navigation'

// ── Croatian locale ──────────────────────────────────────────
const HR_MONTHS: string[] = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj',
  'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz',
  'Rujan', 'Listopad', 'Studeni', 'Prosinac',
]
const HR_MONTHS_GEN: string[] = [
  'siječnja', 'veljače', 'ožujka', 'travnja',
  'svibnja', 'lipnja', 'srpnja', 'kolovoza',
  'rujna', 'listopada', 'studenoga', 'prosinca',
]
const HR_WEEKDAYS: Record<number, string> = {
  0: 'ned', 1: 'pon', 2: 'uto', 3: 'sri', 4: 'čet', 5: 'pet', 6: 'sub',
}

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  return `${HR_WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${HR_MONTHS_GEN[d.getMonth()]}`
}
function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Types ────────────────────────────────────────────────────
type Category = 'SACRAMENT' | 'DEVOTION' | 'ACTIVITY'

interface EventRow {
  id: string
  title: string
  start_time: string
  end_time: string
  event_type: string
}

interface Stats {
  sacrament: number
  devotion:  number
  activity:  number
  pending:   number
  confirmed: number
  completed: number  // Odrađene rezervacije
}

// ── Category config ──────────────────────────────────────────
const CAT_CONFIG: Record<Category, {
  label: string
  icon: React.ReactNode
  cardBg: string
  cardBorder: string
  cardText: string
  badgeBg: string
  badgeText: string
}> = {
  SACRAMENT: {
    label:       'Sakramenti',
    cardBg:      'bg-amber-50',
    cardBorder:  'border-amber-200',
    cardText:    'text-amber-800',
    badgeBg:     'bg-amber-100',
    badgeText:   'text-amber-700',
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
      </svg>
    ),
  },
  DEVOTION: {
    label:       'Pobožnosti',
    cardBg:      'bg-violet-50',
    cardBorder:  'border-violet-200',
    cardText:    'text-violet-800',
    badgeBg:     'bg-violet-100',
    badgeText:   'text-violet-700',
    icon: (
      <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  ACTIVITY: {
    label:       'Aktivnosti',
    cardBg:      'bg-emerald-50',
    cardBorder:  'border-emerald-200',
    cardText:    'text-emerald-800',
    badgeBg:     'bg-emerald-100',
    badgeText:   'text-emerald-700',
    icon: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      </svg>
    ),
  },
}

// Year range shown in dropdown
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

// ── Component ────────────────────────────────────────────────
export default function Stats() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())   // 0-based
  const [year,  setYear]  = useState(now.getFullYear())

  const [stats,       setStats]       = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Which category card is expanded
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [events,         setEvents]         = useState<EventRow[]>([])
  const [eventsLoading,  setEventsLoading]  = useState(false)

  // ── Fetch summary counts whenever month/year changes ──────
  useEffect(() => {
    fetchStats()
    setActiveCategory(null)
    setEvents([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year])

  async function fetchStats() {
    setStatsLoading(true)
    try {
      const start = new Date(year, month,     1)
      const end   = new Date(year, month + 1, 1)

      const [
        { data: evData },
        { count: pending },
        { count: confirmed },
        { data: completedBookings },
      ] = await Promise.all([
        supabase
          .from('events')
          .select('event_type')
          .eq('is_deleted', false)
          .gte('start_time', start.toISOString())
          .lt('start_time',  end.toISOString()),
        supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING'),
        supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'CONFIRMED'),
        supabase
          .from('bookings')
          .select('id, slot_date, availability_slot:availability_slots(date)')
          .eq('status', 'COMPLETED'),
      ])

      const completed = (completedBookings ?? []).filter((b: { slot_date?: string; availability_slot?: { date: string } }) => {
        const d = b.slot_date ?? b.availability_slot?.date
        if (!d) return false
        const slotDate = new Date(d + 'T12:00:00')
        return slotDate >= start && slotDate < end
      }).length

      setStats({
        sacrament: evData?.filter(e => e.event_type === 'SACRAMENT').length ?? 0,
        devotion:  evData?.filter(e => e.event_type === 'DEVOTION').length  ?? 0,
        activity:  evData?.filter(e => e.event_type === 'ACTIVITY').length  ?? 0,
        pending:   pending  ?? 0,
        confirmed: confirmed ?? 0,
        completed: completed ?? 0,
      })
    } catch (err) {
      console.error('Stats fetch error:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  // ── Fetch individual events for an expanded category ──────
  async function openCategory(cat: Category) {
    if (activeCategory === cat) {
      // Toggle off
      setActiveCategory(null)
      setEvents([])
      return
    }
    setActiveCategory(cat)
    setEventsLoading(true)
    setEvents([])
    try {
      const start = new Date(year, month,     1)
      const end   = new Date(year, month + 1, 1)
      const { data } = await supabase
        .from('events')
        .select('id, title, start_time, end_time, event_type')
        .eq('is_deleted',  false)
        .eq('event_type',  cat)
        .gte('start_time', start.toISOString())
        .lt('start_time',  end.toISOString())
        .order('start_time', { ascending: true })
      setEvents(data ?? [])
    } catch (err) {
      console.error('Events fetch error:', err)
    } finally {
      setEventsLoading(false)
    }
  }

  const monthLabel = `${HR_MONTHS[month]} ${year}.`

  return (
    <div className="min-h-screen bg-[#f6f7fa]">
      <Navigation />
      <div className="max-w-[900px] mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">Statistika</h1>
            <p className="text-[14px] text-slate-400 mt-1">
              Pregled unosa po kategorijama — kliknite karticu za detalje
            </p>
          </div>

          {/* Month + year selectors */}
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 text-[13.5px] font-medium text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer pr-8"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}
            >
              {HR_MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 text-[13.5px] font-medium text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer pr-8"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Category stat cards ── */}
        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-[110px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {(Object.entries(CAT_CONFIG) as [Category, typeof CAT_CONFIG[Category]][]).map(([cat, cfg]) => {
              const count   = stats ? stats[cat.toLowerCase() as keyof Stats] : 0
              const isOpen  = activeCategory === cat
              const isEmpty = count === 0

              return (
                <button
                  key={cat}
                  onClick={() => !isEmpty && openCategory(cat)}
                  disabled={isEmpty}
                  className={[
                    'relative text-left rounded-2xl border p-5 transition-all',
                    cfg.cardBg,
                    isOpen ? `${cfg.cardBorder} ring-2 ring-offset-1` : cfg.cardBorder,
                    isEmpty ? 'opacity-50 cursor-default' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]',
                  ].join(' ')}
                  style={isOpen ? { ringColor: 'currentColor' } : {}}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cfg.badgeBg}`}>
                      {cfg.icon}
                    </div>
                    {!isEmpty && (
                      <svg
                        className={`w-4 h-4 ${cfg.cardText} opacity-60 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                  <p className={`mt-3 text-[36px] font-bold leading-none ${cfg.cardText}`}>{count}</p>
                  <p className={`mt-1 text-[13px] font-medium ${cfg.cardText} opacity-80`}>{cfg.label}</p>
                  <p className={`text-[12px] ${cfg.cardText} opacity-60`}>{monthLabel}</p>
                  {!isEmpty && (
                    <p className={`text-[11px] mt-2 font-medium ${cfg.cardText} opacity-70`}>
                      {isOpen ? 'Kliknite za zatvaranje' : 'Kliknite za detalje →'}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Expanded event list ── */}
        {activeCategory && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_16px_rgba(0,0,0,0.05)] overflow-hidden mb-6">
            {/* List header */}
            <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${CAT_CONFIG[activeCategory].cardBg}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${CAT_CONFIG[activeCategory].badgeBg}`}>
                  {CAT_CONFIG[activeCategory].icon}
                </div>
                <div>
                  <p className={`text-[14px] font-semibold ${CAT_CONFIG[activeCategory].cardText}`}>
                    {CAT_CONFIG[activeCategory].label}
                  </p>
                  <p className={`text-[12px] opacity-70 ${CAT_CONFIG[activeCategory].cardText}`}>{monthLabel}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[13px] font-bold ${CAT_CONFIG[activeCategory].badgeBg} ${CAT_CONFIG[activeCategory].cardText}`}>
                {stats?.[activeCategory.toLowerCase() as keyof Stats] ?? 0}
              </span>
            </div>

            {/* Events */}
            {eventsLoading ? (
              <div className="flex items-center gap-3 px-6 py-8 text-[14px] text-slate-400">
                <span className="w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                Učitavanje…
              </div>
            ) : events.length === 0 ? (
              <div className="px-6 py-8 text-center text-[14px] text-slate-400">
                Nema pronađenih unosa za ovaj mjesec.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {events.map((ev, idx) => (
                  <li key={ev.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    {/* Index number */}
                    <span className="shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-[12px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-slate-800 truncate">{ev.title}</p>
                      <p className="text-[12px] text-slate-400 capitalize mt-0.5">{formatEventDate(ev.start_time)}</p>
                    </div>
                    {/* Time */}
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-medium text-slate-600">
                        {formatEventTime(ev.start_time)}
                        {ev.end_time && ` – ${formatEventTime(ev.end_time)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Booking summary cards ── */}
        {!statsLoading && stats && (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Rezervacije
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[32px] font-bold text-amber-700 leading-none">{stats.pending}</p>
                <p className="text-[13px] font-medium text-amber-600 mt-1">Čekaju potvrdu</p>
                <p className="text-[12px] text-amber-500 opacity-70">neriješeni zahtjevi</p>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[32px] font-bold text-emerald-700 leading-none">{stats.confirmed}</p>
                <p className="text-[13px] font-medium text-emerald-600 mt-1">Potvrđene rezervacije</p>
                <p className="text-[12px] text-emerald-500 opacity-70">potvrđeni susreti</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[32px] font-bold text-slate-600 leading-none">{stats.completed}</p>
                <p className="text-[13px] font-medium text-slate-600 mt-1">Odrađene rezervacije</p>
                <p className="text-[12px] text-slate-500 opacity-70">{monthLabel}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
