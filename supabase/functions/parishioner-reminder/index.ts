/**
 * parishioner-reminder
 *
 * Finds every CONFIRMED booking that:
 *  - happens tomorrow
 *  - has not yet had a reminder sent (reminder_sent = false)
 *
 * Sends a Croatian-language email to the parishioner via Resend,
 * marks the booking reminder_sent = true, and logs the attempt.
 *
 * Deploy via Supabase Dashboard → Edge Functions → New function
 *   (paste this entire file — no external imports needed)
 *
 * Schedule (pg_cron – see migration 005):
 *   Every hour: '0 * * * *'
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

function buildReminderHtml(opts: {
  parishionerName: string
  priestName:      string
  date:            string
  startTime:       string
  endTime:         string
  purpose:         string
}): string {
  const { parishionerName, priestName, date, startTime, endTime, purpose } = opts
  const dateLabel = formatCroatianDate(date)

  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.07);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);letter-spacing:.05em;text-transform:uppercase;">Podsjetnik na susret</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#fff;">${APP_NAME}</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.7);">${PARISH}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">
              Poštovani/a <strong>${parishionerName}</strong>,
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              podsjećamo vas da imate zakazani susret s vašim župnikom <strong>${priestName}</strong>
              već <strong>sutra</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:90px;">Datum</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${dateLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Vrijeme</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${startTime} – ${endTime}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Župnik</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${priestName}</td>
                  </tr>
                  ${purpose ? `<tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;vertical-align:top;">Razlog</td>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">${purpose}</td>
                  </tr>` : ''}
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6;">
              Ako ne možete doći, molimo javite se što prije kako biste otkazali ili preuredili termin.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">${PARISH}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Ova poruka je automatski generirana — molimo ne odgovarajte na nju.</p>
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

    // Tomorrow's date string 'YYYY-MM-DD'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Fetch confirmed bookings for tomorrow that haven't been reminded yet
    const { data: bookings, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id,
        parishioner_id,
        parishioner_first_name,
        parishioner_last_name,
        requested_start_time,
        requested_end_time,
        purpose,
        availability_slot:availability_slots!inner ( date )
      `)
      .eq('status', 'CONFIRMED')
      .eq('reminder_sent', false)
      .eq('availability_slots.date', tomorrowStr)

    if (fetchErr) throw fetchErr

    if (!bookings || bookings.length === 0) {
      return new Response('No reminders needed.', { status: 200 })
    }

    // Fetch priest name
    const { data: priests } = await supabase
      .from('users')
      .select('name')
      .eq('role', 'PRIEST')
      .limit(1)
    const priestName = priests?.[0]?.name ?? 'župnik'

    let sent   = 0
    let failed = 0

    for (const booking of bookings) {
      const { data: parishioner } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', booking.parishioner_id)
        .single()

      if (!parishioner?.email) continue

      const slotDate = (booking.availability_slot as { date: string }).date
      const parishionerName =
        [booking.parishioner_first_name, booking.parishioner_last_name].filter(Boolean).join(' ') ||
        parishioner.name ||
        'župljane'

      const html = buildReminderHtml({
        parishionerName,
        priestName,
        date:      slotDate,
        startTime: booking.requested_start_time ?? '',
        endTime:   booking.requested_end_time   ?? '',
        purpose:   booking.purpose              ?? '',
      })

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    `Pastoralni kalendar <${FROM_EMAIL}>`,
          to:      [parishioner.email],
          subject: `Podsjetnik: Susret sutra u ${booking.requested_start_time ?? ''} – ${formatCroatianDate(slotDate)}`,
          html,
        }),
      })

      const success = res.ok
      if (success) {
        sent++
        await supabase
          .from('bookings')
          .update({ reminder_sent: true })
          .eq('id', booking.id)
      } else {
        failed++
        console.error(`Resend error for booking ${booking.id}:`, await res.text())
      }

      await supabase.from('email_log').insert({
        email_type:      'parishioner_reminder',
        recipient_email: parishioner.email,
        booking_id:      booking.id,
        success,
        error_message:   success ? null : `HTTP ${res.status}`,
      })
    }

    return new Response(
      JSON.stringify({ sent, failed, total: bookings.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('parishioner-reminder error:', err)
    return new Response(String(err), { status: 500 })
  }
})
