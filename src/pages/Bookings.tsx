import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, Booking, BookingStatus, User } from '../lib/supabase'
import Navigation from '../components/Navigation'

// ── Locale ────────────────────────────────────────────────
const HR_MONTHS: Record<number, string> = {
  0:'siječnja',1:'veljače',2:'ožujka',3:'travnja',4:'svibnja',5:'lipnja',
  6:'srpnja',7:'kolovoza',8:'rujna',9:'listopada',10:'studenoga',11:'prosinca',
}
const HR_MONTHS_LONG: Record<number, string> = {
  0:'Siječanj',1:'Veljača',2:'Ožujak',3:'Travanj',4:'Svibanj',5:'Lipanj',
  6:'Srpanj',7:'Kolovoz',8:'Rujan',9:'Listopad',10:'Studeni',11:'Prosinac',
}
const HR_WEEKDAYS: Record<number, string> = {
  0:'nedjelja',1:'ponedjeljak',2:'utorak',3:'srijeda',4:'četvrtak',5:'petak',6:'subota',
}

function formatDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${HR_WEEKDAYS[dt.getDay()]}, ${dt.getDate()}. ${HR_MONTHS[dt.getMonth()]} ${dt.getFullYear()}.`
}
function formatMonthYear(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${HR_MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`
}

const STATUS_LABELS: Record<BookingStatus, string> = { PENDING:'Na čekanju', CONFIRMED:'Potvrđeno', CANCELLED:'Otkazano', COMPLETED:'Odradeno' }
const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING:   'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
  COMPLETED: 'bg-slate-100 text-slate-500 border-slate-200',
}

const TODAY       = new Date().toISOString().split('T')[0]
const TWO_DAYS_MS = 48 * 60 * 60 * 1000

function fullName(b: Booking) {
  const parts = [b.parishioner_first_name, b.parishioner_last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}
function timeLabel(b: Booking) {
  if (b.requested_start_time && b.requested_end_time) return `${b.requested_start_time} – ${b.requested_end_time}`
  const s = b.availability_slot
  return s ? `${s.start_time} – ${s.end_time}` : '—'
}
function slotDate(b: Booking) { return b.slot_date ?? b.availability_slot?.date ?? '' }
function isUpcoming(b: Booking) { return slotDate(b) >= TODAY }
function sortAsc(a: Booking, b: Booking)  { return (slotDate(a) + (a.requested_start_time ?? '')).localeCompare(slotDate(b) + (b.requested_start_time ?? '')) }
function sortDesc(a: Booking, b: Booking) { return sortAsc(b, a) }
function isRecentCancel(b: Booking)       { return Date.now() - new Date(b.updated_at || b.created_at).getTime() < TWO_DAYS_MS }

function groupByMonth(bookings: Booking[]) {
  const map: Record<string, Booking[]> = {}
  for (const b of bookings) { const k = slotDate(b).slice(0,7); (map[k] ??= []).push(b) }
  return Object.entries(map).sort(([a],[b]) => b.localeCompare(a)).map(([k,items]) => ({ label: formatMonthYear(k+'-01'), items }))
}

// ── Section header ─────────────────────────────────────────
function SectionHead({ dot, title, count, color = 'slate' }: { dot: string; title: string; count: number; color?: string }) {
  const dotColors: Record<string,string> = {
    amber:'bg-amber-500', emerald:'bg-emerald-500', indigo:'bg-indigo-500',
    red:'bg-red-400', slate:'bg-slate-300',
  }
  const badgeColors: Record<string,string> = {
    amber:'bg-amber-100 text-amber-700 border-amber-200',
    emerald:'bg-emerald-100 text-emerald-700 border-emerald-200',
    indigo:'bg-indigo-100 text-indigo-700 border-indigo-200',
    red:'bg-red-100 text-red-600 border-red-200',
    slate:'bg-slate-100 text-slate-500 border-slate-200',
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-2 h-2 rounded-full ${dotColors[dot]} ${dot==='amber'?'animate-pulse':''}`} />
      <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>
      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold border rounded-full ${badgeColors[color]}`}>
        {count}
      </span>
    </div>
  )
}

// ── PendingCard ────────────────────────────────────────────
interface PendingCardProps { booking: Booking; userProfile: User; updatingId: string|null; onUpdate: (id:string, status:BookingStatus)=>void }

