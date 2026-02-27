import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, AvailabilitySlot } from '../lib/supabase'
import Navigation from '../components/Navigation'

// ── Croatian locale helpers ─────────────────────────────────
const HR_MONTHS: Record<number, string> = {
  0: 'siječnja', 1: 'veljače', 2: 'ožujka', 3: 'travnja',
  4: 'svibnja', 5: 'lipnja', 6: 'srpnja', 7: 'kolovoza',
  8: 'rujna', 9: 'listopada', 10: 'studenoga', 11: 'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0: 'nedjelja', 1: 'ponedjeljak', 2: 'utorak', 3: 'srijeda',
  4: 'četvrtak', 5: 'petak', 6: 'subota',
}
const HR_WEEKDAYS_CAP: Record<number, string> = {
  0: 'Nedjelja', 1: 'Ponedjeljak', 2: 'Utorak', 3: 'Srijeda',
  4: 'Četvrtak', 5: 'Petak', 6: 'Subota',
}

function formatSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${HR_WEEKDAYS_CAP[d.getDay()]}, ${d.getDate()}. ${HR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`
}
function formatSlotDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${HR_WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${HR_MONTHS[d.getMonth()]}`
}

// ── Time arithmetic ─────────────────────────────────────────
/** Converts 'HH:MM' to minutes from midnight. */
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
/** Converts minutes from midnight to zero-padded 'HH:MM'. */
function toStr(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// ── Smart slot logic ────────────────────────────────────────
interface ActiveBookingTime {
  availability_slot_id: string
  requested_start_time: string | null
  requested_end_time:   string | null
}

const DURATION_OPTIONS = [30, 60, 90, 120]

/**
 * For a given availability window and its existing bookings,
 * returns all valid start times (every 30 min) for the requested duration.
 * A start time is valid when [t, t+duration] fits within the window
 * without overlapping any existing PENDING/CONFIRMED booking.
 */
function getAvailableStartTimes(
  slot: AvailabilitySlot,
  bookingsForSlot: ActiveBookingTime[],
  durationMin: number,
): string[] {
  const slotStart = toMin(slot.start_time)
  const slotEnd   = toMin(slot.end_time)
  if (slotEnd - slotStart < durationMin) return []

  // Build list of blocked ranges from existing bookings
  const blocked = bookingsForSlot
    .filter(b => b.requested_start_time && b.requested_end_time)
    .map(b => ({ start: toMin(b.requested_start_time!), end: toMin(b.requested_end_time!) }))

  const valid: string[] = []
  for (let t = slotStart; t + durationMin <= slotEnd; t += 30) {
    const candidateEnd = t + durationMin
    const overlaps = blocked.some(r => t < r.end && candidateEnd > r.start)
    if (!overlaps) valid.push(toStr(t))
  }
  return valid
}

// ── Component ───────────────────────────────────────────────
export default function RequestBooking() {
  const { userProfile } = useAuth()

  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [activeBookings, setActiveBookings] = useState<ActiveBookingTime[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Modal
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [duration, setDuration] = useState(60)
  const [startTime, setStartTime] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    if (userProfile) fetchData()
  }, [userProfile])

  async function fetchData() {
    try {
      setLoading(true)
      setFetchError(null)
      const [{ data: slotsData, error: sErr }, { data: bookData, error: bErr }] = await Promise.all([
        supabase
          .from('availability_slots')
          .select('*')
          .eq('is_active', true)
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('bookings')
          .select('availability_slot_id, requested_start_time, requested_end_time, status')
          .in('status', ['PENDING', 'CONFIRMED']),
      ])
      if (sErr) throw sErr
      if (bErr) throw bErr
      setSlots(slotsData || [])
      setActiveBookings(bookData || [])
    } catch (err) {
      setFetchError('Nije moguće učitati slobodne termine.')
    } finally {
      setLoading(false)
    }
  }

  function openModal(slot: AvailabilitySlot) {
    setSelectedSlot(slot)
    setDuration(60)
    setStartTime('')
    setFirstName('')
    setLastName('')
    setPhone('')
    setReason('')
    setSubmitError(null)
  }

  function closeModal() {
    setSelectedSlot(null)
    setSubmitError(null)
  }

  // Bookings for the currently selected slot
  const bookingsForSlot = useMemo(
    () => activeBookings.filter(b => b.availability_slot_id === selectedSlot?.id),
    [activeBookings, selectedSlot],
  )

  // Recompute valid start times when slot or duration changes
  const availableStartTimes = useMemo(
    () => selectedSlot ? getAvailableStartTimes(selectedSlot, bookingsForSlot, duration) : [],
    [selectedSlot, bookingsForSlot, duration],
  )

  // Auto-select first valid time whenever duration or slot changes
  useEffect(() => {
    setStartTime(availableStartTimes[0] ?? '')
  }, [availableStartTimes])

  const endTime = startTime ? toStr(toMin(startTime) + duration) : ''

  const canSubmit =
    !submitting &&
    !!startTime &&
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    phone.trim() !== '' &&
    reason.trim() !== ''

  async function handleSubmit() {
    if (!canSubmit || !selectedSlot || !userProfile) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      // Server-side overlap guard — HH:MM lexicographic comparison works because values are zero-padded
      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id')
        .eq('availability_slot_id', selectedSlot.id)
        .in('status', ['PENDING', 'CONFIRMED'])
        .not('requested_start_time', 'is', null)
        .lt('requested_start_time', endTime)   // existing.start < new.end
        .gt('requested_end_time', startTime)   // existing.end   > new.start

      if (conflicts && conflicts.length > 0) {
        // Race condition — someone just booked this slot
        setSubmitError('Odabrani termin je u međuvremenu zauzet. Molimo odaberite drugi termin.')
        await fetchData()  // Refresh so the UI shows updated free times
        return
      }

      const { data: insertedRows, error } = await supabase
        .from('bookings')
        .insert({
          availability_slot_id:   selectedSlot.id,
          parishioner_id:         userProfile.id,
          parishioner_first_name: firstName.trim(),
          parishioner_last_name:  lastName.trim(),
          parishioner_phone:      phone.trim(),
          purpose:                reason.trim(),
          requested_start_time:   startTime,
          requested_end_time:     endTime,
          duration_minutes:       duration,
          status:                 'PENDING',
        })
        .select('id')
        .single()
      if (error) throw error

      // Notify priest of new pending booking (fire-and-forget — don't block UI)
      if (insertedRows?.id) {
        supabase.functions
          .invoke('notify-priest-new-booking', { body: { bookingId: insertedRows.id } })
          .then(async ({ error: fnErr, data }) => {
            if (fnErr) {
              let detail = ''
              if (fnErr && typeof fnErr === 'object' && 'context' in fnErr && fnErr.context) {
                try {
                  const ctx = fnErr.context as { json?: () => Promise<unknown> }
                  if (typeof ctx.json === 'function') {
                    const body = await ctx.json()
                    detail = JSON.stringify(body)
                  }
                } catch { /* ignore */ }
              }
              console.error('[RequestBooking] notify-priest-new-booking failed:', fnErr.message, detail || '')
            } else {
              console.log('[RequestBooking] Priest notification sent for booking', insertedRows.id, data)
            }
          })
      }

      closeModal()
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 7000)
      fetchData()
      window.dispatchEvent(new Event('bookings-updated'))
    } catch (err: unknown) {
      console.error(err)
      // DB trigger raises 'booking_overlap' on slot conflict — show user-friendly message
      const msg = err instanceof Object && 'message' in err ? String((err as {message:string}).message) : ''
      if (msg.includes('booking_overlap') || msg.includes('preklapa')) {
        setSubmitError('Odabrani termin je zauzet. Molimo odaberite drugi termin.')
        await fetchData()
      } else {
        setSubmitError('Nije moguće poslati zahtjev. Molimo pokušajte ponovo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7fa]">
        <Navigation />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-4">
          <div className="w-8 h-8 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-[14px] text-slate-400 font-medium">Učitavanje slobodnih termina…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f7fa]">
      <Navigation />
      <div className="max-w-[760px] mx-auto px-6 py-8">
        <div className="mb-7">
          <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">Zatraži susret</h1>
          <p className="text-[14px] text-slate-400 mt-1">Odaberite slobodan termin i unesite podatke za rezervaciju</p>
        </div>

        {fetchError && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
            {fetchError}
          </div>
        )}

        {submitSuccess && (
          <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[13px] text-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Zahtjev je uspješno poslan. Svećenik će vas obavijestiti s potvrdom.
          </div>
        )}

        {slots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
            </div>
            <p className="text-[16px] font-semibold text-slate-700 mb-1">Nema slobodnih termina</p>
            <p className="text-[13px] text-slate-400">Svećenik još nije definirao slobodne termine. Molimo provjerite ponovo kasnije.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              // Compute if slot has any free 30-min window (for at least 30 min duration)
              const slotBookings = activeBookings.filter(b => b.availability_slot_id === slot.id)
              const hasAnyFreeTime = getAvailableStartTimes(slot, slotBookings, 30).length > 0
              const totalMin = toMin(slot.end_time) - toMin(slot.start_time)

              return (
                <div
                  key={slot.id}
                  className={`bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center justify-between gap-4 ${!hasAnyFreeTime ? 'opacity-60' : ''}`}
                >
                  <div>
                    <p className="text-[15px] font-semibold text-slate-800 capitalize">
                      {formatSlotDate(slot.date)}
                    </p>
                    <p className="text-[13px] text-slate-400 mt-0.5">
                      Dostupnost: {slot.start_time} – {slot.end_time}
                      <span className="ml-2 text-slate-300">·</span>
                      <span className="ml-2 text-slate-400">{totalMin} min ukupno</span>
                    </p>
                  </div>
                  <button
                    onClick={() => openModal(slot)}
                    disabled={!hasAnyFreeTime}
                    className="shrink-0 px-4 py-2 text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {hasAnyFreeTime ? 'Rezerviraj' : 'Popunjeno'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Booking modal ── */}
      {selectedSlot && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[94vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900">Zatraži rezervaciju</h2>
                <p className="text-[13px] text-slate-400 mt-0.5 capitalize">
                  {formatSlotDateShort(selectedSlot.date)}
                  &nbsp;·&nbsp;
                  Dostupnost {selectedSlot.start_time} – {selectedSlot.end_time}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xl mt-0.5"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {submitError && (
                <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
                  {submitError}
                </div>
              )}

              {/* ── Duration picker ── */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Trajanje susreta
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map(d => {
                    const avail = getAvailableStartTimes(selectedSlot, bookingsForSlot, d)
                    const hasTime = avail.length > 0
                    return (
                      <button
                        key={d}
                        onClick={() => { setDuration(d) }}
                        disabled={!hasTime}
                        className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                          duration === d
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : hasTime
                              ? 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                              : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                        }`}
                      >
                        {d} min
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Start time picker ── */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Početak susreta
                </label>
                {availableStartTimes.length === 0 ? (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[13px] text-amber-700">
                    Nema slobodnih termina za odabrano trajanje. Odaberite kraće trajanje.
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {availableStartTimes.map(t => (
                      <button
                        key={t}
                        onClick={() => setStartTime(t)}
                        className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                          startTime === t
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* End time — read-only preview */}
              {startTime && endTime && (
                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[13px] text-slate-600">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Susret: <strong>{startTime} – {endTime}</strong>
                  <span className="text-slate-400 ml-1">({duration} min)</span>
                </div>
              )}

              {/* ── Divider ── */}
              <div className="h-px bg-slate-100" />

              {/* ── Personal info ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Ime *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Vaše ime"
                    className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Prezime *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Vaše prezime"
                    className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Broj mobitela *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="npr. +385 91 234 5678"
                  className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Razlog susreta *
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="Ukratko opišite razlog i svrhu susreta…"
                  className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
              <p className="text-[12px] text-slate-400">* Obavezna polja</p>
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Odustani
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-5 py-2.5 text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Šalje se…
                    </span>
                  ) : 'Pošalji zahtjev'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
