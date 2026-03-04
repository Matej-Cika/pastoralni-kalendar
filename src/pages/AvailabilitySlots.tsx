import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, AvailabilitySlot } from '../lib/supabase'
import Navigation from '../components/Navigation'
import TimeSelect from '../components/TimeSelect'

const HR_MONTHS: Record<number, string> = {
  0: 'siječnja', 1: 'veljače', 2: 'ožujka', 3: 'travnja',
  4: 'svibnja', 5: 'lipnja', 6: 'srpnja', 7: 'kolovoza',
  8: 'rujna', 9: 'listopada', 10: 'studenoga', 11: 'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0: 'nedjelja', 1: 'ponedjeljak', 2: 'utorak', 3: 'srijeda',
  4: 'četvrtak', 5: 'petak', 6: 'subota',
}

function formatSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${HR_WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${HR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`
}

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Priest display: fully booked & past (same 30 min + 15 buffer as parishioner booking) ─
const MEETING_DURATION_MIN = 30
const SLOT_STEP_MIN = 45

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function toStr(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

interface ActiveBookingRow {
  availability_slot_id: string
  requested_start_time: string | null
  requested_end_time: string | null
}

function getAvailableStartTimesForSlot(slot: AvailabilitySlot, bookingsForSlot: ActiveBookingRow[]): string[] {
  const slotStart = toMin(slot.start_time)
  const slotEnd = toMin(slot.end_time)
  if (slotEnd - slotStart < MEETING_DURATION_MIN) return []

  const valid: string[] = []
  let current = slotStart
  while (current + MEETING_DURATION_MIN <= slotEnd) {
    valid.push(toStr(current))
    current += SLOT_STEP_MIN
  }
  const blocked = bookingsForSlot
    .filter(b => b.requested_start_time && b.requested_end_time)
    .map(b => ({ start: toMin(b.requested_start_time!), end: toMin(b.requested_end_time!) }))
  return valid.filter(tStr => {
    const tMin = toMin(tStr)
    const meetingEnd = tMin + MEETING_DURATION_MIN
    const overlaps = blocked.some(r => tMin < r.end && meetingEnd > r.start)
    return !overlaps
  })
}

function isSlotPast(slot: AvailabilitySlot): boolean {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (slot.date < todayStr) return true
  if (slot.date > todayStr) return false
  const endTime = (slot.end_time || '').slice(0, 5)
  if (!endTime || endTime.length < 5) return false
  const endLocal = new Date(`${slot.date}T${endTime}:00`)
  if (Number.isNaN(endLocal.getTime())) return false
  return endLocal.getTime() <= Date.now()
}

export default function AvailabilitySlots() {
  const { userProfile } = useAuth()
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [activeBookings, setActiveBookings] = useState<ActiveBookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete state
  const [confirmDeleteSlotId, setConfirmDeleteSlotId] = useState<string | null>(null)
  const [deletingSlot, setDeletingSlot] = useState(false)
  const [deleteSlotError, setDeleteSlotError] = useState<string | null>(null)

  const [newSlot, setNewSlot] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    is_active: true,
  })

  useEffect(() => {
    if (userProfile) fetchSlots()
  }, [userProfile])

  async function fetchSlots() {
    try {
      setLoading(true)
      setFetchError(null)
      const [{ data: slotsData, error: slotsErr }, { data: bookData, error: bookErr }] = await Promise.all([
        supabase
          .from('availability_slots')
          .select('*')
          .order('date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('bookings')
          .select('availability_slot_id, requested_start_time, requested_end_time')
          .in('status', ['PENDING', 'CONFIRMED']),
      ])
      if (slotsErr) throw slotsErr
      if (bookErr) throw bookErr
      // Only show current/future availabilities; past ones stay in DB for completed meetings
      setSlots((slotsData || []).filter(slot => !isSlotPast(slot)))
      setActiveBookings(bookData || [])
    } catch (err) {
      console.error('Greška pri dohvatu termina:', err)
      setFetchError('Nije moguće učitati termine.')
    } finally {
      setLoading(false)
    }
  }

  async function createSlot() {
    setCreating(true)
    setCreateError(null)
    try {
      // ── Conflict check ──────────────────────────────────────
      // Convert proposed slot times to Date objects for overlap comparison.
      // new Date('YYYY-MM-DDTHH:MM:00') is parsed as local time in browsers,
      // matching how event start_time values were originally saved.
      const slotStart = new Date(`${newSlot.date}T${newSlot.start_time}:00`)
      const slotEnd   = new Date(`${newSlot.date}T${newSlot.end_time}:00`)
      const dayStart  = new Date(`${newSlot.date}T00:00:00`).toISOString()
      const dayEnd    = new Date(`${newSlot.date}T23:59:59`).toISOString()

      const [{ data: calEvents }, { data: existingSlots }] = await Promise.all([
        // All non-deleted calendar events on that day
        supabase
          .from('events')
          .select('title, start_time, end_time')
          .eq('is_deleted', false)
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd),
        // Existing availability slots on the same date
        supabase
          .from('availability_slots')
          .select('start_time, end_time')
          .eq('date', newSlot.date),
      ])

      // Standard interval overlap: A.start < B.end  AND  A.end > B.start
      const conflictingEvents = (calEvents ?? []).filter(e => {
        const eStart = new Date(e.start_time)
        const eEnd   = new Date(e.end_time)
        return eStart < slotEnd && eEnd > slotStart
      })

      const conflictingSlots = (existingSlots ?? []).filter(s =>
        newSlot.start_time < s.end_time && newSlot.end_time > s.start_time
      )

      if (conflictingEvents.length > 0) {
        const list = conflictingEvents
          .map(e => `„${e.title}" (${formatEventTime(e.start_time)}–${formatEventTime(e.end_time)})`)
          .join(', ')
        setCreateError(
          `Predloženi termin se preklapa s već upisanim kalendarskim unosom: ${list}. Odaberite drugi datum ili vrijeme.`
        )
        return
      }

      if (conflictingSlots.length > 0) {
        const list = conflictingSlots.map(s => `${s.start_time}–${s.end_time}`).join(', ')
        setCreateError(
          `Na odabrani dan već postoji dostupnost koja se preklapa: ${list}. Odaberite drugi raspon vremena.`
        )
        return
      }
      // ── End conflict check ──────────────────────────────────

      const { error } = await supabase.from('availability_slots').insert(newSlot)
      if (error) throw error
      setShowCreateModal(false)
      setNewSlot({
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '10:00',
        is_active: true,
      })
      fetchSlots()
    } catch (err) {
      console.error('Greška pri kreiranju termina:', err)
      setCreateError('Nije moguće kreirati termin. Molimo pokušajte ponovo.')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(slotId: string, current: boolean) {
    try {
      const { error } = await supabase
        .from('availability_slots')
        .update({ is_active: !current })
        .eq('id', slotId)
      if (error) throw error
      fetchSlots()
    } catch (err) {
      console.error('Greška pri ažuriranju termina:', err)
    }
  }

  /**
   * Permanently deletes an availability slot.
   * First cancels all PENDING/CONFIRMED bookings tied to it,
   * then removes the slot record from the database.
   */
  async function deleteSlot(slotId: string) {
    setDeletingSlot(true)
    setDeleteSlotError(null)
    try {
      // Find all active bookings on this slot so we can clean up their events
      const { data: activeBookings } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('availability_slot_id', slotId)
        .in('status', ['PENDING', 'CONFIRMED'])

      const pendingIds = (activeBookings ?? []).filter(b => b.status === 'PENDING').map(b => b.id)
      const confirmedIds = (activeBookings ?? []).filter(b => b.status === 'CONFIRMED').map(b => b.id)
      const allAffected = [...pendingIds, ...confirmedIds]

      // Cancel the bookings (set cancelled_from_status for stats)
      if (pendingIds.length > 0) {
        await supabase.from('bookings').update({
          status: 'CANCELLED',
          cancelled_by: 'PRIEST',
          cancelled_from_status: 'PENDING',
        }).in('id', pendingIds)
      }
      if (confirmedIds.length > 0) {
        await supabase.from('bookings').update({
          status: 'CANCELLED',
          cancelled_by: 'PRIEST',
          cancelled_from_status: 'CONFIRMED',
        }).in('id', confirmedIds)
      }

      if (allAffected.length > 0) {
        // Soft-delete their calendar events
        await supabase
          .from('events')
          .update({ is_deleted: true })
          .in('booking_id', allAffected)
          .eq('is_deleted', false)
      }

      const { error } = await supabase
        .from('availability_slots')
        .delete()
        .eq('id', slotId)
      if (error) throw error

      setConfirmDeleteSlotId(null)
      fetchSlots()
      window.dispatchEvent(new Event('bookings-updated'))
    } catch (err) {
      console.error('Greška pri brisanju termina:', err)
      setDeleteSlotError('Nije moguće obrisati termin. Molimo pokušajte ponovo.')
    } finally {
      setDeletingSlot(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7fa]">
        <Navigation />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-4">
          <div className="w-8 h-8 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-[14px] text-slate-400 font-medium">Učitavanje termina…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f7fa]">
      <Navigation />
      <div className="max-w-[760px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="mb-5 sm:mb-7 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] sm:text-[26px] font-semibold text-slate-900 tracking-tight">Slobodni termini</h1>
            <p className="text-[13px] sm:text-[14px] text-slate-400 mt-0.5 sm:mt-1">Upravljanje dostupnošću</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[12px] sm:text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Novi termin</span>
            <span className="sm:hidden">Novi</span>
          </button>
        </div>

        {fetchError && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
            {fetchError}
          </div>
        )}

        {slots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <p className="text-[16px] font-semibold text-slate-700 mb-1">Nema kreiranih termina</p>
            <p className="text-[13px] text-slate-400">Dodajte slobodne termine kako bi župljani mogli zakazati susrete.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              const bookingsForSlot = activeBookings.filter(b => b.availability_slot_id === slot.id)
              const availableCount = getAvailableStartTimesForSlot(slot, bookingsForSlot).length
              const isFullyBooked = slot.is_active && availableCount === 0

              return (
                <div
                  key={slot.id}
                  className={`bg-white rounded-2xl border border-slate-200 px-4 sm:px-5 py-3.5 sm:py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${!slot.is_active ? 'opacity-60' : ''}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-[14px] sm:text-[15px] font-semibold text-slate-800 capitalize">
                        {formatSlotDate(slot.date)}
                      </p>
                      <p className="text-[13px] text-slate-400 mt-0.5">
                        {slot.start_time} – {slot.end_time}
                      </p>
                      <span
                        className={`inline-block mt-2 px-2.5 py-1 rounded-lg text-[12px] font-medium border ${
                          isFullyBooked
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : slot.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {isFullyBooked ? 'Popunjeno' : slot.is_active ? 'Aktivan' : 'Neaktivan'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(slot.id, slot.is_active)}
                        className={`px-4 py-2 text-[13px] font-medium rounded-xl transition-colors ${
                          slot.is_active
                            ? 'text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                            : 'text-white bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {slot.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteSlotId(slot.id); setDeleteSlotError(null) }}
                        className="px-4 py-2 text-[13px] font-medium text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                      >
                        Obriši
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {confirmDeleteSlotId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={() => { setConfirmDeleteSlotId(null); setDeleteSlotError(null) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">Obriši termin</h3>
                <p className="text-[12px] text-slate-400 mt-0.5">Ova radnja je trajna</p>
              </div>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              Termin će biti trajno obrisan. Aktivne rezervacije (na čekanju i potvrđene) bit će <strong>otkazane</strong>. Završeni susreti ostaju u statistici kao odrađene.
            </p>
            {deleteSlotError && (
              <p className="mb-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
                {deleteSlotError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmDeleteSlotId(null); setDeleteSlotError(null) }}
                className="px-5 py-2.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={() => deleteSlot(confirmDeleteSlotId)}
                disabled={deletingSlot}
                className="px-5 py-2.5 text-[13px] font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingSlot ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Briše…
                  </span>
                ) : 'Obriši termin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create slot modal ── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
              <h2 className="text-[17px] font-semibold text-slate-900">Novi slobodni termin</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xl"
              >
                ×
              </button>
            </div>
            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              {createError && (
                <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Datum *
                </label>
                <input
                  type="date"
                  value={newSlot.date}
                  onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Početak *
                  </label>
                  <TimeSelect
                    value={newSlot.start_time}
                    onChange={(v) => {
                      // If end time is now ≤ new start time, clear it
                      const endTime = newSlot.end_time && newSlot.end_time <= v ? '' : newSlot.end_time
                      setNewSlot({ ...newSlot, start_time: v, end_time: endTime })
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Kraj *
                  </label>
                  <TimeSelect
                    value={newSlot.end_time}
                    onChange={(v) => setNewSlot({ ...newSlot, end_time: v })}
                    minTime={newSlot.start_time || undefined}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={createSlot}
                disabled={creating}
                className="px-5 py-2.5 text-[13px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sprema…
                  </span>
                ) : 'Kreiraj termin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
