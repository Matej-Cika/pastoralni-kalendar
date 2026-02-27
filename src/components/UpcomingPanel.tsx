import { useState, useEffect } from 'react'
import { supabase, Event, EventCategory } from '../lib/supabase'

interface UpcomingPanelProps {
  /** Increment this to trigger a fresh fetch (e.g. after creating/editing an event). */
  refreshKey: number
}

const CATEGORY_HR: Record<EventCategory, string> = {
  DEVOTION:  'Pobožnost',
  ACTIVITY:  'Aktivnost',
  SACRAMENT: 'Sakrament',
}

const CATEGORY_DOT: Record<EventCategory, string> = {
  DEVOTION:  '#7c3aed',
  ACTIVITY:  '#16a34a',
  SACRAMENT: '#b45309',
}

const CATEGORY_LABEL_COLOR: Record<EventCategory, string> = {
  DEVOTION:  '#5b21b6',
  ACTIVITY:  '#15803d',
  SACRAMENT: '#92400e',
}

const CATEGORY_LABEL_BG: Record<EventCategory, string> = {
  DEVOTION:  '#ede9fe',
  ACTIVITY:  '#dcfce7',
  SACRAMENT: '#fef3c7',
}

const HR_MONTHS: Record<number, string> = {
  0: 'sij.', 1: 'velj.', 2: 'ožu.', 3: 'tra.',
  4: 'svi.', 5: 'lip.', 6: 'srp.', 7: 'kol.',
  8: 'ruj.', 9: 'lis.', 10: 'stu.', 11: 'pro.',
}

const HR_WEEKDAYS: Record<number, string> = {
  0: 'nedjelja', 1: 'ponedjeljak', 2: 'utorak',
  3: 'srijeda', 4: 'četvrtak', 5: 'petak', 6: 'subota',
}

interface DayGroup {
  label: string     // "Danas", "Sutra", "Prekosutra"
  dateDisplay: string  // "24. sij. (ponedjeljak)"
  events: Event[]
}

function buildDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function UpcomingPanel({ refreshKey }: UpcomingPanelProps) {
  const [groups, setGroups] = useState<DayGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Refresh whenever refreshKey changes OR bookings are updated (cancellations, confirmations)
  const [internalKey, setInternalKey] = useState(0)

  useEffect(() => {
    function onBookingsUpdated() { setInternalKey(k => k + 1) }
    window.addEventListener('bookings-updated', onBookingsUpdated)
    return () => window.removeEventListener('bookings-updated', onBookingsUpdated)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetch3Days() {
      try {
        setLoading(true)
        setFetchError(null)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const day1 = new Date(today); day1.setDate(today.getDate() + 1)
        const day2 = new Date(today); day2.setDate(today.getDate() + 2)

        const fromStr = buildDateStr(today)
        const toStr   = buildDateStr(day2) + 'T23:59:59'

        // Only fetch non-deleted events from the events table.
        // Booking-created events have event_type='ACTIVITY' and booking_id set.
        // Availability slots are NEVER in this table — they live in availability_slots.
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('is_deleted', false)
          .gte('start_time', fromStr)
          .lte('start_time', toStr)
          .order('start_time', { ascending: true })

        if (cancelled) return
        if (error) throw error

        const days = [today, day1, day2]
        const dayLabels = ['Danas', 'Sutra', 'Prekosutra']

        const grouped: DayGroup[] = days.map((d, i) => {
          const dStr = buildDateStr(d)
          return {
            label: dayLabels[i],
            dateDisplay: `${d.getDate()}. ${HR_MONTHS[d.getMonth()]} (${HR_WEEKDAYS[d.getDay()]})`,
            events: (data || []).filter(e => e.start_time.slice(0, 10) === dStr),
          }
        })

        setGroups(grouped)
      } catch (err) {
        if (!cancelled) {
          console.error('Greška pri dohvatu nadolazećih događaja:', err)
          setFetchError('Nije moguće učitati nadolazeće obveze.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch3Days()
    return () => { cancelled = true }
  }, [refreshKey, internalKey])

  const totalEvents = groups.reduce((sum, g) => sum + g.events.length, 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold text-slate-800">Nadolazeće obveze</span>
          <span className="text-[12px] text-slate-400 font-normal">— sljedeća 3 dana</span>
        </div>
        {!loading && totalEvents > 0 && (
          <span className="text-[12px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
            {totalEvents} {totalEvents === 1 ? 'obveza' : 'obveze/a'}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-4 h-4 border-2 border-indigo-100 border-t-indigo-400 rounded-full animate-spin shrink-0" />
            <span className="text-[13px] text-slate-400">Učitavanje obveza…</span>
          </div>
        ) : fetchError ? (
          <p className="text-[13px] text-red-500">{fetchError}</p>
        ) : totalEvents === 0 ? (
          <p className="text-[13px] text-slate-400 py-1">Nema obveza u naredna 3 dana.</p>
        ) : (
          <div className="flex gap-5 flex-wrap">
            {groups.filter(g => g.events.length > 0).map((group) => (
              <div key={group.label} className="min-w-[200px] flex-1">
                {/* Day header */}
                <div className="flex items-baseline gap-2 mb-2.5">
                  <span className="text-[13px] font-bold text-slate-800">{group.label}</span>
                  <span className="text-[11px] text-slate-400">{group.dateDisplay}</span>
                </div>

                {/* Events for this day */}
                <div className="space-y-1.5">
                  {group.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      {/* Category dot */}
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: CATEGORY_DOT[event.event_type as EventCategory] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-slate-800 leading-snug truncate">
                            {event.title}
                          </span>
                          <span
                            className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                            style={{
                              background: CATEGORY_LABEL_BG[event.event_type as EventCategory],
                              color: CATEGORY_LABEL_COLOR[event.event_type as EventCategory],
                            }}
                          >
                            {CATEGORY_HR[event.event_type as EventCategory]}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          {formatTime(event.start_time)}
                          {event.end_time && ` – ${formatTime(event.end_time)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
