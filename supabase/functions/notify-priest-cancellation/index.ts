/**
 * notify-priest-cancellation
 *
 * Called by the frontend (supabase.functions.invoke) immediately after a
 * parishioner cancels their own booking.
 *
 * Fetches booking + priest details and sends a Croatian-language email
 * to the priest via Resend.
 *
 * Deploy via Supabase Dashboard → Edge Functions → New function
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

function buildEmailHtml(opts: {
  priestName:      string
  parishionerName: string
  parishionerPhone: string
  date:            string
  startTime:       string
  endTime:         string
  purpose:         string
}): string {
  const { priestName, parishionerName, parishionerPhone, date, startTime, endTime, purpose } = opts
  const dateLabel = formatCroatianDate(date)

  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.07);">
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,.75);letter-spacing:.05em;text-transform:uppercase;">Obavijest o otkazivanju</p>
            <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#fff;">Rezervacija otkazana</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);">${APP_NAME} · ${PARISH}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">Poštovani <strong>${priestName}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              župljani/ka <strong>${parishionerName}</strong> otkazao/la je sljedeću rezervaciju:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:100px;">Datum</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${dateLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Vrijeme</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${startTime} – ${endTime}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Župljani</td>
                    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${parishionerName}</td>
                  </tr>
                  ${parishionerPhone ? `<tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Mobitel</td>
                    <td style="padding:6px 0;font-size:14px;color:#4f46e5;font-weight:500;">${parishionerPhone}</td>
                  </tr>` : ''}
                  ${purpose ? `<tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;vertical-align:top;">Razlog</td>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">${purpose}</td>
                  </tr>` : ''}
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              Termin je sada slobodan. Provjerite aplikaciju za više detalja.
            </p>
          </td>
        </tr>
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

// ── Main handler ───────────────────────────────────────────────

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── Fetch booking + slot ───────────────────────────────────
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select(`
        id,
        parishioner_first_name,
        parishioner_last_name,
        parishioner_phone,
        requested_start_time,
        requested_end_time,
        purpose,
        cancelled_by,
        cancelled_from_status,
        availability_slot:availability_slots!inner ( date, start_time, end_time )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ success: false, error: 'Booking not found' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Only send when parishioner cancelled a CONFIRMED meeting (agreed appointment)
    if (booking.cancelled_by !== 'PARISHIONER' || booking.cancelled_from_status !== 'CONFIRMED') {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch priest ───────────────────────────────────────────
    const { data: priests } = await supabase
      .from('users')
      .select('email, name')
      .eq('role', 'PRIEST')
      .limit(1)

    const priest = priests?.[0]
    if (!priest?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_priest_email' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const slot = booking.availability_slot as {
      date: string; start_time: string; end_time: string
    }
    const parishionerName =
      [booking.parishioner_first_name, booking.parishioner_last_name]
        .filter(Boolean)
        .join(' ') || 'Nepoznato'

    const html = buildEmailHtml({
      priestName:       priest.name,
      parishionerName,
      parishionerPhone: booking.parishioner_phone ?? '',
      date:             slot.date,
      startTime:        booking.requested_start_time ?? slot.start_time,
      endTime:          booking.requested_end_time   ?? slot.end_time,
      purpose:          booking.purpose              ?? '',
    })

    // ── Send via Resend ────────────────────────────────────────
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `Pastoralni kalendar <${FROM_EMAIL}>`,
        to:      [priest.email],
        subject: `Otkazivanje susreta – ${parishionerName} · ${formatCroatianDate(slot.date)}`,
        html,
      }),
    })

    const success  = res.ok
    const errBody  = success ? null : await res.text()
    if (!success) console.error('Resend error:', errBody)

    await supabase.from('email_log').insert({
      email_type:      'priest_cancellation_notification',
      recipient_email: priest.email,
      booking_id:      bookingId,
      success,
      error_message:   success ? null : `HTTP ${res.status}: ${errBody}`,
    })

    return new Response(
      JSON.stringify({ success }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('notify-priest-cancellation error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
