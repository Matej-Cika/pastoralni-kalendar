import { useEffect } from 'react'

/**
 * TimeSelect — a single, styled dropdown with 15-minute interval slots.
 *
 * Props:
 *   value    — controlled 'HH:MM' string or '' for unset
 *   onChange — called with the newly chosen 'HH:MM' or '' when cleared
 *   minTime  — optional 'HH:MM'; only times strictly after this are offered.
 *              Used for end-time pickers so they can't go before the start time.
 *   disabled / className — standard passthrough
 */

interface TimeSelectProps {
  value: string
  onChange: (value: string) => void
  minTime?: string
  disabled?: boolean
  className?: string
}

// All 15-minute slots from 00:00 to 23:45 (96 options) — built once.
const ALL_TIMES: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export default function TimeSelect({ value, onChange, minTime, disabled = false, className = '' }: TimeSelectProps) {
  // Strictly filter: end time must be AFTER start time (not equal).
  const validTimes = minTime ? ALL_TIMES.filter(t => t > minTime) : ALL_TIMES

  // When minTime changes (e.g. user pushed start time later), clear an end time
  // that has become invalid so the dropdown resets to the placeholder.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (minTime && value && value <= minTime) {
      onChange('')
    }
  }, [minTime])

  // If somehow the stored value is not in the valid list, treat it as empty
  // so the placeholder shows instead of a stale invisible selection.
  const displayValue = validTimes.includes(value) ? value : value === '' ? '' : ''

  return (
    <div className={`relative ${className}`}>
      {/* Clock icon */}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
        </svg>
      </span>

      <select
        value={displayValue}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Odabir vremena"
        className={[
          'w-full appearance-none cursor-pointer',
          'pl-9 pr-8 py-[10px]',
          'text-[14px] font-medium text-slate-800',
          'bg-white border border-slate-200 rounded-xl',
          'outline-none transition-all',
          'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100',
          'hover:border-slate-300',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-200',
          !displayValue && 'text-slate-400',
        ].join(' ')}
      >
        <option value="" disabled>
          {minTime ? `Po završetku ${minTime}` : '– : –'}
        </option>
        {validTimes.map(t => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {/* Custom chevron */}
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  )
}
