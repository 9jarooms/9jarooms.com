import type { createAdminClient } from '@/lib/supabase/server';
import { whatsapp } from '@/lib/whatsapp/client';
import { HOLD_MINUTES } from '@/lib/booking/hold';

// WhatsApp alerts for the people on the ground. Caretaker logins use
// internal emails, so email never reaches them; a WhatsApp message does.
//
// Who gets it: the property's caretaker (caretakers.phone) plus every
// number in TEAM_NOTIFY_PHONES (comma separated, e.g. the office line).
//
// Meta only delivers free-form text inside a 24h window after the
// recipient last messaged the business number. Set WHATSAPP_ALERT_TEMPLATE
// to an approved template name (one body parameter) and alerts go out as
// that template instead, which works at any time.

type Db = ReturnType<typeof createAdminClient>;

const TEMPLATE = process.env.WHATSAPP_ALERT_TEMPLATE || '';

function digits(phone: string | null | undefined) {
    if (!phone) return null;
    let d = phone.replace(/[^0-9]/g, '');
    if (!d) return null;
    if (d.startsWith('0')) d = '234' + d.slice(1);
    if (!d.startsWith('234') && d.length === 10) d = '234' + d;
    return d;
}

function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function naira(n: number | string | null | undefined) {
    return '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG');
}

async function recipientsFor(supabase: Db, propertyId: string): Promise<string[]> {
    const set = new Set<string>();
    for (const raw of (process.env.TEAM_NOTIFY_PHONES || '').split(',')) {
        const d = digits(raw.trim());
        if (d) set.add(d);
    }
    const { data: property } = await supabase
        .from('properties')
        .select('caretaker:caretakers(phone)')
        .eq('id', propertyId)
        .maybeSingle();
    const caretaker = (property as unknown as { caretaker?: { phone: string | null } | null } | null)?.caretaker;
    const d = digits(caretaker?.phone);
    if (d) set.add(d);
    return [...set];
}

async function send(to: string[], text: string): Promise<{ sent: number; reason?: string }> {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        return { sent: 0, reason: 'WhatsApp not configured' };
    }
    if (to.length === 0) return { sent: 0, reason: 'no caretaker phone on this property' };
    let sent = 0;
    for (const phone of to) {
        try {
            if (TEMPLATE) {
                await whatsapp.sendTemplate(phone, TEMPLATE, 'en', [
                    { type: 'body', parameters: [{ type: 'text', text }] },
                ]);
            } else {
                await whatsapp.sendMessage(phone, text);
            }
            sent++;
        } catch (e: any) {
            console.warn(`[caretaker alert] ${phone}: ${e?.message || e}`);
        }
    }
    return { sent };
}

async function loadBooking(supabase: Db, bookingId: string) {
    const { data } = await supabase
        .from('bookings')
        .select('id, guest_name, guest_phone, check_in, check_out, nights, total_amount, property_id, booking_source, room:rooms(unit_code, name), property:properties(name)')
        .eq('id', bookingId)
        .maybeSingle();
    return data as unknown as {
        id: string; guest_name: string; guest_phone: string | null; check_in: string; check_out: string;
        nights: number; total_amount: number; property_id: string; booking_source: string | null;
        room?: { unit_code: string | null; name: string } | null; property?: { name: string } | null;
    } | null;
}

function unitOf(b: { room?: { unit_code: string | null; name: string } | null }) {
    return b.room?.unit_code || b.room?.name || 'unit';
}

// A website guest has started paying: the unit is off the market for
// HOLD_MINUTES. Lets the caretaker tell a WhatsApp guest to wait or offer
// another unit.
export async function notifyCaretakersHold(supabase: Db, bookingId: string) {
    const b = await loadBooking(supabase, bookingId);
    if (!b) return { sent: 0, reason: 'booking not found' };
    const text =
        `9jaRooms: ${b.property?.name || 'Property'} ${unitOf(b)} is being paid for on the website ` +
        `(${fmtDate(b.check_in)} to ${fmtDate(b.check_out)}, ${b.nights} night${b.nights === 1 ? '' : 's'}). ` +
        `Please do not give this unit to anyone else for the next ${HOLD_MINUTES} minutes. ` +
        `You will get another message if the payment goes through.`;
    return send(await recipientsFor(supabase, b.property_id), text);
}

// Paid and confirmed: the caretaker should expect this guest.
export async function notifyCaretakersPaid(supabase: Db, bookingId: string) {
    const b = await loadBooking(supabase, bookingId);
    if (!b) return { sent: 0, reason: 'booking not found' };
    const text =
        `9jaRooms: NEW BOOKING, paid. ${b.property?.name || 'Property'} ${unitOf(b)}. ` +
        `Guest ${b.guest_name}${b.guest_phone ? ` (${b.guest_phone})` : ''}, ` +
        `check-in ${fmtDate(b.check_in)}, check-out ${fmtDate(b.check_out)}, ${b.nights} night${b.nights === 1 ? '' : 's'}, ${naira(b.total_amount)}. ` +
        `It is on your Today screen.`;
    return send(await recipientsFor(supabase, b.property_id), text);
}

// Money arrived after the hold had expired and the unit is gone: someone
// has to call the guest and refund or move them.
export async function notifyCaretakersRefundNeeded(supabase: Db, bookingId: string) {
    const b = await loadBooking(supabase, bookingId);
    if (!b) return { sent: 0, reason: 'booking not found' };
    const text =
        `9jaRooms: ATTENTION. ${b.guest_name}${b.guest_phone ? ` (${b.guest_phone})` : ''} paid ${naira(b.total_amount)} ` +
        `for ${b.property?.name || 'Property'} ${unitOf(b)} (${fmtDate(b.check_in)} to ${fmtDate(b.check_out)}) ` +
        `after the hold expired and the unit is no longer free. Please call the guest to offer another unit or a refund.`;
    return send(await recipientsFor(supabase, b.property_id), text);
}
