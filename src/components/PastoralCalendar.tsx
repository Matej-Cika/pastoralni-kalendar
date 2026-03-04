import { useState, useEffect } from 'react'
import { supabase, Event, EventCategory } from '../lib/supabase'
import CellEntryModal from './CellEntryModal'

interface PastoralCalendarProps {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onEventsChanged?: () => void
  /** Increment to trigger an immediate data refetch without changing month */
  refreshKey?: number
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 3 + i)

const COLUMNS: { key: EventCategory; label: string; sublabel: string }[] = [
  { key: 'POBOZNOST', label: 'Pobožnosti', sublabel: 'Klanjanje, Srijeda Sv.Josipu…' },
  { key: 'AKTIVNOST', label: 'Aktivnosti', sublabel: 'Razgovori, Sastanci, Blagoslovi…' },
  { key: 'SAKRAMENT', label: 'Sakramenti', sublabel: 'Misa, Krštenje, Vjenčanje…' },
]

const COLUMN_COLORS: Record<EventCategory, {
  bg: string; border: string; chip: string; text: string
  hoverBg: string; tagBg: string; tagText: string
}> = {
  POBOZNOST: {
    bg: '#f5f3ff', border: '#c4b5fd', chip: '#7c3aed', text: '#4c1d95',
    hoverBg: '#ede9fe', tagBg: '#ede9fe', tagText: '#5b21b6',
  },
  AKTIVNOST: {
    bg: '#f0fdf4', border: '#86efac', chip: '#16a34a', text: '#14532d',
    hoverBg: '#dcfce7', tagBg: '#dcfce7', tagText: '#15803d',
  },
  SAKRAMENT: {
    bg: '#fffbeb', border: '#fcd34d', chip: '#b45309', text: '#78350f',
    hoverBg: '#fef3c7', tagBg: '#fef3c7', tagText: '#92400e',
  },
}

const HR_DAYS: Record<number, string> = {
  0: 'Ned', 1: 'Pon', 2: 'Uto', 3: 'Sri', 4: 'Čet', 5: 'Pet', 6: 'Sub',
}

const HR_MONTHS: Record<number, string> = {
  0: 'Siječanj', 1: 'Veljača', 2: 'Ožujak', 3: 'Travanj',
  4: 'Svibanj', 5: 'Lipanj', 6: 'Srpanj', 7: 'Kolovoz',
  8: 'Rujan', 9: 'Listopad', 10: 'Studeni', 11: 'Prosinac',
}

