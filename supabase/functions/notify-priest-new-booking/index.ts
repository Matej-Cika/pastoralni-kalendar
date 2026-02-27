/**
 * notify-priest-new-booking
 *
 * Called immediately after a parishioner submits a new meeting request
 * (status = PENDING). Sends an email to the priest with full details.
 *
 * Deploy via Supabase Dashboard → Edge Functions → New function
 *   Name: notify-priest-new-booking
 *   (paste this entire file — no external imports needed)
 *
 * Required secrets (Dashboard → Settings → Edge Functions → Secrets):
 *   RESEND_API_KEY       – from resend.com
 *   RESEND_FROM_EMAIL    – verified sender, e.g. "noreply@yourparish.hr"
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers required for browser invoke (avoids FunctionsFetchError)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PARISH   = 'Župa Presvetog Srca Isusovog, Visoka, Split'
const APP_NAME = 'Pastoralni kalendar'

const HR_MONTHS: Record<number, string> = {
  0:'siječnja', 1:'veljače',  2:'ožujka',    3:'travnja',
  4:'svibnja',  5:'lipnja',   6:'srpnja',    7:'kolovoza',
  8:'rujna',    9:'listopada',10:'studenoga',11:'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0:'nedjelja',1:'ponedjeljak',2:'utorak',3:'srijeda',4:'četvrtak',5:'petak',6:'subota',
}

function formatCroatianDate(dateStr: string): string {
  const d  = new Date(dateStr + 'T00:00:00')
  const wd = HR_WEEKDAYS[d.getDay()]
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${d.getDate()}. ${HR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`
}

function buildEmailHtml(opts: {
  priestName:      string
  firstName:       string
  lastName:        string
  phone:           string
  purpose:         string
  date:            string
  startTime:       string
  endTime:         string
  durationMinutes: number | null
}): string {
  const { priestName, firstName, lastName, phone, purpose, date, startTime, endTime, durationMinutes } = opts
  const dateLabel    = formatCroatianDate(date)
  const fullName     = `${firstName} ${lastName}`.trim()
  const durationStr  = durationMinutes ? ` (${durationMinutes} min)` : ''

  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.07);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,.75);letter-spacing:.05em;text-transform:uppercase;">Nova molba za susret</p>
            <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;color:#fff;">📅 Nova rezervacija</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);">${APP_NAME} · ${PARISH}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">
              Poštovani <strong>${priestName}</strong>,
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              župljani/ka <strong>${fullName}</strong> poslao/la je novu molbu za susret.
              Molimo pregledajte i potvrdite ili odbijte zahtjev.
            </p>

            <!-- Details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.06em;">Podaci župljana</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:100px;">Ime</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${firstName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Prezime</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${lastName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Mobitel</td>
                    <td style="padding:6px 0;font-size:14px;color:#4f46e5;font-weight:500;">${phone}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.06em;">Traženi termin</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:100px;">Datum</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${dateLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Vrijeme</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${startTime} – ${endTime}${durationStr}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;vertical-align:top;">Razlog</td>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">${purpose || '—'}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              Prijavite se u aplikaciju kako biste potvrdili ili odbili ovaj zahtjev.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 40px;text-align:center;">
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

// ── Main handler ───────────────────────────────────────────

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL           = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@zupa-srce-visoka.hr'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  try {
    const { bookingId } = await req.json()
    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'Missing bookingId' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (!RESEND_API_KEY) {
      console.error('[notify-priest-new-booking] RESEND_API_KEY secret is not set!')
      return new Response(JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── Fetch booking ──────────────────────────────────────
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select(`
        id, status,
        parishioner_first_name, parishioner_last_name, parishioner_phone,
        requested_start_time, requested_end_time, duration_minutes, purpose,
        availability_slot:availability_slots!inner ( date, start_time, end_time )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingErr) {
      console.error('[notify-priest-new-booking] Booking fetch error:', bookingErr)
      return new Response(JSON.stringify({ success: false, error: 'Booking not found', detail: bookingErr.message }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (booking.status !== 'PENDING') {
      console.log(`[notify-priest-new-booking] Booking ${bookingId} is not PENDING (${booking.status}) — skipping`)
      return new Response(JSON.stringify({ skipped: true, reason: 'not_pending' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch priest ───────────────────────────────────────
    const { data: priests, error: priestErr } = await supabase
      .from('users').select('email, name').eq('role', 'PRIEST').limit(1)

    if (priestErr || !priests?.length || !priests[0].email) {
      console.error('[notify-priest-new-booking] Priest not found:', priestErr)
      return new Response(JSON.stringify({ error: 'Priest not found' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const priest = priests[0]
    const slot   = booking.availability_slot as { date: string; start_time: string; end_time: string }

    const html = buildEmailHtml({
      priestName:      priest.name,
      firstName:       booking.parishioner_first_name  ?? '',
      lastName:        booking.parishioner_last_name   ?? '',
      phone:           booking.parishioner_phone       ?? '—',
      purpose:         booking.purpose                 ?? '',
      date:            slot.date,
      startTime:       booking.requested_start_time    ?? slot.start_time,
      endTime:         booking.requested_end_time      ?? slot.end_time,
      durationMinutes: booking.duration_minutes,
    })

    const fullName = `${booking.parishioner_first_name ?? ''} ${booking.parishioner_last_name ?? ''}`.trim()

    // ── Send via Resend ────────────────────────────────────
    console.log(`[notify-priest-new-booking] Sending to ${priest.email} for booking ${bookingId}`)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    `Pastoralni kalendar <${FROM_EMAIL}>`,
        to:      [priest.email],
        subject: `Nova molba za susret – ${fullName} · ${formatCroatianDate(slot.date)}`,
        html,
      }),
    })

    const success  = res.ok
    const resBody  = await res.text()
    if (!success) console.error(`[notify-priest-new-booking] Resend error HTTP ${res.status}:`, resBody)
    else          console.log(`[notify-priest-new-booking] Email sent successfully. Resend response:`, resBody)

    // ── Log attempt ────────────────────────────────────────
    await supabase.from('email_log').insert({
      email_type:      'priest_new_booking',
      recipient_email: priest.email,
      booking_id:      bookingId,
      success,
      error_message:   success ? null : `HTTP ${res.status}: ${resBody}`,
    })

    return new Response(
      JSON.stringify({ success, priestEmail: priest.email }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[notify-priest-new-booking] Unhandled error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
