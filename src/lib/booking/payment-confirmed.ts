import { Resend } from 'resend';
import type { createAdminClient } from '@/lib/supabase/server';

// Everything that must happen when Paystack says a booking is paid.
// Called directly from the Paystack webhook and from /api/bookings/verify
// (the guest's redirect back), so confirmation + team email never depend
// on a background queue. Idempotent: the second caller finds the booking
// already paid and sends nothing.

type Db = ReturnType<typeof createAdminClient>;

const FROM = '9jaRooms <team@9jarooms.com>';
const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.9jarooms.com';

function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function naira(n: number | string | null | undefined) {
    return '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG');
}
function esc(s: unknown) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export interface PaidBookingResult {
    booking: any;
    alreadyPaid: boolean;
}

// Mark the booking paid, log the transaction, turn held dates into booked
// and write the payment to the ledger. Safe to call more than once.
export async function confirmPaidBooking(supabase: Db, input: {
    reference: string;
    bookingId?: string | null;
    amountKobo?: number | null;
    raw?: unknown;
}): Promise<PaidBookingResult> {
    let query = supabase
        .from('bookings')
        .select('*, room:rooms(id, name, unit_code, room_type_id), room_type:room_types(name), property:properties(*, owner:owners(name, email))');
    query = input.bookingId ? query.eq('id', input.bookingId) : query.eq('paystack_reference', input.reference);
    const { data: booking, error } = await query.single();
    if (error || !booking) {
        throw new Error(`Booking not found for ${input.bookingId || input.reference}`);
    }

    if (['paid', 'checked_in', 'completed'].includes(booking.status)) {
        return { booking, alreadyPaid: true };
    }

    // transaction log (once per reference)
    const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('paystack_reference', input.reference)
        .eq('paystack_event', 'charge.success')
        .maybeSingle();
    if (!existingTx) {
        await supabase.from('transactions').insert({
            paystack_reference: input.reference,
            paystack_event: 'charge.success',
            amount: input.amountKobo != null ? input.amountKobo / 100 : Number(booking.total_amount),
            currency: 'NGN',
            status: 'success',
            booking_id: booking.id,
            raw_payload: input.raw ?? null,
        });
    }

    const { error: upErr } = await supabase
        .from('bookings')
        .update({ status: 'paid', expires_at: null })
        .eq('id', booking.id);
    if (upErr) throw new Error(`Failed to mark booking paid: ${upErr.message}`);

    await supabase
        .from('availability')
        .update({ status: 'booked' })
        .eq('booking_id', booking.id)
        .eq('status', 'held');

    // ledger row so the CRM / Today screen show it as paid in full
    const { count } = await supabase
        .from('booking_payments')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', booking.id);
    if (!count) {
        await supabase.from('booking_payments').insert({
            booking_id: booking.id,
            amount: input.amountKobo != null ? input.amountKobo / 100 : Number(booking.total_amount),
            method: 'Paystack',
            note: `Paid online · ref ${input.reference}`,
        });
    }

    return { booking: { ...booking, status: 'paid' }, alreadyPaid: false };
}

function resendClient() {
    const key = process.env.RESEND_API_KEY;
    if (!key || key.startsWith('re_placeholder')) return null;
    return new Resend(key);
}

// Who gets told about a new paid booking: TEAM_NOTIFY_EMAILS (comma
// separated) plus the property's caretaker. Falls back to the owner email.
async function teamRecipients(supabase: Db, booking: any): Promise<string[]> {
    const set = new Set<string>();
    for (const e of (process.env.TEAM_NOTIFY_EMAILS || '').split(',')) {
        const t = e.trim();
        if (t) set.add(t);
    }
    if (booking.property?.caretaker_id) {
        const { data: caretaker } = await supabase
            .from('caretakers')
            .select('email')
            .eq('id', booking.property.caretaker_id)
            .maybeSingle();
        // caretaker logins use fake internal emails; only real ones get mail
        if (caretaker?.email && !caretaker.email.endsWith('@9jarooms.internal') && caretaker.email.includes('.')) {
            set.add(caretaker.email);
        }
    }
    if (set.size === 0 && booking.property?.owner?.email) set.add(booking.property.owner.email);
    return [...set];
}

