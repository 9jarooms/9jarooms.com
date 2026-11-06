import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { createAdminClient } from '@/lib/supabase/server';
import { reclaim, roomsOfBooking, stayDates, lagosToday, overstayRooms } from '@/lib/booking/hold';
import { pushToAdmins } from '@/lib/push';
import { displayName } from '@/lib/staff-names';

// Booking operations shared by the CRM (/api/crm/*) and the mobile
// operations surface (/api/ops/*). Routes handle auth + scoping and
// delegate here so both sides move dates, take payments and block units
// with exactly the same rules.

type Db = ReturnType<typeof createAdminClient>;

export type OpsResult<T> =
    | { ok: true; status: number; data: T }
    | { ok: false; status: number; error: string; details?: unknown };

function ok<T>(data: T, status = 200): OpsResult<T> {
    return { ok: true, status, data };
}
function fail<T>(error: string, status: number, details?: unknown): OpsResult<T> {
    return { ok: false, status, error, details };
}

export function opsResponse<T>(r: OpsResult<T>) {
    if (r.ok) return NextResponse.json(r.data, { status: r.status });
    return NextResponse.json(
        { error: r.error, ...(r.details ? { details: r.details } : {}) },
        { status: r.status }
    );
}

export function dateRange(checkIn: string, checkOut: string): string[] {
    return stayDates(checkIn, checkOut);
}

// Money received per booking = the payments ledger. Only an old online booking that never got a
// ledger row counts as fully paid by its status.
export async function paidByBooking(supabase: Db, bookings: { id: string; status: string; total_amount: number | string }[]) {
    const ids = bookings.map(b => b.id);
    const { data: payments } = ids.length
        ? await supabase.from('booking_payments').select('booking_id, amount').in('booking_id', ids)
        : { data: [] as { booking_id: string; amount: number }[] };
    const sums: Record<string, number> = {};
    const has = new Set<string>();
    for (const p of payments || []) { sums[p.booking_id] = (sums[p.booking_id] || 0) + Number(p.amount); has.add(p.booking_id); }
    const paid: Record<string, number> = {};
    for (const b of bookings) paid[b.id] = has.has(b.id) ? sums[b.id] : b.status === 'paid' ? Number(b.total_amount) : 0;
    return paid;
}

export async function audit(supabase: Db, actor: string | null | undefined, bookingId: string | null, action: string, detail?: unknown) {
    const { error } = await supabase.from('audit_log').insert({ actor: actor || null, booking_id: bookingId, action, detail: detail ?? null });
    if (error) console.error('[audit] could not log', action, error.message);
}

const nairaText = (x: unknown) => `₦${Math.round(Number(x || 0)).toLocaleString('en-NG')}`;

// A nightly price set or changed, on any screen: it leaves a trail and the owner is told.
// from = null means the price is new (a new room, group or property).
export async function logPrice(supabase: Db, actor: string | null | undefined, what: string, from: number | null, to: number) {
    if (from != null && Number(from) === Number(to)) return;
    await audit(supabase, actor, null, 'price_changed', { what, from: from ?? 0, to });
    await pushToAdmins(supabase, from == null ? 'New price set' : 'Price changed', `${what}: ${from == null ? '' : `${nairaText(from)} → `}${nairaText(to)} a night`, actor);
}

// ------------------------------------------------------------------
// List / search
// ------------------------------------------------------------------
export interface ListBookingsParams {
    q?: string | null;
    status?: string | null;
    propertyId?: string | null;
    // hard scope — a caretaker only ever sees their own properties
    propertyIds?: string[] | null;
    from?: string | null;      // check_in >=
    to?: string | null;        // check_in <=
    outFrom?: string | null;   // check_out >=
    outTo?: string | null;     // check_out <=
    sort?: string | null;      // 'check_in' | 'check_out' | default created_at
    activeOnly?: boolean;
    limit?: number;
}

