import { NextResponse } from 'next/server';
import { addDays, format } from 'date-fns';
import { z } from 'zod';
import type { createAdminClient } from '@/lib/supabase/server';

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
    const dates: string[] = [];
    let current = new Date(checkIn);
    const end = new Date(checkOut);
    while (current < end) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }
    return dates;
}

// Sum of recorded payments per booking. Bookings paid online (status
// 'paid') carry no ledger rows, so they count as fully paid.
export async function paidByBooking(supabase: Db, bookings: { id: string; status: string; total_amount: number | string }[]) {
    const ids = bookings.map(b => b.id);
    const { data: payments } = ids.length
        ? await supabase.from('booking_payments').select('booking_id, amount').in('booking_id', ids)
        : { data: [] as { booking_id: string; amount: number }[] };
    const sums: Record<string, number> = {};
    for (const p of payments || []) sums[p.booking_id] = (sums[p.booking_id] || 0) + Number(p.amount);
    const paid: Record<string, number> = {};
    for (const b of bookings) paid[b.id] = b.status === 'paid' ? Number(b.total_amount) : (sums[b.id] || 0);
    return paid;
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
export async function getBookingDetail(supabase: Db, id: string): Promise<OpsResult<{ booking: any; payments: any[]; paid: number; units: any[] }>> {
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

    const paid = booking.status === 'paid'
        ? Number(booking.total_amount)
        : (payments || []).reduce((s, p) => s + Number(p.amount), 0);

    // Sibling units of the same property, so the booking can be moved to
    // another unit. Ordered by unit_code (1A, 1B, … 8C for Kaura).
    const { data: units } = await supabase
        .from('rooms')
        .select('id, unit_code, name, room_type_id, is_active')
        .eq('property_id', booking.property_id)
        .eq('is_active', true)
        .order('unit_code');

    return ok({ booking, payments: payments || [], paid, units: units || [] });
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
    totalAmount: z.number().min(0).optional(),
    // moving / resizing the stay
    roomId: z.string().uuid().optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
});
export type BookingUpdate = z.infer<typeof bookingUpdateSchema>;

