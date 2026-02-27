import { useState } from 'react'
import { supabase, EventCategory } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TimeSelect from './TimeSelect'

interface Entry {
  id?: string
  title: string
  startTime: string
  endTime: string
  notes: string
}

interface CellEntryModalProps {
  date: Date
  category: EventCategory
  existingEvents: any[]
  onClose: () => void
  onSuccess: () => void
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  POBOZNOST: 'Pobožnosti',
  AKTIVNOST: 'Aktivnosti',
  SAKRAMENT: 'Sakramenti',
}

const PLACEHOLDERS: Record<EventCategory, string> = {
  POBOZNOST: 'npr. Euharistijsko klanjanje, Srijeda Sv.Josipu, trodnevnice…',
  AKTIVNOST: 'npr. Pohod obitelji, Pastoralni razgovor…',
  SAKRAMENT: 'npr. Sveta misa, Krštenje, Vjenčanje, Ispovijed…',
}

const ACCENT: Record<EventCategory, { ring: string; btn: string }> = {
  POBOZNOST: { ring: '#a78bfa', btn: 'bg-violet-600 hover:bg-violet-700' },
  AKTIVNOST: { ring: '#6ee7b7', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  SAKRAMENT: { ring: '#fcd34d', btn: 'bg-amber-600 hover:bg-amber-700' },
}

const HR_MONTHS: Record<number, string> = {
  0: 'siječnja', 1: 'veljače', 2: 'ožujka', 3: 'travnja',
  4: 'svibnja', 5: 'lipnja', 6: 'srpnja', 7: 'kolovoza',
  8: 'rujna', 9: 'listopada', 10: 'studenoga', 11: 'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0: 'Nedjelja', 1: 'Ponedjeljak', 2: 'Utorak', 3: 'Srijeda',
  4: 'Četvrtak', 5: 'Petak', 6: 'Subota',
}

export default function CellEntryModal({ date, category, existingEvents, onClose, onSuccess }: CellEntryModalProps) {
  const { user } = useAuth()

  const [entries, setEntries] = useState<Entry[]>(
    existingEvents.length > 0
      ? existingEvents.map((e) => ({
        id: e.id,
        title: e.title || '',
        startTime: e.start_time ? new Date(e.start_time).toTimeString().slice(0, 5) : '',
        endTime: e.end_time ? new Date(e.end_time).toTimeString().slice(0, 5) : '',
        notes: e.description || '',
      }))
      : [{ title: '', startTime: '', endTime: '', notes: '' }]
  )

  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete state
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const accent = ACCENT[category]

  /** Adds a blank new entry to the list (not yet saved). */
  function addEntry() {
    setEntries([...entries, { title: '', startTime: '', endTime: '', notes: '' }])
  }

  /** Removes an unsaved (no id) entry from the local list without touching the DB. */
  function removeNewEntry(index: number) {
    setEntries(entries.filter((_, i) => i !== index))
  }

  /** Soft-deletes a saved event from the DB, then removes it from the local list. */
  async function handleDeleteEntry(index: number) {
    const entry = entries[index]
    setDeletingIdx(index)
    setDeleteError(null)

    try {
      if (entry.id) {
        const { error } = await supabase
          .from('events')
          .update({ is_deleted: true })
          .eq('id', entry.id)
        if (error) throw error
      }

      const remaining = entries.filter((_, i) => i !== index)
      setConfirmDeleteIdx(null)

      if (remaining.length === 0) {
        // All entries in this cell are gone — close modal and refresh calendar
        onSuccess()
      } else {
        setEntries(remaining)
      }
    } catch (err) {
      console.error('Greška pri brisanju:', err)
      setDeleteError('Nije moguće obrisati unos. Molimo pokušajte ponovo.')
    } finally {
      setDeletingIdx(null)
    }
  }

  function updateEntry(index: number, field: keyof Entry, value: string) {
    const updated = [...entries]
    updated[index] = { ...updated[index], [field]: value }
    // If start time is pushed later, clear a now-invalid end time
    if (field === 'startTime' && updated[index].endTime && updated[index].endTime <= value) {
      updated[index].endTime = ''
    }
    setEntries(updated)
  }

  /** Returns a Croatian error string if end <= start, otherwise null. */
  function timeRangeError(start: string, end: string): string | null {
    if (start && end && end <= start) {
      return 'Vrijeme završetka mora biti nakon vremena početka.'
    }
    return null
  }

  function buildDateTime(base: Date, timeStr: string): Date {
    const d = new Date(base)
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number)
      d.setHours(h, m, 0, 0)
    } else {
      d.setHours(0, 0, 0, 0)
    }
    return d
  }

  const COLORS: Record<EventCategory, string> = {
    POBOZNOST: '#7c3aed',
    AKTIVNOST: '#16a34a',
    SAKRAMENT: '#b45309',
  }

  async function handleSave() {
    if (!user) return
    const toSave = entries.filter((e) => e.title.trim())
    if (toSave.length === 0) return

    const invalidEntry = toSave.find(e => timeRangeError(e.startTime, e.endTime))
    if (invalidEntry) {
      setSaveError('Ispravite neispravna vremena prije spremanja.')
      return
    }

    setLoading(true)
    setSaveError(null)

    try {
      for (const entry of toSave) {
        const startDT = buildDateTime(date, entry.startTime)
        const endDT = entry.endTime
          ? buildDateTime(date, entry.endTime)
          : new Date(startDT.getTime() + 60 * 60 * 1000)

        const payload = {
          title: entry.title.trim(),
          description: entry.notes.trim() || null,
          start_time: startDT.toISOString(),
          end_time: endDT.toISOString(),
          event_type: category,
          color: COLORS[category],
          is_private: false,
          created_by: user.id,
          is_deleted: false,
        }

        if (entry.id) {
          const { error } = await supabase.from('events').update(payload).eq('id', entry.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('events').insert(payload)
          if (error) throw error
        }
      }
      onSuccess()
    } catch (err) {
      console.error('Greška pri spremanju:', err)
      setSaveError('Nije moguće spremiti unose. Molimo pokušajte ponovo.')
    } finally {
      setLoading(false)
    }
  }

  const dateLabel = `${HR_WEEKDAYS[date.getDay()]}, ${date.getDate()}. ${HR_MONTHS[date.getMonth()]} ${date.getFullYear()}.`
  const isBusy = loading || deletingIdx !== null

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto mx-2 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between px-4 sm:px-7 py-4 sm:py-5 border-b border-slate-100">
          <div>
            <h2 className="text-[18px] font-semibold text-slate-900">{CATEGORY_LABELS[category]}</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Entries */}
        <div className="px-4 sm:px-7 py-4 sm:py-5 space-y-4">
          {/* Error messages */}
          {(saveError || deleteError) && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
              {saveError || deleteError}
            </div>
          )}

          {entries.map((entry, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              {/* Entry header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">
                  Unos {idx + 1}
                </span>

                <div className="flex items-center gap-2">
                  {entry.id ? (
                    // Saved event — show delete with inline confirmation
                    confirmDeleteIdx === idx ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-slate-500">Obrisati unos?</span>
                        <button
                          onClick={() => handleDeleteEntry(idx)}
                          disabled={deletingIdx === idx}
                          className="px-2.5 py-1 text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingIdx === idx ? 'Briše…' : 'Obriši'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteIdx(null)}
                          className="px-2 py-1 text-[12px] font-medium text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
                        >
                          Odustani
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setConfirmDeleteIdx(idx); setDeleteError(null) }}
                        className="flex items-center gap-1 text-[12px] font-medium text-red-400 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Obriši
                      </button>
                    )
                  ) : (
                    // Unsaved entry — show remove only when there are multiple entries
                    entries.length > 1 && (
                      <button
                        onClick={() => removeNewEntry(idx)}
                        className="text-[12px] text-slate-400 hover:text-slate-600 font-medium transition-colors"
                      >
                        Ukloni
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* Title */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Naziv *
                  </label>
                  <input
                    type="text"
                    value={entry.title}
                    onChange={(e) => updateEntry(idx, 'title', e.target.value)}
                    placeholder={PLACEHOLDERS[category]}
                    className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                  />
                </div>

                {/* Times */}
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                        Početak
                      </label>
                      <TimeSelect
                        value={entry.startTime}
                        onChange={v => updateEntry(idx, 'startTime', v)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                        Kraj
                      </label>
                      <TimeSelect
                        value={entry.endTime}
                        onChange={v => updateEntry(idx, 'endTime', v)}
                        minTime={entry.startTime || undefined}
                        className="w-full"
                      />
                    </div>
                  </div>
                  {timeRangeError(entry.startTime, entry.endTime) && (
                    <p className="mt-1.5 text-[12px] text-red-500 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {timeRangeError(entry.startTime, entry.endTime)}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Bilješke
                  </label>
                  <textarea
                    value={entry.notes}
                    onChange={(e) => updateEntry(idx, 'notes', e.target.value)}
                    rows={2}
                    placeholder="Napomene, osobe, lokacija…"
                    className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300 resize-none"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add entry */}
          <button
            onClick={addEntry}
            className="flex items-center gap-2 text-[13px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Dodaj još jedan unos
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 sm:px-7 py-4 sm:py-5 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Odustani
          </button>
          <button
            onClick={handleSave}
            disabled={
              isBusy ||
              entries.every((e) => !e.title.trim()) ||
              entries.some((e) => timeRangeError(e.startTime, e.endTime) !== null)
            }
            className={`px-5 py-2.5 text-[13px] font-medium text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${accent.btn}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Sprema…
              </span>
            ) : 'Spremi'}
          </button>
        </div>
      </div>
    </div>
  )
}