export async function listBookings(supabase: Db, p: ListBookingsParams): Promise<OpsResult<{ bookings: any[] }>> {
    const limit = Math.min(Number(p.limit || 100), 500);
    const orderCol = p.sort === 'check_in' || p.sort === 'check_out' ? p.sort : 'created_at';

    let query = supabase
        .from('bookings')
        .select('id, guest_name, guest_phone, guest_email, check_in, check_out, nights, status, total_amount, booking_source, created_at, property_id, room_id, room:rooms(unit_code, name), property:properties(id, name), room_type:room_types(name)')
        .order(orderCol, { ascending: orderCol !== 'created_at' })
        .limit(limit);

    if (p.q) {
        // commas / parens would break the PostgREST or() filter
        const q = p.q.replace(/[,()]/g, ' ').trim();
        if (q) query = query.or(`guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%,guest_email.ilike.%${q}%`);
    }
    if (p.status) query = query.eq('status', p.status);
    if (p.activeOnly) query = query.not('status', 'in', '("cancelled","no_show","expired")');
    if (p.propertyId) query = query.eq('property_id', p.propertyId);
    if (p.propertyIds) query = query.in('property_id', p.propertyIds);
    if (p.from) query = query.gte('check_in', p.from);
    if (p.to) query = query.lte('check_in', p.to);
    if (p.outFrom) query = query.gte('check_out', p.outFrom);
    if (p.outTo) query = query.lte('check_out', p.outTo);

    const { data, error } = await query;
    if (error) return fail(error.message, 500);

    const rows = data || [];
    const paid = await paidByBooking(supabase, rows);
    return ok({ bookings: rows.map(b => ({ ...b, paid: paid[b.id] || 0 })) });
}

// ------------------------------------------------------------------
// Detail
// ------------------------------------------------------------------
export async function getBookingDetail(supabase: Db, id: string): Promise<OpsResult<{ booking: any; payments: any[]; paid: number; units: any[]; history: any[] }>> {
    const { data: booking, error } = await supabase
        .from('bookings')
        .select('*, room:rooms(id, name, unit_code, room_type_id), property:properties(id, name)')
        .eq('id', id)
        .single();

    if (error || !booking) return fail('Booking not found', 404);

    const { data: payments } = await supabase
        .from('booking_payments')
        .select('*')
        .eq('booking_id', id)
        .order('created_at');

    const paid = (payments || []).length
        ? (payments || []).reduce((s, p) => s + Number(p.amount), 0)
        : booking.status === 'paid' ? Number(booking.total_amount) : 0;

    // Sibling units of the same property, so the booking can be moved to
    // another unit. Ordered by unit_code (1A, 1B, … 8C for Kaura).
    const { data: units } = await supabase
        .from('rooms')
        .select('id, unit_code, name, room_type_id, is_active')
        .eq('property_id', booking.property_id)
        .eq('is_active', true)
        .order('unit_code');

    const { data: log } = await supabase.from('audit_log').select('at, actor, action, detail').eq('booking_id', id).order('at', { ascending: false }).limit(30);
    const names = new Map<string, string>();
    for (const actor of [...new Set((log || []).map(l => l.actor).filter(Boolean))] as string[]) {
        const { data: u } = await supabase.auth.admin.getUserById(actor);
        names.set(actor, u?.user ? displayName(u.user) : 'someone');
    }
    const history = (log || []).map(l => ({ at: l.at, who: l.actor ? names.get(l.actor) || 'someone' : 'system', action: l.action, detail: l.detail }));
    return ok({ booking, payments: payments || [], paid, units: units || [], history });
}

// ------------------------------------------------------------------
// Update (details, money, stay move/resize, status transitions)
// ------------------------------------------------------------------
export const bookingUpdateSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'paid', 'checked_in', 'completed', 'cancelled', 'no_show']).optional(),
    guestName: z.string().trim().min(2).max(100).optional(),
    guestPhone: z.string().trim().max(20).optional().nullable(),
    guestEmail: z.string().trim().email().optional().nullable().or(z.literal('')),
    guestIdType: z.string().max(40).optional().nullable(),
    guestIdNumber: z.string().max(60).optional().nullable(),
    adults: z.number().int().min(0).max(20).optional(),
    children: z.number().int().min(0).max(20).optional(),
    notes: z.string().max(1000).optional().nullable(),
    bookingSource: z.string().max(40).optional().nullable(),
    totalAmount: z.number().min(0).max(100_000_000).optional(),
    // moving / resizing the stay
    roomId: z.string().uuid().optional(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // the status the person saw: if someone else changed the booking since, refuse instead of overwriting
    expectedStatus: z.string().optional(),
});
export type BookingUpdate = z.infer<typeof bookingUpdateSchema>;

