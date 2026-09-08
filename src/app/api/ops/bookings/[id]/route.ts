import { NextRequest, NextResponse } from 'next/server';
import { requireOps, canAccessProperty, type OpsAuth } from '@/lib/auth/require-ops';
import { bookingUpdateSchema, getBookingDetail, updateBooking, opsResponse } from '@/lib/booking/crm-ops';

// Load the booking's property/unit and make sure this user may touch it.
async function loadScoped(auth: OpsAuth, id: string) {
    const { data: booking } = await auth.adminClient
        .from('bookings')
        .select('id, property_id, room_id')
        .eq('id', id)
        .maybeSingle();
    if (!booking) return { error: 'Booking not found', status: 404 } as const;
    if (!canAccessProperty(auth, booking.property_id)) {
        return { error: 'Forbidden: not your property', status: 403 } as const;
    }
    return { booking };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const scoped = await loadScoped(auth, id);
    if ('error' in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });

    return opsResponse(await getBookingDetail(auth.adminClient, id));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const scoped = await loadScoped(auth, id);
    if ('error' in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });

    const parsed = bookingUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    // A unit move must stay inside the same property
    if (parsed.data.roomId && parsed.data.roomId !== scoped.booking.room_id) {
        const { data: room } = await auth.adminClient
            .from('rooms')
            .select('property_id')
            .eq('id', parsed.data.roomId)
            .maybeSingle();
        if (!room || room.property_id !== scoped.booking.property_id) {
            return NextResponse.json({ error: 'That unit belongs to a different property' }, { status: 400 });
        }
    }

    return opsResponse(await updateBooking(auth.adminClient, id, parsed.data, auth.user.id));
}
