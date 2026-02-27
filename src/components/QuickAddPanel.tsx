import { useState, useMemo } from 'react'
import { supabase, EventCategory } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TimeSelect from './TimeSelect'

interface QuickAddPanelProps {
  onEventsChanged: () => void
  onMonthChange?: (date: Date) => void
  /** The month currently shown in the calendar — Quick Add generates dates for THIS month */
  currentMonth: Date
}

// ── Croatian locale ────────────────────────────────────────
const HR_MONTHS: Record<number, string> = {
  0: 'Siječanj', 1: 'Veljača',  2: 'Ožujak',   3: 'Travanj',
  4: 'Svibanj',  5: 'Lipanj',   6: 'Srpanj',   7: 'Kolovoz',
  8: 'Rujan',    9: 'Listopad', 10: 'Studeni', 11: 'Prosinac',
}
const HR_MONTHS_SHORT: Record<number, string> = {
  0: 'sij.', 1: 'velj.', 2: 'ožu.', 3: 'tra.',
  4: 'svi.', 5: 'lip.',  6: 'srp.', 7: 'kol.',
  8: 'ruj.', 9: 'lis.', 10: 'stu.', 11: 'pro.',
}
const HR_WEEKDAYS_FULL = ['Nedjelja','Ponedjeljak','Utorak','Srijeda','Četvrtak','Petak','Subota']

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function shortDate(d: Date) {
  return `${d.getDate()}. ${HR_MONTHS_SHORT[d.getMonth()]}`
}
function fullDateLabel(d: Date) {
  return `${HR_WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()}. ${HR_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}.`
}

// ── Date helpers ───────────────────────────────────────────
/** All days in `month` whose day-of-week matches `dow` (0=Sun … 6=Sat) */
function getDowInMonth(month: Date, dow: number): Date[] {
  const y = month.getFullYear()
  const m = month.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  const result: Date[] = []
  for (let d = 1; d <= last; d++) {
    const date = new Date(y, m, d)
    if (date.getDay() === dow) result.push(date)
  }
  return result
}

/** All Mon–Sat in `month` */
function getWeekdaysInMonth(month: Date): Date[] {
  const y = month.getFullYear()
  const m = month.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  const result: Date[] = []
  for (let d = 1; d <= last; d++) {
    const date = new Date(y, m, d)
    if (date.getDay() !== 0) result.push(date)
  }
  return result
}

/**
 * From an array of dates, pick the best default:
 * — If the month is the current real month: pick the next upcoming date (today included).
 * — Otherwise: pick the first date in the list.
 */
function bestDefault(dates: Date[]): Date | null {
  if (!dates.length) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const upcoming = dates.find(d => d >= today)
  return upcoming ?? dates[0]
}

// ── Category styling ───────────────────────────────────────
const CAT_COLORS: Record<EventCategory, { bg:string; border:string; text:string; dot:string }> = {
  SAKRAMENT: { bg:'#fef3c7', border:'#fcd34d', text:'#92400e', dot:'#b45309' },
  POBOZNOST: { bg:'#ede9fe', border:'#c4b5fd', text:'#5b21b6', dot:'#7c3aed' },
  AKTIVNOST: { bg:'#dcfce7', border:'#86efac', text:'#15803d', dot:'#16a34a' },
}
const CAT_HR: Record<EventCategory, string> = {
  SAKRAMENT:'Sakrament', POBOZNOST:'Pobožnost', AKTIVNOST:'Aktivnost',
}
const CAT_COLORS_DB: Record<EventCategory, string> = {
  SAKRAMENT:'#b45309', POBOZNOST:'#7c3aed', AKTIVNOST:'#16a34a',
}

// ── Modal state ────────────────────────────────────────────
type ModalKind = 'weekday-mass' | 'sunday-mass' | 'adoration'

interface ModalState {
  kind:           ModalKind
  title:          string
  category:       EventCategory
  /** Pre-set time (e.g. '08:00') or '' when user must pick */
  fixedTime:      string
  /** Candidate dates shown in the day dropdown */
  availableDates: Date[]
  selectedDayIso: string
  customTime:     string
  note:           string
  saving:         boolean
  error:          string | null
}