const LIVE_STATUSES = ['pending', 'confirmed', 'paid', 'checked_in'];
const DEAD = ['cancelled', 'no_show', 'expired', 'completed'];
const BOOKING_SOURCES = ['website', 'whatsapp', 'phone', 'walk_in', 'referral', 'booking_com', 'airbnb', 'other', 'caretaker', 'operator', 'maintenance'];

export async function updateBooking(supabase: Db, id: string, body: BookingUpdate, actorId?: string, role?: string): Promise<OpsResult<{ success: true; booking?: any; unchanged?: boolean }>> {
    const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (!booking) return fail('Booking not found', 404);
    if (body.expectedStatus && body.expectedStatus !== booking.status) {
        return fail(`This booking was changed by someone else (it is now ${booking.status.replace('_', ' ')}). Close it and open it again.`, 409);
    }
    // "paid" means Paystack confirmed it; by hand only an admin may say so
    if (body.status === 'paid' && role !== 'admin') return fail('Only online payments mark a booking Paid. Record the payment instead.', 403);
    // a hold comes from a new lock, not by hand (it would reopen an old Paystack link)
    if (body.status === 'pending' && booking.status !== 'pending' && role !== 'admin') return fail('A booking cannot be put back on hold by hand. Make a new lock instead.', 403);

    const update: Record<string, unknown> = {};
    if (body.guestName !== undefined) update.guest_name = body.guestName;
    if (body.guestPhone !== undefined) update.guest_phone = body.guestPhone || null;
    if (body.guestEmail !== undefined) update.guest_email = body.guestEmail || null;
    if (body.guestIdType !== undefined) update.guest_id_type = body.guestIdType || null;
    if (body.guestIdNumber !== undefined) update.guest_id_number = body.guestIdNumber || null;
    if (body.adults !== undefined) update.adults = body.adults;
    if (body.children !== undefined) update.children = body.children;
    if (body.notes !== undefined) update.notes = body.notes;
    const sourceChanged = body.bookingSource !== undefined && (body.bookingSource || 'website') !== (booking.booking_source || 'website');
    if (sourceChanged) {
        // "maintenance" hides a stay from the activity, guest and commission screens: admins only
        if ((body.bookingSource === 'maintenance' || booking.booking_source === 'maintenance') && role !== 'admin') return fail('Only an admin can change a maintenance block into a booking or the other way round.', 403);
        if (!BOOKING_SOURCES.includes(body.bookingSource || 'website')) return fail('Pick where the booking came from', 400);
        update.booking_source = body.bookingSource;
    }
    if (body.totalAmount !== undefined && body.totalAmount !== Number(booking.total_amount)) update.total_amount = body.totalAmount;

    const rooms = await roomsOfBooking(supabase, booking);
    const today = lagosToday();
    let checkIn: string = booking.check_in, checkOut: string = booking.check_out, roomId: string = booking.room_id;

    // --- Stay move / resize (also: checking in before the check-in date starts the stay today) ---
    const earlyCheckIn = body.status === 'checked_in' && booking.status !== 'checked_in' && booking.check_in > today && !body.checkIn;
    const moving = !!(body.roomId && body.roomId !== booking.room_id) || (body.checkIn && body.checkIn !== booking.check_in)
        || (body.checkOut && body.checkOut !== booking.check_out) || earlyCheckIn;
    if (moving) {
        if (DEAD.includes(booking.status)) return fail('This booking is finished. Make a new booking instead.', 409);
        if (body.roomId && body.roomId !== booking.room_id && rooms.length > 1) {
            return fail('This is a whole-flat booking: you can change its dates, but not move it to one room. Cancel and book again to change rooms.', 409);
        }
        roomId = body.roomId || booking.room_id;
        checkIn = earlyCheckIn ? today : body.checkIn || booking.check_in;
        checkOut = body.checkOut || booking.check_out;
        const dates = dateRange(checkIn, checkOut);
        if (dates.length === 0) return fail('Check-out must be after check-in', 400);
        if (role !== 'admin') {
            // the same limits as a new booking: no quiet backdating, no absurd stays
            const earliest = new Date(Date.parse(`${today}T00:00:00Z`) - 2 * 86_400_000).toISOString().slice(0, 10);
            if (body.checkIn && body.checkIn !== booking.check_in && checkIn < earliest) return fail('A stay that started more than 2 days ago can only be entered by an admin.', 403);
            if (dates.length > 365 && dates.length > Number(booking.nights)) return fail('A stay this long can only be entered by an admin.', 403);
        }
        if (roomId !== booking.room_id) {
            const { data: room } = await supabase.from('rooms').select('property_id, is_active, room_type_id').eq('id', roomId).single();
            if (!room || room.property_id !== booking.property_id || room.is_active === false) return fail('That unit is not in this property', 400);
            update.room_type_id = room.room_type_id ?? null;
        }
        const target = rooms.length > 1 ? rooms : [roomId];
        if (dates.includes(today)) {
            const busy = await overstayRooms(supabase, target);
            for (const r of await roomsOfBooking(supabase, booking)) if (booking.status === 'checked_in' && booking.check_out <= today) busy.delete(r);   // that is this guest
            if ([...busy].some(r => target.includes(r))) return fail('A guest is still checked in to that room past their check-out. Check them out (or extend them) first.', 409);
        }
        const conflicts = await reclaim(supabase, id, target, dates, booking.status === 'pending' ? 'held' : 'booked');
        if (conflicts.length > 0) return fail(`Not free on ${conflicts[0].date}: another booking has that night.`, 409);
        if (roomId !== booking.room_id) await supabase.from('booking_rooms').update({ room_id: roomId }).eq('booking_id', id).eq('room_id', booking.room_id);
        update.room_id = roomId; update.check_in = checkIn; update.check_out = checkOut; update.nights = dates.length;
        if (earlyCheckIn && update.total_amount === undefined) {
            // arriving early adds the extra nights at the guest's own nightly rate
            const extra = dateRange(today, booking.check_in).length;
            update.total_amount = Number(booking.total_amount) + extra * Number(booking.price_per_night || 0);
        }
    }

    // --- Status transitions ---
    if (body.status && body.status !== booking.status) {
        update.status = body.status;
        if (body.status === 'checked_in') update.checked_in_at = new Date().toISOString();
        if (body.status === 'completed') {
            update.checked_out_at = new Date().toISOString();
            // leaving early: the nights from tonight on go back on sale
            await supabase.from('availability').delete().eq('booking_id', id).gte('date', today);
        }
        if (body.status === 'cancelled' || body.status === 'no_show') {
            await supabase.from('availability').delete().eq('booking_id', id);
            await audit(supabase, actorId, id, body.status, { from: booking.status });
        }
        if (['confirmed', 'paid', 'checked_in'].includes(body.status) && !LIVE_STATUSES.slice(1).includes(booking.status)) {
            // coming back from a hold, an expired hold, a cancel or a no-show: the nights must be ours again
            const conflicts = await reclaim(supabase, id, rooms.length > 1 ? rooms : [roomId], dateRange(checkIn, checkOut), 'booked');
            if (conflicts.length > 0) return fail(`The room is no longer free on ${conflicts[0].date}: another booking took it. Offer another room or refund.`, 409);
            update.expires_at = null;
        } else if (['confirmed', 'paid', 'checked_in'].includes(body.status)) {
            await supabase.from('availability').update({ status: 'booked' }).eq('booking_id', id).eq('status', 'held');
        }
    }

    // Old online bookings carry no ledger row; once the total or the status moves, write it so the
    // balance is worked out from real money (extra nights then show as owed).
    if (booking.status === 'paid' && (update.status || update.total_amount !== undefined)) {
        const { count } = await supabase.from('booking_payments').select('id', { count: 'exact', head: true }).eq('booking_id', id);
        if (!count) {
            await supabase.from('booking_payments').insert({
                booking_id: id, amount: Number(booking.total_amount), method: 'Paystack', note: 'Paid online', recorded_by: actorId || null,
            });
        }
        if (update.total_amount !== undefined && !update.status) update.status = 'confirmed';
    }

    // the nightly rate always follows the total, so the daily log shows what the guest really pays
    if (update.total_amount !== undefined || update.nights !== undefined) {
        const nights = Number(update.nights ?? booking.nights) || 1;
        update.price_per_night = Math.round(Number(update.total_amount ?? booking.total_amount) / nights);
    }
    // anything that changes the money resets management's commission check
    // (a line management rejected stays rejected: only a verified one goes back for a new check)
    if (booking.created_by && booking.commission_status === 'verified' && (update.total_amount !== undefined || ['cancelled', 'no_show'].includes(String(update.status)))) {
        update.commission_status = null; update.commission_checked_by = null; update.commission_checked_at = null; update.commission_amount = null;
    }
    if (update.total_amount !== undefined) {
        await audit(supabase, actorId, id, 'total_changed', { from: Number(booking.total_amount), to: update.total_amount });
        const before = Number(booking.total_amount), after = Number(update.total_amount);
        const oldRate = before / (Number(booking.nights) || 1), newRate = after / (Number(update.nights ?? booking.nights) || 1);
        // judged per night, so adding one naira to a long extension does not slip past
        if (after < before) await pushToAdmins(supabase, 'Price lowered', `${booking.guest_name}: ${nairaText(before)} → ${nairaText(after)}`, actorId);
        else if (oldRate > 0 && newRate < oldRate * 0.7) await pushToAdmins(supabase, 'Much lower nightly price', `${booking.guest_name}: ${nairaText(oldRate)} → ${nairaText(newRate)} a night`, actorId);
        else if (oldRate > 0 && newRate > oldRate * 1.5) await pushToAdmins(supabase, 'Unusual price on a booking', `${booking.guest_name}: ${nairaText(before)} → ${nairaText(after)}`, actorId);
    }
    if (sourceChanged) await audit(supabase, actorId, id, 'source_changed', { from: booking.booking_source || 'website', to: body.bookingSource });
    if (update.status && !['cancelled', 'no_show'].includes(String(update.status))) {
        await audit(supabase, actorId, id, 'status_changed', { from: booking.status, to: update.status });
        // the room is given over with nothing paid: the owner sees it (part-payments stay in the feed only)
        if (['confirmed', 'checked_in'].includes(String(update.status)) && booking.status !== 'paid' && (await ledgerSum(supabase, id)) <= 0) {
            await pushToAdmins(supabase, update.status === 'checked_in' ? 'Checked in with nothing paid' : 'Confirmed with nothing paid', `${booking.guest_name}: ${nairaText(update.total_amount ?? booking.total_amount)}`, actorId);
        }
    }
    if (moving) {
        await audit(supabase, actorId, id, 'stay_changed', { from: `${booking.check_in} → ${booking.check_out}`, to: `${checkIn} → ${checkOut}`, roomChanged: roomId !== booking.room_id });
        // more nights for the same money is a discount by another name: the owner sees it
        if (update.total_amount === undefined && Number(update.nights ?? booking.nights) > Number(booking.nights)) {
            await pushToAdmins(supabase, 'Stay extended at no extra cost', `${booking.guest_name}: now ${update.nights} nights, total unchanged`, actorId);
        }
    }

    if (Object.keys(update).length === 0) {
        return ok({ success: true, unchanged: true });
    }

    const { data: updated, error } = await supabase
        .from('bookings')
        .update(update)
        .eq('id', id)
        .select()
        .single();

    if (error) return fail(error.message, 500);
    return ok({ success: true, booking: updated });
}