function PendingCard({ booking, userProfile, updatingId, onUpdate }: PendingCardProps) {
  const isBusy = updatingId === booking.id
  const slot   = booking.availability_slot
  const [expanded, setExpanded]             = useState(false)
  const [history, setHistory]               = useState<Booking[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFetched, setHistoryFetched] = useState(false)
  const [note, setNote]         = useState('')
  const [noteSaved, setNoteSaved]   = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [noteSaving, setNoteSaving]   = useState(false)
  const [noteSuccess, setNoteSuccess] = useState(false)
  const [noteError, setNoteError]     = useState<string|null>(null)
  const [historyNotes, setHistoryNotes] = useState<Record<string, string>>({})

  async function loadDetails() {
    if (historyFetched) return
    setHistoryLoading(true); setNoteLoading(true)
    await Promise.all([
      (async () => {
        if (!booking.parishioner_phone) return
        const { data } = await supabase.from('bookings')
          .select('*, availability_slot:availability_slots(date, start_time, end_time)')
          .eq('parishioner_phone', booking.parishioner_phone)
          .in('status', ['CONFIRMED','CANCELLED','COMPLETED']).neq('id', booking.id)
          .order('created_at', { ascending: false }).limit(8)
        const rows = data ?? []
        setHistory(rows)
        // Fetch notes for all historical bookings
        if (rows.length > 0) {
          const ids = rows.map(b => b.id)
          const { data: notes } = await supabase.from('booking_notes').select('booking_id, note').in('booking_id', ids)
          const map: Record<string, string> = {}
          notes?.forEach(n => { map[n.booking_id] = n.note })
          setHistoryNotes(map)
        }
      })(),
      (async () => {
        const { data } = await supabase.from('booking_notes').select('*').eq('booking_id', booking.id).maybeSingle()
        if (data) { setNote(data.note); setNoteSaved(data.note) }
      })(),
    ])
    setHistoryLoading(false); setNoteLoading(false); setHistoryFetched(true)
  }

  async function saveNote() {
    if (!note.trim() && !noteSaved) return
    setNoteSaving(true); setNoteError(null)
    try {
      const { error } = await supabase.from('booking_notes').upsert(
        { booking_id: booking.id, priest_id: userProfile.id, note: note.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'booking_id' }
      )
      if (error) throw error
      setNoteSaved(note.trim()); setNoteSuccess(true); setTimeout(()=>setNoteSuccess(false),3000)
    } catch { setNoteError('Nije moguće spremiti bilješku.') } finally { setNoteSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-[0_2px_16px_rgba(217,119,6,0.10)] overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4 mb-3">
          <div>
            <p className="text-[16px] font-semibold text-slate-900">{fullName(booking)}</p>
            {booking.parishioner_phone && (
              <a href={`tel:${booking.parishioner_phone}`} className="text-[13px] text-indigo-600 hover:underline mt-0.5 inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.338c0 1.013.162 1.99.463 2.908A22.5 22.5 0 007.5 16.5a22.5 22.5 0 007.254 4.787 22.5 22.5 0 002.908.463c.636 0 1.151-.515 1.151-1.151V17.25a1.125 1.125 0 00-.832-1.087l-3.274-.818a1.125 1.125 0 00-1.342.796l-.24.957a.75.75 0 01-.847.54A12.077 12.077 0 016.9 12.403a.75.75 0 01.54-.847l.957-.24a1.125 1.125 0 00.796-1.342l-.818-3.274A1.125 1.125 0 007.288 5.25H4.588c-.636 0-1.151.515-1.151 1.151a13.5 13.5 0 00-.187-.063z"/></svg>
                {booking.parishioner_phone}
              </a>
            )}
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-medium border bg-amber-50 text-amber-700 border-amber-200">Na čekanju</span>
        </div>
        {slot && <div className="flex items-center gap-2 mb-1.5 text-[13px] text-slate-600">
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25"/></svg>
          <span className="capitalize font-medium">{formatDate(slot.date)}</span>
        </div>}
        <div className="flex items-center gap-2 mb-3 text-[13px] text-slate-600">
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span className="font-medium">{timeLabel(booking)}</span>
          {booking.duration_minutes && <span className="text-slate-400">· {booking.duration_minutes} min</span>}
        </div>
        {booking.purpose && (
          <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl mb-4 text-[13px] text-slate-700">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Razlog susreta</span>
            {booking.purpose}
          </div>
        )}
        <div className="flex gap-2 mb-3">
          <button onClick={()=>onUpdate(booking.id,'CONFIRMED')} disabled={isBusy}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isBusy ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> :
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>}
            Potvrdi
          </button>
          <button onClick={()=>onUpdate(booking.id,'CANCELLED')} disabled={isBusy}
            className="flex-1 py-2.5 text-[13px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {!isBusy && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>}
            Odbij
          </button>
        </div>
        <button onClick={()=>{ setExpanded(v=>!v); if(!expanded) loadDetails() }}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-slate-500 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
          {expanded ? 'Sakrij detalje' : 'Prethodne posjete i bilješka'}
        </button>
        {expanded && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Prethodne posjete · {booking.parishioner_phone ?? 'isti broj'}</p>
              {historyLoading ? (
                <div className="flex items-center gap-2 text-[13px] text-slate-400 py-2">
                  <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin"/>Učitavanje…
                </div>
              ) : history.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-1">Nema evidencije prethodnih posjeta.</p>
              ) : (
                <div className="space-y-2">
                  {history.map(h => {
                    const hs = h.availability_slot as {date:string;start_time:string;end_time:string}|undefined
                    return (
                      <div key={h.id} className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {hs && <p className="text-[13px] font-medium text-slate-700 capitalize">{formatDate(hs.date)}</p>}
                            <p className="text-[12px] text-slate-500">{h.requested_start_time && h.requested_end_time ? `${h.requested_start_time} – ${h.requested_end_time}` : hs ? `${hs.start_time} – ${hs.end_time}` : ''}</p>
                            {h.purpose && <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">{h.purpose}</p>}
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium border ${STATUS_STYLES[h.status]}`}>{STATUS_LABELS[h.status]}</span>
                        </div>
                        {historyNotes[h.id] && (
                          <div className="mt-2 flex items-start gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                            <svg className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                            </svg>
                            <p className="text-[12px] text-indigo-700 leading-relaxed">
                              <span className="font-semibold">Bilješka:</span> {historyNotes[h.id]}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Privatna bilješka svećenika</p>
              {noteLoading ? <div className="h-[76px] bg-slate-50 rounded-xl animate-pulse"/> : (
                <>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
                    placeholder="Dodaj internu bilješku (vidljivo samo svećeniku)…"
                    className="w-full px-3.5 py-2.5 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300 resize-none"/>
                  <div className="flex items-center justify-between mt-2">
                    {noteError && <p className="text-[12px] text-red-500">{noteError}</p>}
                    {noteSuccess && <p className="text-[12px] text-emerald-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      Bilješka spremljena
                    </p>}
                    {!noteError && !noteSuccess && <span/>}
                    <button onClick={saveNote} disabled={noteSaving || note.trim()===noteSaved}
                      className="px-4 py-1.5 text-[12px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      {noteSaving ? 'Sprema…' : 'Spremi bilješku'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Priest cancel modal ────────────────────────────────────
function PriestCancelModal({ booking, isLoading, onConfirm, onDismiss }: { booking:Booking; isLoading:boolean; onConfirm:(r:string)=>void; onDismiss:()=>void }) {
  const [reason, setReason] = useState('')
  const slot = booking.availability_slot
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-red-400 to-red-500"/>
        <div className="p-6">
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          </div>
          <h3 className="text-[16px] font-semibold text-slate-900 text-center mb-1">Otkazati potvrđeni susret?</h3>
          <p className="text-[13px] text-slate-400 text-center mb-4">{fullName(booking)}</p>
          {slot && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-4 text-[13px] text-slate-600 text-center">
              <p className="font-medium capitalize">{formatDate(slot.date)}</p>
              <p>{timeLabel(booking)}</p>
            </div>
          )}
          <div className="mb-5">
            <label className="block text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Razlog otkazivanja (neobavezno)</label>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
              placeholder="Npr. bolest, hitna obveza…"
              className="w-full px-3.5 py-2.5 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-slate-300 resize-none"/>
            <p className="text-[11px] text-slate-400 mt-1.5">Razlog će biti poslan župljanu emailom.</p>
          </div>
          <div className="flex gap-2.5">
            <button onClick={onDismiss} disabled={isLoading} className="flex-1 py-2.5 text-[13px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">Zadrži</button>
            <button onClick={()=>onConfirm(reason.trim())} disabled={isLoading}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : 'Otkaži susret'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Complete with note modal ───────────────────────────────
function CompleteModal({ booking, isLoading, onConfirm, onDismiss }: { booking: Booking; isLoading: boolean; onConfirm: (note: string) => void; onDismiss: () => void }) {
  const [note, setNote] = useState('')
  const slot = booking.availability_slot
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-500"/>
        <div className="p-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
          </div>
          <h3 className="text-[16px] font-semibold text-slate-900 text-center mb-1">Označiti kao odrađeno?</h3>
          <p className="text-[13px] text-slate-400 text-center mb-4">{fullName(booking)}</p>
          {slot && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-4 text-[13px] text-slate-600 text-center">
              <p className="font-medium capitalize">{formatDate(slot.date)}</p>
              <p>{timeLabel(booking)}</p>
            </div>
          )}
          <div className="mb-5">
            <label className="block text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Bilješka o susretu
              <span className="ml-1 font-normal normal-case text-slate-400">(opcionalno)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Kratka bilješka o razgovoru, dogovoru, napomeni…"
              className="w-full px-3.5 py-2.5 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-300 resize-none"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
              <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
              </svg>
              Bilješka će biti vidljiva sljedeći put kad ista osoba zatraži susret.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button onClick={onDismiss} disabled={isLoading} className="flex-1 py-2.5 text-[13px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
              Odustani
            </button>
            <button onClick={() => onConfirm(note.trim())} disabled={isLoading}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Odradeno</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Parishioner cancel modal ───────────────────────────────
function CancelModal({ booking, isLoading, onConfirm, onDismiss }: { booking:Booking; isLoading:boolean; onConfirm:()=>void; onDismiss:()=>void }) {
  const slot = booking.availability_slot
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-red-400 to-red-500"/>
        <div className="p-6">
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          </div>
          <h3 className="text-[16px] font-semibold text-slate-900 text-center mb-2">Otkazati rezervaciju?</h3>
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-4 text-[13px] text-slate-600 text-center">
            {slot && <p className="font-medium capitalize">{formatDate(slot.date)}</p>}
            <p>{timeLabel(booking)}</p>
            {booking.purpose && <p className="text-slate-400 mt-0.5 line-clamp-1">{booking.purpose}</p>}
          </div>
          {booking.status === 'CONFIRMED' && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-center mb-4">Ova rezervacija je već potvrđena. Otkazivanje će biti trajno.</p>
          )}
          <div className="flex gap-2.5">
            <button onClick={onDismiss} disabled={isLoading} className="flex-1 py-2.5 text-[13px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">Zadrži</button>
            <button onClick={onConfirm} disabled={isLoading}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : 'Otkaži rezervaciju'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Upcoming booking card (priest) ─────────────────────────
function UpcomingCard({ booking, onCancel, onComplete }: { booking:Booking; onCancel:(b:Booking)=>void; onComplete:(b:Booking)=>void }) {
  const slot = booking.availability_slot
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <p className="text-[15px] font-semibold text-slate-800">{fullName(booking)}</p>
            {booking.parishioner_phone && (
              <a href={`tel:${booking.parishioner_phone}`} className="text-[12px] text-indigo-500 hover:underline">{booking.parishioner_phone}</a>
            )}
          </div>
          {slot && <p className="text-[13px] text-slate-500 capitalize">{formatDate(slot.date)}</p>}
          <p className="text-[13px] text-slate-500">{timeLabel(booking)}</p>
          {booking.purpose && <p className="text-[12px] text-slate-400 mt-1 line-clamp-1">{booking.purpose}</p>}
          <span className={`inline-block mt-2.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border ${STATUS_STYLES[booking.status]}`}>{STATUS_LABELS[booking.status]}</span>
        </div>
        <div className="flex sm:flex-col gap-2">
          <button
            onClick={() => onComplete(booking)}
            className="flex-1 sm:flex-none px-3.5 py-2 text-[12px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Odradeno
          </button>
          <button onClick={() => onCancel(booking)} className="flex-1 sm:flex-none px-3.5 py-2 text-[12px] font-medium text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors whitespace-nowrap text-center">
            Otkaži
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Past booking card ──────────────────────────────────────
function PastCard({ booking }: { booking:Booking }) {
  const slot = booking.availability_slot
  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.03)] opacity-75 hover:opacity-100 transition-opacity">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-700 truncate">{fullName(booking)}</p>
          {slot && <p className="text-[12px] text-slate-400 capitalize mt-0.5">{formatDate(slot.date)} · {timeLabel(booking)}</p>}
          {booking.purpose && <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">{booking.purpose}</p>}
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium border ${STATUS_STYLES[booking.status]}`}>{STATUS_LABELS[booking.status]}</span>
      </div>
    </div>
  )
}

// ── Cancelled booking card ─────────────────────────────────
function CancelledCard({ booking, showCancelledBy }: { booking:Booking; showCancelledBy?:boolean }) {
  const slot = booking.availability_slot
  const cancelledByLabel = booking.cancelled_by === 'PARISHIONER' ? 'Otkazao župljani' : booking.cancelled_by === 'PRIEST' ? 'Otkazao svećenik' : 'Otkazano'
  return (
    <div className="bg-white rounded-2xl border border-red-100 px-5 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-[14px] font-semibold text-slate-700 truncate">{fullName(booking)}</p>
            {booking.parishioner_phone && (
              <a href={`tel:${booking.parishioner_phone}`} className="text-[12px] text-indigo-500 hover:underline">{booking.parishioner_phone}</a>
            )}
          </div>
          {slot && <p className="text-[12px] text-slate-500 capitalize">{formatDate(slot.date)} · {timeLabel(booking)}</p>}
          {booking.purpose && <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">{booking.purpose}</p>}
          {booking.cancellation_reason && (
            <p className="text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mt-2 border border-amber-100">
              <span className="font-semibold">Razlog:</span> {booking.cancellation_reason}
            </p>
          )}
          {showCancelledBy && <p className="text-[11px] text-red-400 mt-1.5 font-medium">{cancelledByLabel}</p>}
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-medium border bg-red-50 text-red-600 border-red-200">Otkazano</span>
      </div>
    </div>
  )
}

// ── Collapsible section ────────────────────────────────────
function CollapsibleSection({ title, count, color, subtitle, children }: { title:string; count:number; color:string; subtitle?:string; children:React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button onClick={()=>setOpen(v=>!v)} className="flex items-center gap-2.5 mb-1 group w-full text-left">
        <div className={`w-2 h-2 rounded-full ${color}`}/>
        <h2 className="text-[15px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">{title}</h2>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 rounded-full">{count}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ml-auto ${open?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {subtitle && <p className="text-[12px] text-slate-400 mb-3 ml-5">{subtitle}</p>}
      {!subtitle && <div className="mb-4"/>}
      {open && children}
    </section>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function Bookings() {
  const { userProfile, isPriest } = useAuth()
  const [bookings, setBookings]       = useState<Booking[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string|null>(null)
  const [updatingId, setUpdatingId]   = useState<string|null>(null)
  const [actionError, setActionError] = useState<string|null>(null)
  const [confirmCancel, setConfirmCancel]   = useState<Booking|null>(null)
  const [priestCancel, setPriestCancel]     = useState<Booking|null>(null)
  const [confirmComplete, setConfirmComplete] = useState<Booking|null>(null)

  useEffect(() => { if (userProfile) fetchBookings() }, [userProfile])

  async function fetchBookings() {
    try {
      setLoading(true); setFetchError(null)
      let q = supabase.from('bookings').select('*, availability_slot:availability_slots(*)')
        .order('created_at', { ascending: false })
      if (!isPriest) q = q.eq('parishioner_id', userProfile!.id)
      const { data, error } = await q
      if (error) throw error
      setBookings(data || [])
    } catch (err) {
      console.error(err); setFetchError('Nije moguće učitati rezervacije.')
    } finally { setLoading(false) }
  }

  async function updateStatus(bookingId: string, newStatus: BookingStatus, cancellationReason?: string, completionNote?: string) {
    setUpdatingId(bookingId); setActionError(null)
    try {
      const booking      = bookings.find(b => b.id === bookingId)
      const wasConfirmed = booking?.status === 'CONFIRMED'

      // ── 1. Update booking status ───────────────────────────
      const { error } = await supabase.from('bookings').update({
        status: newStatus,
        ...(newStatus === 'CANCELLED' ? {
          cancelled_by:          isPriest ? 'PRIEST' : 'PARISHIONER',
          cancellation_reason:   cancellationReason ?? null,
          cancelled_from_status: wasConfirmed ? 'CONFIRMED' : 'PENDING',
        } : {}),
      }).eq('id', bookingId)
      if (error) throw error

      // ── 2. Create calendar event when CONFIRMED ────────────
      // booking_id is stored so we can reliably find this event later.
      if (newStatus === 'CONFIRMED' && userProfile && booking) {
        const slot = booking.availability_slot
        if (slot && booking.requested_start_time && booking.requested_end_time) {
          // Guard: don't create a duplicate if one already exists
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('booking_id', bookingId)
            .eq('is_deleted', false)
            .limit(1)

          if (!existing || existing.length === 0) {
            const { error: evErr } = await supabase.from('events').insert({
              title:      `Susret – ${fullName(booking)}`,
              description: booking.purpose || null,
              start_time: new Date(`${slot.date}T${booking.requested_start_time}:00`).toISOString(),
              end_time:   new Date(`${slot.date}T${booking.requested_end_time}:00`).toISOString(),
              event_type: 'AKTIVNOST',
              color:      '#16a34a',
              is_private: true,
              created_by: userProfile.id,
              is_deleted: false,
              booking_id: bookingId,
            })
            if (evErr) console.error('[Bookings] Failed to create calendar event:', evErr)
          }
        }
      }

      // ── 3. Remove calendar event when CANCELLED ────────────
      // The DB trigger trg_cleanup_on_cancel (migration 013) handles this
      // server-side. The frontend also runs cleanup as an immediate UI fix
      // before the next calendar refresh.
      if (newStatus === 'CANCELLED' && wasConfirmed && booking && booking.availability_slot) {
        const slot = booking.availability_slot
        // Use a ±1 day window to match the DB trigger's logic and handle timezone offsets
        const dayStart = new Date(`${slot.date}T00:00:00`).toISOString()
        const dayEnd   = new Date(`${slot.date}T23:59:59`).toISOString()
        const name     = fullName(booking)

        await Promise.allSettled([
          // A: by booking_id (events created after migration 011)
          supabase.from('events').update({ is_deleted: true })
            .eq('booking_id', bookingId).eq('is_deleted', false),
          // B: "Susret – Name" style (app-created events)
          supabase.from('events').update({ is_deleted: true })
            .ilike('title', `Susret – ${name}%`)
            .eq('is_deleted', false)
            .gte('start_time', dayStart).lte('start_time', dayEnd),
          // C: "Meeting: " style (old DB-trigger events from migration 001)
          supabase.from('events').update({ is_deleted: true })
            .ilike('title', 'Meeting:%')
            .eq('is_deleted', false)
            .gte('start_time', dayStart).lte('start_time', dayEnd),
        ]).then(results => {
          results.forEach((r, i) => {
            if (r.status === 'fulfilled' && r.value.error)
              console.warn(`[Bookings] Event cleanup approach ${i + 1} error:`, r.value.error)
          })
        })
      }

      // ── 4a. Save completion note ───────────────────────────
      if (newStatus === 'COMPLETED' && completionNote?.trim() && userProfile) {
        const { error: noteErr } = await supabase.from('booking_notes').upsert(
          { booking_id: bookingId, priest_id: userProfile.id, note: completionNote.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'booking_id' }
        )
        if (noteErr) console.error('[Bookings] Failed to save completion note:', noteErr)
      }

      // ── 4b. Remove from calendar when COMPLETED (soft-delete) ─
      // Completed meetings move to "Odrađene rezervacije" in Stats/Bookings,
      // and must no longer appear in the calendar.
      if (newStatus === 'COMPLETED') {
        const { error: evErr } = await supabase
          .from('events')
          .update({ is_deleted: true })
          .eq('booking_id', bookingId)
          .eq('is_deleted', false)
        if (evErr) console.error('[Bookings] Failed to remove completed event from calendar:', evErr)
      }

      // ── 5. Email notifications (fire-and-forget) ───────────
      const logFnError = async (fn: string, fnErr: unknown, data: unknown) => {
        if (fnErr) {
          let detail = ''
          if (fnErr && typeof fnErr === 'object' && 'context' in fnErr && fnErr.context) {
            try {
              const ctx = (fnErr as { context?: { json?: () => Promise<unknown> } }).context
              if (ctx?.json) {
                const body = await ctx.json()
                detail = JSON.stringify(body)
              }
            } catch { /* ignore */ }
          }
          console.error(`[Bookings] ${fn} error:`, (fnErr as Error).message, detail || '')
        } else {
          console.log(`[Bookings] ${fn} result:`, data)
        }
      }
      // Only notify priest when parishioner cancels a CONFIRMED meeting (agreed appointment)
      if (newStatus === 'CANCELLED' && !isPriest && wasConfirmed) {
        supabase.functions
          .invoke('notify-priest-cancellation', { body: { bookingId } })
          .then(({ error: fnErr, data }) => logFnError('notify-priest-cancellation', fnErr, data))
      }
      if (newStatus === 'CANCELLED' && isPriest && wasConfirmed) {
        console.log('[Bookings] Invoking notify-parishioner-cancellation for booking', bookingId)
        supabase.functions
          .invoke('notify-parishioner-cancellation', { body: { bookingId } })
          .then(({ error: fnErr, data }) => logFnError('notify-parishioner-cancellation', fnErr, data))
      }

      setConfirmCancel(null); setPriestCancel(null); setConfirmComplete(null)
      fetchBookings()
      window.dispatchEvent(new Event('bookings-updated'))
    } catch (err) {
      console.error('[Bookings] updateStatus failed:', err)
      setActionError('Nije moguće ažurirati rezervaciju. Molimo pokušajte ponovo.')
    } finally { setUpdatingId(null) }
  }

  // ── Derived groups ────────────────────────────────────────
  // PRIEST
  const pending           = bookings.filter(b => b.status === 'PENDING').sort(sortAsc)
  const upcomingConfirmed = bookings.filter(b => b.status === 'CONFIRMED' && isUpcoming(b)).sort(sortAsc)
  // "Done" section = COMPLETED (any date) + past CONFIRMED
  const pastDone          = bookings.filter(b => b.status === 'COMPLETED' || (b.status === 'CONFIRMED' && !isUpcoming(b))).sort(sortDesc)
  const recentCancelled   = bookings.filter(b =>
    b.status === 'CANCELLED' && b.cancelled_from_status === 'CONFIRMED' && isRecentCancel(b)
  ).sort(sortDesc)

  // PARISHIONER
  const myUpcoming  = bookings.filter(b => (b.status === 'PENDING' || b.status === 'CONFIRMED') && isUpcoming(b)).sort(sortAsc)
  const myPast      = bookings.filter(b => (b.status === 'COMPLETED' || (b.status === 'CONFIRMED' && !isUpcoming(b)))).sort(sortDesc)
  const myCancelled = bookings.filter(b =>
    b.status === 'CANCELLED' && b.cancelled_from_status === 'CONFIRMED' && isRecentCancel(b)
  ).sort(sortDesc)

  if (loading) return (
    <div className="min-h-screen bg-[#f6f7fa]">
      <Navigation/>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-4">
        <div className="w-8 h-8 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin"/>
        <p className="text-[14px] text-slate-400 font-medium">Učitavanje rezervacija…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f6f7fa]">
      <Navigation/>
      <div className="max-w-[900px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="mb-5 sm:mb-7">
          <h1 className="text-[20px] sm:text-[26px] font-semibold text-slate-900 tracking-tight">{isPriest ? 'Rezervacije' : 'Moje rezervacije'}</h1>
          <p className="text-[13px] sm:text-[14px] text-slate-400 mt-0.5 sm:mt-1">{isPriest ? 'Zahtjevi i pregled svih zakazanih susreta' : 'Pregled vaših zakazanih susreta'}</p>
        </div>

        {fetchError  && <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{fetchError}</div>}
        {actionError && <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{actionError}</div>}

        {/* ═══════ PRIEST VIEW ═══════ */}
        {isPriest ? (
          <div className="space-y-10">

            {/* 1 · Pending */}
            {pending.length > 0 && (
              <section>
                <div className="mb-4"><SectionHead dot="amber" title="Zahtjevi za potvrdu" count={pending.length} color="amber"/></div>
                <div className="space-y-4">
                  {pending.map(b => <PendingCard key={b.id} booking={b} userProfile={userProfile!} updatingId={updatingId} onUpdate={updateStatus}/>)}
                </div>
              </section>
            )}

            {/* 2 · Upcoming confirmed */}
            {upcomingConfirmed.length > 0 && (
              <section>
                <div className="mb-4"><SectionHead dot="emerald" title="Predstojeći susreti" count={upcomingConfirmed.length} color="emerald"/></div>
                <div className="space-y-3">
                  {upcomingConfirmed.map(b => (
                    <UpcomingCard key={b.id} booking={b} onCancel={setPriestCancel} onComplete={setConfirmComplete}/>
                  ))}
                </div>
              </section>
            )}

            {/* 3 · Done / past (collapsed) */}
            {pastDone.length > 0 && (
              <CollapsibleSection title="Završeni susreti" count={pastDone.length} color="bg-slate-300">
                <div className="space-y-6">
                  {groupByMonth(pastDone).map(({label,items}) => (
                    <div key={label}>
                      <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide mb-3 ml-1">{label}</p>
                      <div className="space-y-2">{items.map(b => <PastCard key={b.id} booking={b}/>)}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* 4 · Cancelled within 48h — collapsible */}
            {recentCancelled.length > 0 && (
              <CollapsibleSection title="Otkazane rezervacije" count={recentCancelled.length} color="bg-red-400" subtitle="Prikazuje se 48 sati od otkazivanja">
                <div className="space-y-2">
                  {recentCancelled.map(b => <CancelledCard key={b.id} booking={b} showCancelledBy/>)}
                </div>
              </CollapsibleSection>
            )}

            {/* Empty */}
            {pending.length===0 && upcomingConfirmed.length===0 && pastDone.length===0 && recentCancelled.length===0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <p className="text-[16px] font-semibold text-slate-700 mb-1">Nema rezervacija</p>
                <p className="text-[13px] text-slate-400">Ovdje će se prikazati zakazani susreti.</p>
              </div>
            )}
          </div>

        ) : (
          /* ═══════ PARISHIONER VIEW ═══════ */
          <div className="space-y-10">

            {/* 1 · Upcoming */}
            {myUpcoming.length > 0 && (
              <section>
                <div className="mb-4"><SectionHead dot="indigo" title="Predstojeće rezervacije" count={myUpcoming.length} color="indigo"/></div>
                <div className="space-y-3">
                  {myUpcoming.map(b => {
                    const slot = b.availability_slot
                    const canCancel = b.status === 'PENDING' || b.status === 'CONFIRMED'
                    return (
                      <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow">
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            {slot && <p className="text-[15px] font-semibold text-slate-800 capitalize">{formatDate(slot.date)}</p>}
                            <p className="text-[13px] text-slate-500 mt-0.5">{timeLabel(b)}</p>
                            {b.purpose && <p className="text-[13px] text-slate-500 mt-1.5"><span className="font-medium text-slate-700">Razlog:</span> {b.purpose}</p>}
                            <span className={`inline-block mt-3 px-2.5 py-1 rounded-lg text-[12px] font-medium border ${STATUS_STYLES[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                          </div>
                          {canCancel && (
                            <button onClick={()=>setConfirmCancel(b)} disabled={updatingId===b.id}
                              className="shrink-0 px-4 py-2 text-[13px] font-medium text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors disabled:opacity-50">
                              Otkaži
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 2 · Past (collapsed) */}
            {myPast.length > 0 && (
              <CollapsibleSection title="Završeni susreti" count={myPast.length} color="bg-slate-300">
                <div className="space-y-6">
                  {groupByMonth(myPast).map(({label,items}) => (
                    <div key={label}>
                      <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide mb-3 ml-1">{label}</p>
                      <div className="space-y-2">{items.map(b => {
                        const slot = b.availability_slot
                        return (
                          <div key={b.id} className="bg-white rounded-2xl border border-slate-100 px-5 py-4 opacity-75">
                            {slot && <p className="text-[14px] font-semibold text-slate-700 capitalize">{formatDate(slot.date)}</p>}
                            <p className="text-[12px] text-slate-400 mt-0.5">{timeLabel(b)}</p>
                            {b.purpose && <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">{b.purpose}</p>}
                          </div>
                        )
                      })}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* 3 · Cancelled (last 48h) — collapsible */}
            {myCancelled.length > 0 && (
              <CollapsibleSection title="Otkazane rezervacije" count={myCancelled.length} color="bg-red-400" subtitle="Prikazuje se 48 sati od otkazivanja">
                <div className="space-y-2">
                  {myCancelled.map(b => <CancelledCard key={b.id} booking={b}/>)}
                </div>
              </CollapsibleSection>
            )}

            {/* Empty */}
            {myUpcoming.length===0 && myPast.length===0 && myCancelled.length===0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <p className="text-[16px] font-semibold text-slate-700 mb-1">Nema rezervacija</p>
                <p className="text-[13px] text-slate-400">Vaši zakazani susreti prikazat će se ovdje.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmCancel && (
        <CancelModal booking={confirmCancel} isLoading={updatingId===confirmCancel.id}
          onConfirm={()=>updateStatus(confirmCancel.id,'CANCELLED')} onDismiss={()=>setConfirmCancel(null)}/>
      )}
      {priestCancel && (
        <PriestCancelModal booking={priestCancel} isLoading={updatingId===priestCancel.id}
          onConfirm={r=>updateStatus(priestCancel.id,'CANCELLED',r)} onDismiss={()=>setPriestCancel(null)}/>
      )}
      {confirmComplete && (
        <CompleteModal booking={confirmComplete} isLoading={updatingId===confirmComplete.id}
          onConfirm={note=>updateStatus(confirmComplete.id,'COMPLETED',undefined,note)} onDismiss={()=>setConfirmComplete(null)}/>
      )}
    </div>
  )
}