// ── Component ──────────────────────────────────────────────
export default function QuickAddPanel({ onEventsChanged, onMonthChange, currentMonth }: QuickAddPanelProps) {
  const { user } = useAuth()
  const [modal, setModal] = useState<ModalState | null>(null)

  // Recompute date lists whenever the viewed month changes
  const sundays   = useMemo(() => getDowInMonth(currentMonth, 0),   [currentMonth])
  const thursdays = useMemo(() => getDowInMonth(currentMonth, 4),   [currentMonth])
  const weekdays  = useMemo(() => getWeekdaysInMonth(currentMonth), [currentMonth])

  const monthLabel = `${HR_MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}.`

  // ── Open modal helpers ────────────────────────────────────
  function openWeekdayMass(time: string) {
    const best = bestDefault(weekdays)
    setModal({
      kind: 'weekday-mass', title: 'Sveta misa', category: 'SAKRAMENT',
      fixedTime: time, availableDates: weekdays,
      selectedDayIso: best ? isoDate(best) : '',
      customTime: '', note: '', saving: false, error: null,
    })
  }

  function openSundayMass(time: string) {
    const best = bestDefault(sundays)
    setModal({
      kind: 'sunday-mass', title: 'Sveta misa', category: 'SAKRAMENT',
      fixedTime: time, availableDates: sundays,
      selectedDayIso: best ? isoDate(best) : '',
      customTime: '', note: '', saving: false, error: null,
    })
  }

  function openAdoration() {
    const best = bestDefault(thursdays)
    setModal({
      kind: 'adoration', title: 'Klanjanje', category: 'POBOZNOST',
      fixedTime: '', availableDates: thursdays,
      selectedDayIso: best ? isoDate(best) : '',
      customTime: '', note: '', saving: false, error: null,
    })
  }

  function closeModal() { setModal(null) }
  function update<K extends keyof ModalState>(field: K, value: ModalState[K]) {
    setModal(prev => prev ? { ...prev, [field]: value } : prev)
  }

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    if (!modal || !user) return

    const time = modal.kind === 'adoration' ? modal.customTime : modal.fixedTime
    if (!time)               { update('error', 'Odaberite vrijeme.'); return }
    if (!modal.selectedDayIso) { update('error', 'Odaberite dan.');    return }

    const [y, mo, d] = modal.selectedDayIso.split('-').map(Number)
    const targetDate = new Date(y, mo - 1, d)
    const [h, m2]    = time.split(':').map(Number)
    const startDT    = new Date(targetDate); startDT.setHours(h, m2, 0, 0)
    const endDT      = new Date(startDT.getTime() + 60 * 60 * 1000)

    update('saving', true); update('error', null)
    try {
      const { error } = await supabase.from('events').insert({
        title:       modal.title,
        description: modal.note.trim() || null,
        start_time:  startDT.toISOString(),
        end_time:    endDT.toISOString(),
        event_type:  modal.category,
        color:       CAT_COLORS_DB[modal.category],
        is_private:  false,
        created_by:  user.id,
        is_deleted:  false,
      })
      if (error) throw error
      setModal(null)
      onEventsChanged()
      onMonthChange?.(new Date(y, mo - 1, 1))
    } catch (err) {
      console.error('Greška pri brzom dodavanju:', err)
      setModal(prev => prev ? { ...prev, saving: false, error: 'Nije moguće dodati unos. Pokušajte ponovo.' } : prev)
    }
  }

  const canSave = modal && !modal.saving &&
    !!modal.selectedDayIso &&
    (modal.kind === 'adoration' ? !!modal.customTime : true)

  // ── Quick button ──────────────────────────────────────────
  function QuickBtn({ label, cat, onClick, count }: { label:string; cat:EventCategory; onClick:()=>void; count?:number }) {
    const c = CAT_COLORS[cat]
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-xl border transition-all hover:opacity-80 active:scale-[0.97]"
        style={{ background: c.bg, borderColor: c.border, color: c.text }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
        {label}
        {count !== undefined && count > 0 && (
          <span
            className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: c.dot, color: '#fff' }}
          >
            {count}×
          </span>
        )}
      </button>
    )
  }

  // Effective selected date for modal header display
  const effectiveDate = modal?.selectedDayIso
    ? (() => { const [y,m,d] = modal.selectedDayIso.split('-').map(Number); return new Date(y,m-1,d) })()
    : null

  return (
    <>
      {/* ── Panel ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden mb-6">

        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <span className="text-[13px] sm:text-[14px] font-semibold text-slate-800">Brzo dodavanje</span>
            <span className="text-[11px] sm:text-[12px] text-slate-400 hidden sm:inline">— datumi za odabrani mjesec</span>
          </div>
          <span className="text-[11px] sm:text-[12px] text-slate-700 font-semibold bg-indigo-50 border border-indigo-100 px-2.5 sm:px-3 py-1 rounded-full">
            {monthLabel}
          </span>
        </div>

        {/* Button groups */}
        <div className="px-3 sm:px-5 py-3 sm:py-4 flex flex-wrap gap-y-4 sm:gap-y-5 gap-x-4 sm:gap-x-6">

          {/* Weekday masses */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Tjedne mise · {weekdays.length} dana
            </p>
            <div className="flex flex-wrap gap-2">
              <QuickBtn label="Misa 08:00" cat="SAKRAMENT" onClick={() => openWeekdayMass('08:00')} />
              <QuickBtn label="Misa 19:00" cat="SAKRAMENT" onClick={() => openWeekdayMass('19:00')} />
            </div>
          </div>

          {/* Sunday masses */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Nedjeljna misa · {sundays.length} nedjelja
              {sundays.length > 0 && (
                <span className="ml-1.5 font-normal normal-case text-slate-400">
                  ({sundays.map(d => shortDate(d)).join(', ')})
                </span>
              )}
            </p>
            {sundays.length === 0 ? (
              <p className="text-[12px] text-slate-300 italic">Nema nedjelja u ovom mjesecu.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {['08:00', '09:30', '11:00', '19:00'].map(t => (
                  <QuickBtn key={t} label={`Ned ${t}`} cat="SAKRAMENT"
                    onClick={() => openSundayMass(t)} count={sundays.length} />
                ))}
              </div>
            )}
          </div>

          {/* Adoration — Thursdays */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Klanjanje (četvrtak) · {thursdays.length} četvrtaka
              {thursdays.length > 0 && (
                <span className="ml-1.5 font-normal normal-case text-slate-400">
                  ({thursdays.map(d => shortDate(d)).join(', ')})
                </span>
              )}
            </p>
            {thursdays.length === 0 ? (
              <p className="text-[12px] text-slate-300 italic">Nema četvrtaka u ovom mjesecu.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <QuickBtn label="Klanjanje (četvrtak)" cat="POBOZNOST"
                  onClick={openAdoration} count={thursdays.length} />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[modal.category].dot }} />
                  <h2 className="text-[17px] font-semibold text-slate-900">
                    {modal.title}
                    {modal.fixedTime && (
                      <span className="ml-1.5 text-[15px] font-normal text-slate-500">· {modal.fixedTime}</span>
                    )}
                  </h2>
                </div>
                <p className="text-[12px] text-slate-400 ml-3.5">
                  {CAT_HR[modal.category]} · {monthLabel}
                  {effectiveDate && (
                    <> · <span className="text-slate-600 font-medium">{fullDateLabel(effectiveDate)}</span></>
                  )}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xl mt-0.5"
              >×</button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {modal.error && (
                <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
                  {modal.error}
                </div>
              )}

              {/* Day selector — shown for all modal types */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  {modal.kind === 'sunday-mass'
                    ? 'Nedjelja *'
                    : modal.kind === 'adoration'
                    ? 'Četvrtak *'
                    : 'Dan *'}
                </label>
                {modal.availableDates.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic">Nema dostupnih datuma u ovom mjesecu.</p>
                ) : (
                  <select
                    value={modal.selectedDayIso}
                    onChange={e => update('selectedDayIso', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', appearance: 'none', paddingRight: '2.5rem' }}
                  >
                    {modal.availableDates.map(d => (
                      <option key={isoDate(d)} value={isoDate(d)}>
                        {HR_WEEKDAYS_FULL[d.getDay()]}, {d.getDate()}. {HR_MONTHS_SHORT[d.getMonth()]} {d.getFullYear()}.
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Time selector (adoration only — other kinds have fixedTime) */}
              {modal.kind === 'adoration' && (
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Vrijeme *
                  </label>
                  <TimeSelect
                    value={modal.customTime}
                    onChange={v => update('customTime', v)}
                    className="w-full"
                  />
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Bilješka <span className="font-normal text-slate-400">(opcionalno)</span>
                </label>
                <textarea
                  value={modal.note}
                  onChange={e => update('note', e.target.value)}
                  rows={2}
                  placeholder="Napomene, lokacija…"
                  className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-5 py-2.5 text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modal.saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                    Dodaje…
                  </span>
                ) : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