// ------------------------------------------------------------------
// Payments ledger
// ------------------------------------------------------------------
const MANUAL_METHODS = ['Cash', 'Bank Transfer', 'Transfer', 'POS', 'Moniepoint', 'Other', 'Refund'];

export const paymentSchema = z.object({
    amount: z.number().refine(n => n !== 0, 'Amount cannot be 0'),
    method: z.string().max(40).optional().nullable(),
    note: z.string().max(300).optional().nullable(),
    // same id on a retry = the same payment (lost signal, double tap)
    requestId: z.string().max(80).optional(),
    // the bank's reference / session id for a transfer: one transfer can only ever be recorded once
    reference: z.string().trim().max(80).optional().nullable(),
    // optional photo of the receipt (path in the private receipts bucket)
    receiptPath: z.string().max(200).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|pdf)$/i).optional().nullable(),
    // the person saw the warning (more than the balance / looks like a repeat) and wants it anyway
    force: z.boolean().optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export async function recordPayment(supabase: Db, id: string, input: PaymentInput, recordedBy: string, role?: string): Promise<OpsResult<{ success: true; payment: any; paid: number; warning?: string }>> {
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, status, total_amount, room_id, check_in, check_out')
        .eq('id', id)
        .single();
    if (!booking) return fail('Booking not found', 404);

    if (input.amount < 0 && (input.method !== 'Refund' || !['admin', 'customer_rep'].includes(role || ''))) {
        return fail('Only an admin or customer rep can record a refund', 403);
    }
    if (input.method === 'Refund' && input.amount > 0) return fail('A refund is money going out: enter it as a negative amount.', 400);
    if (input.requestId) {
        const { data: same } = await supabase.from('booking_payments').select('*').eq('client_request_id', input.requestId).maybeSingle();
        if (same) return ok({ success: true, payment: same, paid: await ledgerSum(supabase, id) });
    }
    const isRefund = input.method === 'Refund';
    const typed = (input.reference || '').trim();
    if (!input.method) return fail('Pick how it was paid', 400);
    // "Paystack" is only ever written by the server when Paystack itself confirms a payment
    if (!MANUAL_METHODS.includes(input.method)) return fail('Pick how it was paid: Cash, Bank Transfer, POS, Moniepoint or Other', 400);
    // a receipt can only be attached to the booking it was uploaded for
    if (input.receiptPath && !input.receiptPath.startsWith(`${id}/`)) return fail('That receipt belongs to another booking', 400);
    // the reference and the receipt photo are optional. A real reference (some length, with digits)
    // is checked so the same transfer cannot be recorded twice, however it is typed ("123-456" = "123456");
    // anything else is kept as a note.
    const plainRef = typed.replace(/[^a-z0-9]/gi, '').toUpperCase();
    const realRef = plainRef.length >= 6 && /\d/.test(plainRef);
    if (typed && !realRef) input = { ...input, note: [input.note, `Ref: ${typed}`].filter(Boolean).join(' · ') };
    // a refund quotes a reference in its note; only incoming money is checked for repeats
    const reference = isRefund || !realRef ? null : plainRef;
    if (isRefund && typed) input = { ...input, note: [input.note, `Refund ref: ${typed}`].filter(Boolean).join(' · ') };
    if (reference) {
        const { data: used } = await supabase.from('booking_payments').select('booking_id, amount, booking:bookings(guest_name)')
            .ilike('reference', reference.replace(/[%_\\]/g, c => '\\' + c)).maybeSingle();
        if (used) {
            const who = (used as any).booking?.guest_name || 'another booking';
            return fail(`This transfer (reference ${reference}) was already recorded${used.booking_id === id ? ' on this booking' : ` for ${who}`}. One transfer can only be recorded once.`, 409);
        }
    }
    if (['cancelled', 'no_show'].includes(booking.status) && input.amount > 0) {
        return fail('This booking is cancelled. Restore it (or make a new booking) before taking money for it.', 409);
    }


    const { data: rows } = await supabase.from('booking_payments').select('amount, created_at').eq('booking_id', id);
    const already = (rows || []).reduce((t, r) => t + Number(r.amount), 0);
    if (!input.force && input.amount > 0) {
        const recentSame = (rows || []).some(r => Number(r.amount) === input.amount && Date.now() - new Date(r.created_at).getTime() < 10 * 60 * 1000);
        if (recentSame) return fail(`A payment of ₦${input.amount.toLocaleString('en-NG')} was already recorded on this booking in the last 10 minutes. Is this a second, separate payment?`, 409, { warning: 'duplicate' });
        if (already + input.amount > Number(booking.total_amount) + 1) {
            return fail(`This makes ₦${(already + input.amount).toLocaleString('en-NG')} paid on a ₦${Number(booking.total_amount).toLocaleString('en-NG')} stay. Record it anyway?`, 409, { warning: 'overpay' });
        }
    }

    // Money for a hold: the nights must still be ours. If the lock ran out and someone else took
    // the room, say so before any money is written against it.
    if (['pending', 'expired'].includes(booking.status) && input.amount > 0) {
        const rooms = await roomsOfBooking(supabase, booking);
        const conflicts = await reclaim(supabase, id, rooms, dateRange(booking.check_in, booking.check_out), 'booked');
        if (conflicts.length > 0) {
            return fail(`The lock ran out and another guest has booked this room for ${conflicts[0].date}. Do not confirm this guest for this room: offer another room, or refund them.`, 409, { warning: 'lost_room' });
        }
    }

    const { data: payment, error } = await supabase
        .from('booking_payments')
        .insert({
            booking_id: id,
            amount: input.amount,
            method: input.method || null,
            note: input.note || null,
            recorded_by: recordedBy,
            client_request_id: input.requestId || null,
            reference,
            receipt_path: input.receiptPath || null,
        })
        .select()
        .single();

    if (error) {
        if (['pending', 'expired'].includes(booking.status) && input.amount > 0) {
            await supabase.from('availability').update({ status: 'held' }).eq('booking_id', id);
        }
        if (input.requestId && /duplicate|unique/i.test(error.message) && !/reference/i.test(error.message)) {
            const { data: same } = await supabase.from('booking_payments').select('*').eq('client_request_id', input.requestId).maybeSingle();
            return ok({ success: true, payment: same, paid: await ledgerSum(supabase, id) });
        }
        return fail(error.message, 500);
    }

    if (['pending', 'expired'].includes(booking.status) && input.amount > 0) {
        await supabase.from('bookings').update({ status: 'confirmed', expires_at: null }).eq('id', id).in('status', ['pending', 'expired']);
        // the expiry job may have run in the same instant: make sure every night is still ours
        const lost = await reclaim(supabase, id, await roomsOfBooking(supabase, booking), dateRange(booking.check_in, booking.check_out), 'booked');
        if (lost.length) {
            const note = `PAID BUT THE ROOM WAS LOST at the same moment (${lost[0].date}): move the guest or refund.`;
            const { data: cur } = await supabase.from('bookings').select('notes').eq('id', id).single();
            await supabase.from('bookings').update({ notes: [cur?.notes, note].filter(Boolean).join('\n') }).eq('id', id);
            await audit(supabase, recordedBy, id, 'lost_room_after_payment', { date: lost[0].date });
            return fail(`The money is recorded, but another booking took this room for ${lost[0].date} at the same moment. Move the guest to another room or refund them.`, 409, { warning: 'lost_room_after_payment' });
        }
    }
    if (input.amount < 0) await audit(supabase, recordedBy, id, 'refund', { amount: input.amount, note: input.note });
    const { pushPayment } = await import('@/lib/push');
    await pushPayment(supabase, id, input.amount, input.method || null, recordedBy);

    return ok({ success: true, payment, paid: await ledgerSum(supabase, id) });
}