/** Returns true when the given month/year matches the real current month. */
function checkIsCurrentMonth(d: Date): boolean {
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export default function PastoralCalendar({ currentMonth, onMonthChange, onEventsChanged, refreshKey }: PastoralCalendarProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedCell, setSelectedCell] = useState<{ date: Date; category: EventCategory } | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Feature 1: past-day visibility toggle
  const [showPastDays, setShowPastDays] = useState(false)
  const isCurrentMonth = checkIsCurrentMonth(currentMonth)

  // Reset toggle whenever user navigates to a different month
  useEffect(() => {
    setShowPastDays(false)
  }, [currentMonth])

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, refreshKey])

  async function fetchEvents() {
    try {
      setLoading(true)
      setFetchError(null)
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      // Use local date strings so month boundaries include all events (avoid UTC shift excluding events)
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_deleted', false)
        .gte('start_time', startStr)
        .lte('start_time', endStr + 'T23:59:59.999')
        .order('start_time', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      console.error('Greška pri dohvatu događaja:', err)
      setFetchError('Nije moguće učitati događaje. Molimo osvježite stranicu.')
    } finally {
      setLoading(false)
    }
  }

  /** All days in the viewed month. */
  function getAllDays(): Date[] {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  /**
   * Days to render in the table.
   * For the current real month: hide past days unless showPastDays is true.
   * For all other months: always show every day.
   */
  function getVisibleDays(): Date[] {
    const all = getAllDays()
    if (!isCurrentMonth || showPastDays) return all
    const today = new Date()
    const todayNum = today.getDate()
    return all.filter(d => d.getDate() >= todayNum)
  }

  function getEventsForCell(date: Date, category: EventCategory): Event[] {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return events.filter(e => e.start_time.slice(0, 10) === dateStr && e.event_type === category)
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function isToday(date: Date): boolean {
    const now = new Date()
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    )
  }

  const visibleDays = getVisibleDays()
  const allDays = getAllDays()
  const hiddenCount = allDays.length - visibleDays.length

  function prevMonth() {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() - 1)
    onMonthChange(d)
  }

  function nextMonth() {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() + 1)
    onMonthChange(d)
  }

  function goToday() {
    onMonthChange(new Date())
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] bg-white rounded-2xl border border-slate-200">
        <div className="w-8 h-8 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-[14px] text-slate-400 font-medium">Učitavanje kalendara…</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] bg-white rounded-2xl border border-red-100">
        <div className="text-3xl mb-3">⚠</div>
        <p className="text-[15px] font-semibold text-slate-700 mb-1">Greška pri učitavanju</p>
        <p className="text-[13px] text-slate-400 mb-5">{fetchError}</p>
        <button
          onClick={fetchEvents}
          className="px-5 py-2 text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Pokušaj ponovo
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month dropdown */}
            <select
              value={currentMonth.getMonth()}
              onChange={e => onMonthChange(new Date(currentMonth.getFullYear(), Number(e.target.value), 1))}
              className="px-3.5 py-2 text-[15px] font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer appearance-none pr-8"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
            >
              {Object.entries(HR_MONTHS).map(([idx, name]) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>

            {/* Year dropdown */}
            <select
              value={currentMonth.getFullYear()}
              onChange={e => onMonthChange(new Date(Number(e.target.value), currentMonth.getMonth(), 1))}
              className="px-3.5 py-2 text-[15px] font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer appearance-none pr-8"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>{y}.</option>
              ))}
            </select>

            {/* Past-days toggle — only visible on the current real month */}
            {isCurrentMonth && (
              <button
                onClick={() => setShowPastDays(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-xl border transition-colors ${showPastDays
                    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {showPastDays
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  }
                </svg>
                {showPastDays
                  ? 'Sakrij prošle dane'
                  : `Prikaži prošle dane${hiddenCount > 0 ? ` (${hiddenCount})` : ''}`
                }
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
              <button
              onClick={prevMonth}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 text-[12px] sm:text-[13px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Prethodni</span>
            </button>
            <button
              onClick={goToday}
              className="px-2.5 sm:px-3.5 py-2 text-[12px] sm:text-[13px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              Danas
            </button>
            <button
              onClick={nextMonth}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 text-[12px] sm:text-[13px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <span className="hidden sm:inline">Sljedeći</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Column legend chips ── */}
        <div className="flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 bg-slate-50/60 flex-wrap">
          {COLUMNS.map((col) => {
            const c = COLUMN_COLORS[col.key]
            return (
              <div
                key={col.key}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-medium border"
                style={{ background: c.tagBg, borderColor: c.border, color: c.tagText }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: c.chip }} />
                {col.label}
              </div>
            )
          })}
          <span className="hidden sm:inline ml-auto text-[12px] text-slate-400">Kliknite ćeliju za dodavanje unosa</span>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="pastoral-table">
            <colgroup>
              <col style={{ width: '100px', minWidth: '80px' }} />
              <col /><col /><col />
            </colgroup>

            {/* Column headers */}
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[12px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/60 border-r border-slate-200">
                  Datum
                </th>
                {COLUMNS.map((col) => {
                  const c = COLUMN_COLORS[col.key]
                  return (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left border-r border-slate-200 last:border-r-0"
                      style={{ background: c.bg }}
                    >
                      <span className="block text-[13px] font-semibold" style={{ color: c.text }}>
                        {col.label}
                      </span>
                      <span className="block text-[11px] font-normal mt-0.5" style={{ color: c.chip, opacity: 0.7 }}>
                        {col.sublabel}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {visibleDays.map((day, idx) => {
                const today = isToday(day)
                const isSunday = day.getDay() === 0
                const isLastRow = idx === visibleDays.length - 1

                return (
                  <tr
                    key={day.toISOString()}
                    className={`${isLastRow ? '' : 'border-b border-slate-100'} ${isSunday ? 'bg-indigo-50/30' : ''}`}
                  >
                    {/* Date cell */}
                    <td className={`px-4 py-3 border-r border-slate-200 bg-slate-50/40 align-top ${today ? 'bg-indigo-50' : ''}`}>
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[22px] font-bold leading-tight ${today ? 'text-indigo-600' : 'text-slate-800'}`}>
                          {day.getDate()}
                        </span>
                        <span className={`text-[12px] font-medium uppercase tracking-wide ${isSunday ? 'text-indigo-500' : 'text-slate-400'}`}>
                          {HR_DAYS[day.getDay()]}
                          {today && (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] bg-indigo-500 text-white rounded-full leading-none">
                              danas
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Category cells */}
                    {COLUMNS.map((col) => {
                      const c = COLUMN_COLORS[col.key]
                      const cellEvents = getEventsForCell(day, col.key)
                      return (
                        <td
                          key={`${day.toISOString()}-${col.key}`}
                          className="px-3 py-2.5 border-r border-slate-100 last:border-r-0 align-top cursor-pointer group transition-colors"
                          style={{ background: cellEvents.length > 0 ? c.bg : undefined }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = c.hoverBg }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = cellEvents.length > 0 ? c.bg : '' }}
                          onClick={() => setSelectedCell({ date: day, category: col.key })}
                        >
                          {cellEvents.length === 0 ? (
                            <span className="text-[12px] text-slate-300 group-hover:text-slate-400 transition-colors select-none">
                              + Dodaj
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              {cellEvents.map((event) => (
                                <div
                                  key={event.id}
                                  className="rounded-xl px-3 py-2 border"
                                  style={{ background: 'white', borderColor: c.border }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-slate-800 leading-snug">
                                      {event.title}
                                    </span>
                                    <span
                                      className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-md mt-px"
                                      style={{ background: c.tagBg, color: c.chip }}
                                    >
                                      {formatTime(event.start_time)}
                                    </span>
                                  </div>
                                  {event.description && (
                                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{event.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cell entry modal */}
      {selectedCell && (
        <CellEntryModal
          date={selectedCell.date}
          category={selectedCell.category}
          existingEvents={getEventsForCell(selectedCell.date, selectedCell.category)}
          onClose={() => setSelectedCell(null)}
          onSuccess={() => {
            setSelectedCell(null)
            fetchEvents()
            onEventsChanged?.()
          }}
        />
      )}
    </>
  )
}
