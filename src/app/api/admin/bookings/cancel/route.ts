import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        // 1. Authenticate - Must be Admin or Operator
        const authResult = await requireAdmin({ allowOperator: true });
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const adminSupabase = createAdminClient();

        // 2. Parse request
        const { bookingId } = await request.json();

        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
        }

        // 3. Fetch booking to ensure it exists and isn't already cancelled
        const { data: booking, error: fetchError } = await adminSupabase
            .from('bookings')
            .select('id, status')
            .eq('id', bookingId)
            .single();

        if (fetchError || !booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        if (booking.status === 'cancelled') {
            return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 });
        }

        // 4. Free every availability cell this booking claimed — covers all rooms,
        // including a 2-bed bundle's locked (held-empty) room.
        const { error: availError } = await adminSupabase
            .from('availability')
            .delete()
            .eq('booking_id', bookingId);

        if (availError) {
            return NextResponse.json({ error: availError.message }, { status: 500 });
        }

        // 5. Mark the booking cancelled
        const { error: updateError } = await adminSupabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Cancel Booking API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