async function ledgerSum(supabase: Db, id: string) {
    const { data } = await supabase.from('booking_payments').select('amount').eq('booking_id', id);
    return (data || []).reduce((s, p) => s + Number(p.amount), 0);
}

export async function deletePayment(supabase: Db, bookingId: string, paymentId: string, actorId?: string): Promise<OpsResult<{ success: true }>> {
    const { data: row } = await supabase.from('booking_payments').select('*').eq('id', paymentId).eq('booking_id', bookingId).maybeSingle();
    if (!row) return fail('Payment not found', 404);
    const { error } = await supabase
        .from('booking_payments')
        .delete()
        .eq('id', paymentId)
        .eq('booking_id', bookingId);
    if (error) return fail(error.message, 500);
    // the money line is gone but never untraceable
    await audit(supabase, actorId, bookingId, 'payment_removed', row);
    await pushToAdmins(supabase, 'Payment removed', `₦${Math.round(Number(row.amount)).toLocaleString('en-NG')} ${row.method || ''} was removed from a booking`, actorId);
    const { data: b } = await supabase.from('bookings').select('created_by, commission_status').eq('id', bookingId).single();
    if (b?.created_by && b.commission_status === 'verified') {
        await supabase.from('bookings').update({ commission_status: null, commission_checked_by: null, commission_checked_at: null, commission_amount: null }).eq('id', bookingId);
    }
    return ok({ success: true });
}

