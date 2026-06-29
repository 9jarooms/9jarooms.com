import { NextRequest, NextResponse } from 'next/server';
import { addDays, format } from 'date-fns';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import type { RoomLite } from '@/lib/booking/options';

// Get availability for a room
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    // Apartment-availability mode: when propertyId is present, return the bookable
    // map (active rooms + unavailable cells) for the option chooser.
    if (searchParams.get('propertyId')) {
        return getApartmentAvailability(searchParams);
    }

    try {
        const supabase = await createServerClient();

        const roomId = searchParams.get('roomId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!roomId) {
            return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
        }

        let query = supabase
            .from('availability')
            .select('*')
            .eq('room_id', roomId)
            .order('date', { ascending: true });

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ availability: data || [] });
    } catch (error) {
        console.error('Availability fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
    }
}

// Apartment-availability mode: returns the property's active rooms plus the set of
// `${room_id}|${date}` cells that are NOT bookable over [from, to), so the option
// chooser can compute which booking options are available.
async function getApartmentAvailability(searchParams: URLSearchParams) {
    try {
        const propertyId = searchParams.get('propertyId');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        if (!propertyId || !from || !to) {
            return NextResponse.json(
                { error: 'propertyId, from and to are required' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        const { data: roomsData, error: roomsError } = await supabase
            .from('rooms')
            .select('id, name, room_type, price_per_night')
            .eq('property_id', propertyId)
            .eq('is_active', true);

        if (roomsError) {
            return NextResponse.json({ error: roomsError.message }, { status: 500 });
        }

        const rooms: RoomLite[] = roomsData || [];
        const roomIds = rooms.map((r) => r.id);

        if (roomIds.length === 0) {
            return NextResponse.json({ rooms, unavailable: [] });
        }

        // Build the date range [from, to): from through the day before to.
        const dates: string[] = [];
        let current = new Date(from);
        const end = new Date(to);
        while (current < end) {
            dates.push(format(current, 'yyyy-MM-dd'));
            current = addDays(current, 1);
        }
        const dateSet = new Set(dates);

        const { data: rawAvailability, error: availError } = await supabase
            .from('availability')
            .select('*, booking:bookings(expires_at)')
            .in('room_id', roomIds)
            .gte('date', from)
            .lt('date', to);

        if (availError) {
            return NextResponse.json({ error: availError.message }, { status: 500 });
        }

        // Mirror property page: expired holds are treated as available.
        const now = new Date();
        const unavailable: string[] = [];
        for (const slot of (rawAvailability || []) as Array<{
            room_id: string;
            date: string;
            status: string;
            booking?: { expires_at: string | null } | null;
        }>) {
            if (!dateSet.has(slot.date)) continue;

            let blocked = false;
            if (slot.status === 'booked' || slot.status === 'cleaning' || slot.status === 'maintenance') {
                blocked = true;
            } else if (slot.status === 'held') {
                const expiresAt = slot.booking?.expires_at ? new Date(slot.booking.expires_at) : null;
                // Active hold (no expiry or expiry in the future) blocks; expired hold is available.
                if (!expiresAt || expiresAt >= now) {
                    blocked = true;
                }
            }

            if (blocked) {
                unavailable.push(`${slot.room_id}|${slot.date}`);
            }
        }

        return NextResponse.json({ rooms, unavailable });
    } catch (error) {
        console.error('Apartment availability fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
    }
}
