// ── Shared email HTML templates ─────────────────────────────────────────────
// These are server-rendered inside Supabase Edge Functions (Deno runtime).

const PARISH = 'Župa Presvetog Srca Isusovog, Visoka, Split'
const APP_NAME = 'Pastoralni kalendar'

const HR_MONTHS: Record<number, string> = {
  0: 'siječnja', 1: 'veljače', 2: 'ožujka', 3: 'travnja',
  4: 'svibnja', 5: 'lipnja', 6: 'srpnja', 7: 'kolovoza',
  8: 'rujna', 9: 'listopada', 10: 'studenoga', 11: 'prosinca',
}
const HR_WEEKDAYS: Record<number, string> = {
  0: 'nedjelja', 1: 'ponedjeljak', 2: 'utorak', 3: 'srijeda',
  4: 'četvrtak', 5: 'petak', 6: 'subota',
}

export function formatCroatianDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const wd = HR_WEEKDAYS[d.getDay()]
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${d.getDate()}. ${HR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`
}

// ── Parishioner 24h reminder ─────────────────────────────────────────────────
export function parishionerReminderHtml(opts: {
  parishionerName: string
  priestName: string
  date: string        // 'YYYY-MM-DD'
  startTime: string   // 'HH:MM'
  endTime: string     // 'HH:MM'
  purpose: string
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

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);letter-spacing:.05em;text-transform:uppercase;">Podsjetnik na susret</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#fff;">${APP_NAME}</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.7);">${PARISH}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">
              Poštovani/a <strong>${parishionerName}</strong>,
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              podsjećamo vas da imate zakazani susret s vašim župnikom <strong>${priestName}</strong>
              već <strong>sutra</strong>.
            </p>

            <!-- Meeting details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
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
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6;">
              Ako ne možete doći, molimo javite se što prije kako biste otkazali ili preuredili termin.
            </p>
          </td>
        </tr>

        <!-- Footer -->
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

// ── Priest cancellation notification ─────────────────────────────────────────
export function priestCancellationHtml(opts: {
  priestName: string
  parishionerName: string
  parishionerPhone: string
  date: string        // 'YYYY-MM-DD'
  startTime: string   // 'HH:MM'
  endTime: string     // 'HH:MM'
  purpose: string
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

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,.75);letter-spacing:.05em;text-transform:uppercase;">Obavijest o otkazivanju</p>
            <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#fff;">Rezervacija otkazana</h1>
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
              župljani/ka <strong>${parishionerName}</strong> otkazao/la je sljedeću rezervaciju:
            </p>

            <!-- Booking details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
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
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              Termin je sada slobodan. Provjerite aplikaciju za više detalja.
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

// ── Priest daily summary ──────────────────────────────────────────────────────
export interface MeetingSummaryItem {
  startTime: string
  endTime: string
  name: string
  purpose: string
}

export function priestDailySummaryHtml(opts: {
  priestName: string
  date: string   // 'YYYY-MM-DD'
  meetings: MeetingSummaryItem[]
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

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 40px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,.7);letter-spacing:.05em;text-transform:uppercase;">Jutarnji pregled · ${dateLabel}</p>
            <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#fff;">Dobro jutro, ${priestName}!</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);">
              Danas imate <strong style="color:#fff;">${count} ${count === 1 ? 'susret' : count < 5 ? 'susreta' : 'susreta'}</strong>.
            </p>
          </td>
        </tr>

        <!-- Meetings table -->
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

        <!-- Footer -->
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