// ------------------------------------------------------------------
// Manual blocks (cleaning / maintenance)
// ------------------------------------------------------------------
export const blockSchema = z.object({
    roomId: z.string().uuid(),
    from: z.string(),
    to: z.string(), // exclusive
    status: z.enum(['cleaning', 'maintenance', 'available']),
});
export type BlockInput = z.infer<typeof blockSchema>;

// Block (or clear) a range of dates on a unit. Never touches dates a
// booking holds.
export async function setBlock(supabase: Db, input: BlockInput, actorId?: string | null): Promise<OpsResult<{ success: true; dates: number }>> {
    const { roomId, from, to, status } = input;
    const dates = dateRange(from, to);
    if (dates.length === 0) return fail('Empty date range', 400);

    const { data: existing } = await supabase
        .from('availability')
        .select('id, date, booking_id, status, booking:bookings(status)')
        .eq('room_id', roomId)
        .in('date', dates);

    // Only a live booking protects its nights. A guest who checked out
    // early (completed) or never came (cancelled / no-show / expired) still
    // owns the cell, and the unit must be blockable for cleaning that day.
    const rows = (existing || []) as unknown as Array<{ id: string; date: string; booking_id: string | null; status: string; booking?: { status: string } | null }>;
    const finished = new Set(['completed', 'cancelled', 'no_show', 'expired']);
    const live = rows.filter(r => r.booking_id && !(r.booking && finished.has(r.booking.status)));
    const bookedDates = live.map(r => r.date);
    if (bookedDates.length > 0 && status !== 'available') {
        return fail(`Dates with bookings cannot be blocked: ${bookedDates.join(', ')}`, 409);
    }
    const stale = rows.filter(r => r.booking_id && r.booking && finished.has(r.booking.status));
    if (stale.length > 0 && status !== 'available') {
        await supabase.from('availability').delete().in('id', stale.map(r => r.id));
    }

    if (status === 'available') {
        // clear manual blocks only — booking-held rows stay
        const { error } = await supabase
            .from('availability')
            .delete()
            .eq('room_id', roomId)
            .in('date', dates)
            .is('booking_id', null);
        if (error) return fail(error.message, 500);
    } else {
        // replace manual blocks, then insert-only: a booking that lands in between keeps its night
        await supabase.from('availability').delete().eq('room_id', roomId).in('date', dates).is('booking_id', null);
        const { error } = await supabase.from('availability').upsert(
            dates.map(date => ({ room_id: roomId, date, status, booking_id: null })),
            { onConflict: 'room_id,date', ignoreDuplicates: true }
        );
        if (error) return fail(error.message, 500);
    }

    // blocks leave a trail: a room taken off sale for days is also how a stay could be hidden
    const { data: unit } = await supabase.from('rooms').select('unit_code, name, property:properties(name)').eq('id', roomId).single();
    const label = `${unit?.unit_code || unit?.name || 'A room'}${(unit as any)?.property?.name ? `, ${(unit as any).property.name}` : ''}`;
    await audit(supabase, actorId, null, status === 'available' ? 'room_unblocked' : 'room_blocked', { room: label, status, from, to, nights: dates.length });
    if (status !== 'available' && (status === 'maintenance' || dates.length >= 3)) {
        await pushToAdmins(supabase, 'Room taken off sale', `${label}: ${status} for ${dates.length} night${dates.length === 1 ? '' : 's'}`, actorId);
    }
    return ok({ success: true, dates: dates.length });
}
