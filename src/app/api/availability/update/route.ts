import { NextRequest, NextResponse } from 'next/server';
import { requireRoomAccess } from '@/lib/auth/require-room-access';
import { setBlock } from '@/lib/booking/crm-ops';

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

        // One night at a time through the same rule as every other block: a night that belongs to a
        // booking is never overwritten (that used to free booked nights and allow double bookings).
        const next = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + 1)).toISOString().slice(0, 10);
        const r = await setBlock(supabase, { roomId, from: date, to: next, status: status as 'available' | 'cleaning' | 'maintenance' });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Availability update error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
