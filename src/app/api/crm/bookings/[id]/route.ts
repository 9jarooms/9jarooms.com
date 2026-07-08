import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { addDays, format } from 'date-fns';
import { z } from 'zod';

const updateSchema = z.object({
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

function dateRange(checkIn: string, checkOut: string): string[] {
    const dates: string[] = [];
    let current = new Date(checkIn);
    const end = new Date(checkOut);
    while (current < end) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }
    return dates;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const { id } = await params;

    const { data: booking, error } = await supabase
        .from('bookings')
        .select('*, room:rooms(id, name, unit_code, room_type_id), property:properties(id, name)')
        .eq('id', id)
        .single();

    if (error || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const { data: payments } = await supabase
        .from('booking_payments')
        .select('*')
        .eq('booking_id', id)
        .order('created_at');

    const paid = booking.status === 'paid'
        ? Number(booking.total_amount)
        : (payments || []).reduce((s, p) => s + Number(p.amount), 0);

    return NextResponse.json({ booking, payments: payments || [], paid });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const { id } = await params;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }
    const body = parsed.data;

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

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
            return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 });
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
            return NextResponse.json(
                { error: `Unit is not free on ${conflict.date}` },
                { status: 409 }
            );
        }

        // Release everything this booking held, then claim the new range.
        await supabase.from('availability').delete().eq('booking_id', id);
        const status = booking.status === 'pending' ? 'held' : 'booked';
        const { error: claimError } = await supabase.from('availability').upsert(
            newDates.map(date => ({ room_id: newRoomId, date, status, booking_id: id })),
            { onConflict: 'room_id,date' }
        );
        if (claimError) {
            return NextResponse.json({ error: claimError.message }, { status: 500 });
        }

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
                return NextResponse.json(
                    { error: `Cannot restore: unit already taken on ${conflict.date}` },
                    { status: 409 }
                );
            }
            await supabase.from('availability').upsert(
                dates.map(date => ({ room_id: roomForClaim, date, status: 'booked', booking_id: id })),
                { onConflict: 'room_id,date' }
            );
            update.expires_at = null;
        }
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ success: true, unchanged: true });
    }

    const { data: updated, error } = await supabase
        .from('bookings')
        .update(update)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, booking: updated });
}
