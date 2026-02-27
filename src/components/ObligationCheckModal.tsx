import { useState } from 'react'
import { supabase, Event, EventCategory, toEventCategory } from '../lib/supabase'

interface ObligationCheckModalProps {
  onClose: () => void
}

// ── Locale helpers ────────────────────────────────────────────
const HR_MONTHS_LONG: Record<number, string> = {
  0: 'siječnja', 1: 'veljače', 2: 'ožujka', 3: 'travnja',
  4: 'svibnja', 5: 'lipnja', 6: 'srpnja', 7: 'kolovoza',
  8: 'rujna', 9: 'listopada', 10: 'studenoga', 11: 'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0: 'nedjelja', 1: 'ponedjeljak', 2: 'utorak',
  3: 'srijeda', 4: 'četvrtak', 5: 'petak', 6: 'subota',
}

const CATEGORY_HR: Record<EventCategory, string> = {
  POBOZNOST: 'Pobožnost',
  AKTIVNOST: 'Aktivnost',
  SAKRAMENT: 'Sakrament',
}
const CATEGORY_DOT: Record<EventCategory, string> = {
  POBOZNOST: '#7c3aed',
  AKTIVNOST: '#16a34a',
  SAKRAMENT: '#b45309',
}

function formatGroupHeader(dateStr: string): string {
  // dateStr = "YYYY-MM-DD"  →  "12.11.2026 · četvrtak"
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${d}.${String(m).padStart(2, '0')}.${y} · ${HR_WEEKDAYS[date.getDay()]}`
}

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${d}. ${HR_MONTHS_LONG[date.getMonth()]} ${y}.`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(isoStr: string, days: number): string {
  const [y, m, d] = isoStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface DateGroup {
  dateStr: string
  headerLabel: string
  longLabel: string
  events: Event[]
}

// ── Component ─────────────────────────────────────────────────
export default function ObligationCheckModal({ onClose }: ObligationCheckModalProps) {
  const today = getTodayIso()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState(addDays(today, 7))

  type Status = 'idle' | 'loading' | 'done' | 'error'
  const [status,   setStatus]   = useState<Status>('idle')
  const [groups,   setGroups]   = useState<DateGroup[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [queryError, setQueryError] = useState<string | null>(null)

  // Validation: date range
  const dateRangeError = dateFrom && dateTo && dateFrom > dateTo
    ? 'Početni datum mora biti prije završnog datuma.'
    : null

  const canQuery = dateFrom && dateTo && !dateRangeError

  async function handleCheck() {
    if (!canQuery) return
    setStatus('loading')
    setQueryError(null)
    setGroups([])

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_deleted', false)
        .gte('start_time', dateFrom)
        .lte('start_time', dateTo + 'T23:59:59')
        .order('start_time', { ascending: true })

      if (error) throw error

      const events: Event[] = data || []
      setTotalCount(events.length)

      // Group by date
      const map = new Map<string, Event[]>()
      for (const ev of events) {
        const dStr = ev.start_time.slice(0, 10)
        if (!map.has(dStr)) map.set(dStr, [])
        map.get(dStr)!.push(ev)
      }

      const built: DateGroup[] = Array.from(map.entries()).map(([dStr, evts]) => ({
        dateStr:     dStr,
        headerLabel: formatGroupHeader(dStr),
        longLabel:   formatLongDate(dStr),
        events:      evts,
      }))

      setGroups(built)
      setStatus('done')
    } catch (err) {
      console.error('Greška pri provjeri obveza:', err)
      setQueryError('Nije moguće dohvatiti obveze. Molimo pokušajte ponovo.')
      setStatus('error')
    }
  }

  const INPUT_CLASS =
    'w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 ' +
    'rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all'

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[88vh] mx-2 sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">Provjera obveza</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Pregled svih unosa u odabranom razdoblju</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xl"
          >
            ×
          </button>
        </div>

        {/* ── Query form ── */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Datum od
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Datum do
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <button
              onClick={handleCheck}
              disabled={!canQuery || status === 'loading'}
              className="px-5 py-2.5 text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {status === 'loading' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Provjerava…
                </span>
              ) : 'Provjeri'}
            </button>
          </div>

          {/* Date range validation error */}
          {dateRangeError && (
            <p className="mt-2 text-[12px] text-red-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {dateRangeError}
            </p>
          )}
        </div>

        {/* ── Results ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-[13px] text-slate-400">Odaberite raspon datuma i kliknite <strong className="text-slate-600">Provjeri</strong>.</p>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-7 h-7 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[13px] text-slate-400">Dohvaćanje obveza…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <div className="text-2xl">⚠</div>
              <p className="text-[14px] font-semibold text-slate-700">Greška pri pretraživanju</p>
              <p className="text-[13px] text-slate-400">{queryError}</p>
              <button
                onClick={handleCheck}
                className="mt-2 px-4 py-2 text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Pokušaj ponovo
              </button>
            </div>
          )}

          {status === 'done' && totalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-1">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-slate-700">Slobodno razdoblje</p>
              <p className="text-[13px] text-slate-400">Nema obveza u odabranom razdoblju.</p>
            </div>
          )}

          {status === 'done' && totalCount > 0 && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-500">
                  Pronađeno <strong className="text-slate-800">{totalCount}</strong>{' '}
                  {totalCount === 1 ? 'obveza' : 'obveze/a'} u {groups.length}{' '}
                  {groups.length === 1 ? 'danu' : 'dana'}.
                </span>
              </div>

              {/* Grouped results */}
              {groups.map(group => (
                <div key={group.dateStr}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {group.headerLabel}
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  {/* Events in this day */}
                  <div className="space-y-1.5">
                    {group.events.map(ev => {
                      const cat = toEventCategory(ev.event_type)
                      return (
                        <div
                          key={ev.id}
                          className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
                        >
                          <div
                            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                            style={{ background: CATEGORY_DOT[cat] ?? '#94a3b8' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-[13px] font-semibold text-slate-800">
                                {formatTime(ev.start_time)}
                                {ev.end_time && (
                                  <span className="font-normal text-slate-500"> – {formatTime(ev.end_time)}</span>
                                )}
                              </span>
                              <span className="text-[13px] text-slate-700 truncate">{ev.title}</span>
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0"
                                style={{
                                  background: cat === 'POBOZNOST' ? '#ede9fe' : cat === 'AKTIVNOST' ? '#dcfce7' : '#fef3c7',
                                  color: cat === 'POBOZNOST' ? '#5b21b6' : cat === 'AKTIVNOST' ? '#15803d' : '#92400e',
                                }}
                              >
                                {CATEGORY_HR[cat] ?? cat}
                              </span>
                            </div>
                            {ev.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{ev.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/60 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  )
}
