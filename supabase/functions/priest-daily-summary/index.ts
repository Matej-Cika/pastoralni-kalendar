/**
 * priest-daily-summary
 *
 * Sends the priest a morning digest of all confirmed meetings today.
 * Only fires if at least one meeting exists.
 *
 * Deploy via Supabase Dashboard → Edge Functions → New function
 *   (paste this entire file — no external imports needed)
 *
 * Schedule (pg_cron – see migration 005):
 *   06:00 CET = 05:00 UTC: '0 5 * * *'
 *
 * Required secrets (Dashboard → Settings → Edge Functions → Secrets):
 *   RESEND_API_KEY       – from resend.com
 *   RESEND_FROM_EMAIL    – verified sender, e.g. "noreply@yourparish.hr"
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Inline helpers (avoids _shared/ import which dashboard can't resolve) ──

const PARISH   = 'Župa Presvetog Srca Isusovog, Visoka, Split'
const APP_NAME = 'Pastoralni kalendar'

const HR_MONTHS: Record<number, string> = {
  0: 'siječnja',  1: 'veljače',   2: 'ožujka',    3: 'travnja',
  4: 'svibnja',   5: 'lipnja',    6: 'srpnja',    7: 'kolovoza',
  8: 'rujna',     9: 'listopada', 10: 'studenoga', 11: 'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0: 'nedjelja', 1: 'ponedjeljak', 2: 'utorak',  3: 'srijeda',
  4: 'četvrtak', 5: 'petak',       6: 'subota',
}

function formatCroatianDate(dateStr: string): string {
  const d  = new Date(dateStr + 'T00:00:00')
  const wd = HR_WEEKDAYS[d.getDay()]
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${d.getDate()}. ${HR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`
}

interface MeetingItem {
  startTime: string
  endTime:   string
  name:      string
  purpose:   string
}

function buildSummaryHtml(opts: {
  priestName: string
  date:       string
  meetings:   MeetingItem[]
}): string {
  const { priestName, date, meetings } = opts
  const dateLabel = formatCroatianDate(date)
  const count = meetings.length

  const meetingRows = meetings
    .map(
      (m, i) => `
      <tr style="${i > 0 ? 'border-top:1px solid #f3f4f6;' : ''}">
        <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#4f46e5;white-space:nowrap;width:130px;">
          ${m.startTime} – ${m.endTime}
        </td>
        <td style="padding:14px 20px 14px 0;font-size:14px;color:#111827;font-weight:500;">${m.name}</td>
        <td style="padding:14px 20px 14px 0;font-size:14px;color:#6b7280;">${m.purpose || '—'}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.07);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 40px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,.7);letter-spacing:.05em;text-transform:uppercase;">Jutarnji pregled · ${dateLabel}</p>
            <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#fff;">Dobro jutro, ${priestName}!</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);">
              Danas imate <strong style="color:#fff;">${count} ${count === 1 ? 'susret' : 'susreta'}</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
              <tr style="background:#f9fafb;">
                <th style="padding:10px 20px;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Vrijeme</th>
                <th style="padding:10px 20px 10px 0;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Ime</th>
                <th style="padding:10px 20px 10px 0;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Razlog</th>
              </tr>
              ${meetingRows}
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#6b7280;text-align:right;">
              Ukupno danas: <strong style="color:#111827;">${count}</strong>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">${PARISH} · ${APP_NAME}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Main handler ───────────────────────────────────────────────

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL           = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@zupa-srce-visoka.hr'

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const today    = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const { data: bookings, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id,
        parishioner_first_name,
        parishioner_last_name,
        parishioner_phone,
        requested_start_time,
        requested_end_time,
        purpose,
        availability_slot:availability_slots!inner ( date )
      `)
      .eq('status', 'CONFIRMED')
      .eq('availability_slots.date', todayStr)
      .order('requested_start_time', { ascending: true })

    if (fetchErr) throw fetchErr

    if (!bookings || bookings.length === 0) {
      console.log('No meetings today — skipping summary email.')
      return new Response('No meetings today.', { status: 200 })
    }

    const { data: priests } = await supabase
      .from('users')
      .select('email, name')
      .eq('role', 'PRIEST')
      .limit(1)

    const priest = priests?.[0]
    if (!priest?.email) {
      console.error('No priest found in users table.')
      return new Response('Priest not found.', { status: 500 })
    }

    const meetings: MeetingItem[] = bookings.map((b) => ({
      startTime: b.requested_start_time ?? '—',
      endTime:   b.requested_end_time   ?? '—',
      name:
        [b.parishioner_first_name, b.parishioner_last_name].filter(Boolean).join(' ') || 'Nepoznat',
      purpose: b.purpose ?? '',
    }))

    const html  = buildSummaryHtml({ priestName: priest.name, date: todayStr, meetings })
    const count = meetings.length

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `Pastoralni kalendar <${FROM_EMAIL}>`,
        to:      [priest.email],
        subject: `Jutarnji pregled – ${formatCroatianDate(todayStr)} · ${count} ${count === 1 ? 'susret' : 'susreta'}`,
        html,
      }),
    })

    const success = res.ok
    if (!success) {
      console.error('Resend error (summary):', await res.text())
    }

    await supabase.from('email_log').insert({
      email_type:      'priest_summary',
      recipient_email: priest.email,
      booking_id:      null,
      success,
      error_message:   success ? null : `HTTP ${res.status}`,
    })

    return new Response(
      JSON.stringify({ success, meetingCount: count }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('priest-daily-summary error:', err)
    return new Response(String(err), { status: 500 })
  }
})
