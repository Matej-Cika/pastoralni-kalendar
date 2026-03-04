/**
 * notify-parishioner-confirmation
 *
 * Called when a priest confirms a booking (status → CONFIRMED).
 * Sends an email to the parishioner with the confirmed date and time.
 *
 * Required secrets: RESEND_API_KEY, RESEND_FROM_EMAIL
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
          <td style="background:linear-gradient(135deg,#059669,#047857);padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,.75);letter-spacing:.05em;text-transform:uppercase;">Potvrda rezervacije</p>
            <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#fff;">Vaša rezervacija je potvrđena</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);">${APP_NAME} · ${PARISH}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">Poštovani/a <strong>${parishionerName}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              župnik <strong>${priestName}</strong> potvrdio je vaš zahtjev za susret. Termin je sada rezerviran za vas.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
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
                  ${purpose ? `<tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;vertical-align:top;">Razlog</td>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">${purpose}</td>
                  </tr>` : ''}
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              Molimo dođite u zakazano vrijeme. Za pitanja kontaktirajte župni ured.
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

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select(`
        id, parishioner_id, status,
        parishioner_first_name, parishioner_last_name,
        requested_start_time, requested_end_time, purpose,
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
    if (booking.status !== 'CONFIRMED') {
      return new Response(JSON.stringify({ skipped: true, reason: 'booking_not_confirmed' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data: parishioner } = await supabase
      .from('users').select('email, name').eq('id', booking.parishioner_id).single()
    if (!parishioner?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_parishioner_email' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data: priests } = await supabase
      .from('users').select('name').eq('role', 'PRIEST').limit(1)
    const priestName = priests?.[0]?.name ?? 'Župnik'

    const slot = booking.availability_slot as { date: string; start_time: string; end_time: string }
    const parishionerName =
      [booking.parishioner_first_name, booking.parishioner_last_name].filter(Boolean).join(' ') ||
      parishioner.name || 'Župljane'

    const html = buildEmailHtml({
      parishionerName,
      priestName,
      date:      slot.date,
      startTime: booking.requested_start_time ?? slot.start_time,
      endTime:   booking.requested_end_time   ?? slot.end_time,
      purpose:   booking.purpose ?? '',
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    `Pastoralni kalendar <${FROM_EMAIL}>`,
        to:      [parishioner.email],
        subject: `Potvrda susreta – ${formatCroatianDate(slot.date)}`,
        html,
      }),
    })

    const success = res.ok
    if (!success) console.error('Resend error:', await res.text())

    await supabase.from('email_log').insert({
      email_type: 'parishioner_confirmation', recipient_email: parishioner.email,
      booking_id: bookingId, success,
      error_message: success ? null : `HTTP ${res.status}`,
    })

    return new Response(JSON.stringify({ success }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-parishioner-confirmation error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
