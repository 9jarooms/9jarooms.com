import { NextRequest, NextResponse } from 'next/server';
import { requireRoomAccess } from '@/lib/auth/require-room-access';

// Update availability status for a specific room + date
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const roomId = body.roomId as string;
        const date = body.date as string;
        const status = body.status as string;

        if (!roomId || !date || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { adminClient, error: authError, status: authStatus } = await requireRoomAccess(roomId);
        if (authError || !adminClient) return NextResponse.json({ error: authError }, { status: authStatus || 401 });

        const supabase = adminClient;

        const validStatuses = ['available', 'cleaning', 'maintenance'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status. Cannot manually set booked/held.' }, { status: 400 });
        }

        // Check if record exists
        const { data: existing } = await supabase
            .from('availability')
            .select('id, booking_id, status')
            .eq('room_id', roomId)
            .eq('date', date)
            .single();

        // A night a booking owns can only change through that booking
        // (cancel, move, check-out) — otherwise the website would sell it twice.
        if (existing?.booking_id) {
            return NextResponse.json(
                { error: 'This night belongs to a booking. Change the booking instead.' },
                { status: 409 }
            );
        }

        if (existing) {
            const { error } = await supabase
                .from('availability')
                .update({ status })
                .eq('room_id', roomId)
                .eq('date', date);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        } else {
            const { error } = await supabase
                .from('availability')
                .insert({ room_id: roomId, date, status });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Availability update error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