export async function updateBooking(supabase: Db, id: string, body: BookingUpdate, actorId?: string): Promise<OpsResult<{ success: true; booking?: any; unchanged?: boolean }>> {
    const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (!booking) return fail('Booking not found', 404);

    const update: Record<string, unknown> = {};
    if (body.guestName !== undefined) update.guest_name = body.guestName;
    if (body.guestPhone !== undefined) update.guest_phone = body.guestPhone || null;
    if (body.guestEmail !== undefined) update.guest_email = body.guestEmail || null;
    if (body.guestIdType !== undefined) update.guest_id_type = body.guestIdType || null;
    if (body.guestIdNumber !== undefined) update.guest_id_number = body.guestIdNumber || null;
    if (body.adults !== undefined) update.adults = body.adults;
    if (body.children !== undefined) update.children = body.children;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.bookingSource !== undefined) update.booking_source = body.bookingSource;
    if (body.totalAmount !== undefined) update.total_amount = body.totalAmount;

    // --- Stay move / resize: release old dates, atomically claim new ones ---
    const moving = body.roomId || body.checkIn || body.checkOut;
    if (moving) {
        const newRoomId = body.roomId || booking.room_id;
        const newCheckIn = body.checkIn || booking.check_in;
        const newCheckOut = body.checkOut || booking.check_out;
        const newDates = dateRange(newCheckIn, newCheckOut);
        if (newDates.length === 0) {
            return fail('Check-out must be after check-in', 400);
        }

        // Conflicts: any non-available cell on the target unit/dates that
        // doesn't already belong to this booking.
        const { data: clashes } = await supabase
            .from('availability')
            .select('date, booking_id, status')
            .eq('room_id', newRoomId)
            .in('date', newDates)
            .neq('status', 'available');

        const conflict = (clashes || []).find(c => c.booking_id !== id);
        if (conflict) {
            return fail(`Unit is not free on ${conflict.date}`, 409);
        }

        // Release everything this booking held, then claim the new range.
        await supabase.from('availability').delete().eq('booking_id', id);
        const status = booking.status === 'pending' ? 'held' : 'booked';
        const { error: claimError } = await supabase.from('availability').upsert(
            newDates.map(date => ({ room_id: newRoomId, date, status, booking_id: id })),
            { onConflict: 'room_id,date' }
        );
        if (claimError) return fail(claimError.message, 500);

        update.room_id = newRoomId;
        update.check_in = newCheckIn;
        update.check_out = newCheckOut;
        update.nights = newDates.length;

        // keep room_type_id in sync when the unit changes
        if (newRoomId !== booking.room_id) {
            const { data: room } = await supabase.from('rooms').select('room_type_id').eq('id', newRoomId).single();
            update.room_type_id = room?.room_type_id ?? null;
        }
        await supabase.from('booking_rooms').update({ room_id: newRoomId }).eq('booking_id', id);
    }

    // --- Status transitions ---
    if (body.status && body.status !== booking.status) {
        update.status = body.status;
        if (body.status === 'checked_in') update.checked_in_at = new Date().toISOString();
        if (body.status === 'completed') update.checked_out_at = new Date().toISOString();
        if (body.status === 'cancelled' || body.status === 'no_show') {
            // release the dates so the unit is sellable again
            await supabase.from('availability').delete().eq('booking_id', id);
        }
        if (['confirmed', 'paid', 'checked_in'].includes(body.status) &&
            ['cancelled', 'no_show', 'pending'].includes(booking.status)) {
            // (re)claim dates as solid bookings
            const dates = dateRange(
                (update.check_in as string) || booking.check_in,
                (update.check_out as string) || booking.check_out
            );
            const roomForClaim = (update.room_id as string) || booking.room_id;
            const { data: clashes } = await supabase
                .from('availability')
                .select('date, booking_id')
                .eq('room_id', roomForClaim)
                .in('date', dates)
                .neq('status', 'available');
            const conflict = (clashes || []).find(c => c.booking_id !== id);
            if (conflict) {
                return fail(`Cannot restore: unit already taken on ${conflict.date}`, 409);
            }
            await supabase.from('availability').upsert(
                dates.map(date => ({ room_id: roomForClaim, date, status: 'booked', booking_id: id })),
                { onConflict: 'room_id,date' }
            );
            update.expires_at = null;
        }

        // Online (Paystack) payments never write a ledger row — "paid" is
        // implied by the status. Leaving that status (check-in, check-out…)
        // would make the guest look like they owe everything, so record the
        // online payment in the ledger once before the status moves on.
        if (booking.status === 'paid') {
            const { count } = await supabase
                .from('booking_payments')
                .select('id', { count: 'exact', head: true })
                .eq('booking_id', id);
            if (!count) {
                await supabase.from('booking_payments').insert({
                    booking_id: id,
                    amount: Number(booking.total_amount),
                    method: 'Paystack',
                    note: 'Paid online',
                    recorded_by: actorId || null,
                });
            }
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
export const paymentSchema = z.object({
    amount: z.number().positive(),
    method: z.string().max(40).optional().nullable(),
    note: z.string().max(300).optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export async function recordPayment(supabase: Db, id: string, input: PaymentInput, recordedBy: string): Promise<OpsResult<{ success: true; payment: any; paid: number }>> {
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, status, total_amount')
        .eq('id', id)
        .single();
    if (!booking) return fail('Booking not found', 404);

    const { data: payment, error } = await supabase
        .from('booking_payments')
        .insert({
            booking_id: id,
            amount: input.amount,
            method: input.method || null,
            note: input.note || null,
            recorded_by: recordedBy,
        })
        .select()
        .single();

    if (error) return fail(error.message, 500);

    // A pending booking with money against it becomes confirmed
    if (booking.status === 'pending') {
        await supabase.from('bookings')
            .update({ status: 'confirmed', expires_at: null })
            .eq('id', id);
    }

    const { data: payments } = await supabase
        .from('booking_payments')
        .select('amount')
        .eq('booking_id', id);
    const paid = (payments || []).reduce((s, p) => s + Number(p.amount), 0);

    return ok({ success: true, payment, paid });
}

export async function deletePayment(supabase: Db, bookingId: string, paymentId: string): Promise<OpsResult<{ success: true }>> {
    const { error } = await supabase
        .from('booking_payments')
        .delete()
        .eq('id', paymentId)
        .eq('booking_id', bookingId);
    if (error) return fail(error.message, 500);
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
export async function setBlock(supabase: Db, input: BlockInput): Promise<OpsResult<{ success: true; dates: number }>> {
    const { roomId, from, to, status } = input;
    const dates = dateRange(from, to);
    if (dates.length === 0) return fail('Empty date range', 400);

    const { data: existing } = await supabase
        .from('availability')
        .select('date, booking_id, status')
        .eq('room_id', roomId)
        .in('date', dates);

    const bookedDates = (existing || []).filter(r => r.booking_id).map(r => r.date);
    if (bookedDates.length > 0 && status !== 'available') {
        return fail(`Dates with bookings cannot be blocked: ${bookedDates.join(', ')}`, 409);
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
        const { error } = await supabase.from('availability').upsert(
            dates.map(date => ({ room_id: roomId, date, status, booking_id: null })),
            { onConflict: 'room_id,date' }
        );
        if (error) return fail(error.message, 500);
    }

    return ok({ success: true, dates: dates.length });
}