// "A room has been booked" — everything the team needs to receive the guest.
export async function notifyTeamNewBooking(supabase: Db, booking: any): Promise<{ sent: boolean; to?: string[]; reason?: string }> {
    const resend = resendClient();
    if (!resend) return { sent: false, reason: 'RESEND_API_KEY not set' };
    const to = await teamRecipients(supabase, booking);
    if (to.length === 0) return { sent: false, reason: 'no recipients' };

    const p = booking.property || {};
    const unit = booking.room?.unit_code || booking.room?.name || '—';
    const roomType = booking.room_type?.name ? ` (${booking.room_type.name})` : '';
    const crmLink = `${SITE}/crm/reservations`;
    const row = (label: string, value: unknown) =>
        `<tr><td style="padding:8px 0;color:#6b7280;width:38%">${label}</td><td style="padding:8px 0;font-weight:600;color:#111827">${esc(value)}</td></tr>`;

    const { error } = await resend.emails.send({
        from: FROM,
        to,
        subject: `New booking · ${p.name} · Unit ${unit} · ${fmtDate(booking.check_in)}`,
        html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111827">
  <h2 style="color:#008737;margin:0 0 4px">A room has just been booked and paid</h2>
  <p style="margin:0 0 20px;color:#6b7280">${esc(p.name)} · Unit ${esc(unit)}${esc(roomType)}</p>

  <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px 20px;margin-bottom:16px">
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${row('Guest', booking.guest_name)}
      ${row('Phone', booking.guest_phone || 'not given')}
      ${row('Email', booking.guest_email || 'not given')}
      ${row('Check-in', `${fmtDate(booking.check_in)}${p.check_in_time ? ' · ' + p.check_in_time : ''}`)}
      ${row('Check-out', `${fmtDate(booking.check_out)}${p.check_out_time ? ' · ' + p.check_out_time : ''}`)}
      ${row('Nights', booking.nights)}
      ${row('Paid', naira(booking.total_amount))}
    </table>
  </div>

  <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin-bottom:16px">
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${row('Property', p.name)}
      ${row('Address', [p.address, p.area, p.city].filter(Boolean).join(', '))}
      ${row('Unit', `${unit}${roomType}`)}
      ${row('Reference', booking.paystack_reference)}
    </table>
  </div>

  ${booking.guest_phone ? `<p style="margin:0 0 20px"><a href="https://wa.me/${String(booking.guest_phone).replace(/[^0-9]/g, '').replace(/^0/, '234')}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">WhatsApp the guest</a>&nbsp;&nbsp;<a href="tel:${esc(booking.guest_phone)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Call</a></p>` : ''}

  <p style="font-size:13px;color:#6b7280">Open it in the CRM: <a href="${crmLink}" style="color:#008737">${crmLink}</a></p>
</div>`,
    });
    if (error) {
        console.error('[notifyTeamNewBooking] Resend error:', error);
        return { sent: false, to, reason: error.message };
    }
    return { sent: true, to };
}

// Guest-facing confirmation with address, check-in instructions and rules.
export async function notifyGuestBookingConfirmed(booking: any): Promise<{ sent: boolean; reason?: string }> {
    const resend = resendClient();
    if (!resend) return { sent: false, reason: 'RESEND_API_KEY not set' };
    const to = booking.guest_email;
    if (!to || to.endsWith('@9jarooms.com') || !to.includes('@')) return { sent: false, reason: 'no guest email' };

    const p = booking.property || {};
    const { error } = await resend.emails.send({
        from: FROM,
        to: [to],
        subject: 'Booking Confirmed - 9jaRooms',
        html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#374151">
  <div style="text-align:center;margin-bottom:30px"><img src="${SITE}/WHITE.jpg" alt="9jaRooms" style="height:60px;width:auto"/></div>
  <h1 style="color:#008737;text-align:center;margin-bottom:24px">Booking Confirmed!</h1>
  <p style="font-size:16px">Hi <strong>${esc(booking.guest_name)}</strong>,</p>
  <p style="font-size:16px">We are excited to host you at <strong>${esc(p.name)}</strong>.</p>
  <div style="background:#f3f4f6;padding:24px;border-radius:12px;margin:24px 0">
    <h3 style="margin-top:0;color:#111827">Booking Details</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#6b7280">Reference</td><td style="padding:8px 0;font-weight:bold;text-align:right">${esc(booking.paystack_reference)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Amount Paid</td><td style="padding:8px 0;font-weight:bold;text-align:right">${naira(booking.total_amount)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Check-in</td><td style="padding:8px 0;font-weight:bold;text-align:right">${fmtDate(booking.check_in)}${p.check_in_time ? ' (' + esc(p.check_in_time) + ')' : ''}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Check-out</td><td style="padding:8px 0;font-weight:bold;text-align:right">${fmtDate(booking.check_out)}${p.check_out_time ? ' (' + esc(p.check_out_time) + ')' : ''}</td></tr>
    </table>
  </div>
  <div style="margin-bottom:24px">
    <h3 style="color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px">📍 Location</h3>
    <p style="margin-top:8px;line-height:1.5;font-size:15px"><strong>${esc(p.name)}</strong><br/>${esc(p.address)}<br/>${esc([p.area, p.city, p.state].filter(Boolean).join(', '))}</p>
  </div>
  ${p.check_in_instructions ? `<div style="margin-bottom:24px"><h3 style="color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px">🔑 Check-in Instructions</h3><div style="background:#fff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;font-size:14px;margin-top:8px;line-height:1.6;white-space:pre-line">${esc(p.check_in_instructions)}</div></div>` : ''}
  ${p.house_rules ? `<div style="margin-bottom:24px"><h3 style="color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px">🏠 House Rules</h3><div style="background:#fff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;font-size:14px;margin-top:8px;line-height:1.6;white-space:pre-line">${esc(p.house_rules)}</div></div>` : ''}
  <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563">
    <p style="margin:0;font-weight:600;color:#111827;font-size:16px">9jaRooms Host</p>
    <p style="margin:0">Need help? Reply to this email.</p>
  </div>
  <div style="text-align:center;margin-top:32px;font-size:12px;color:#9ca3af"><p>&copy; ${new Date().getFullYear()} 9jaRooms. All rights reserved.</p></div>
</div>`,
    });
    if (error) {
        console.error('[notifyGuestBookingConfirmed] Resend error:', error);
        return { sent: false, reason: error.message };
    }
    return { sent: true };
}
