import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { confirmPaidBooking, notifyTeamNewBooking, notifyGuestBookingConfirmed } from '@/lib/booking/payment-confirmed';

export async function POST(request: Request) {
    try {
        // 1. Authenticate - Must be Admin or Operator
        const authResult = await requireAdmin({ allowOperator: true }); 
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { user } = authResult;
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
        }

        const adminSupabase = createAdminClient();

        // 2. Parse request
        const { bookingId } = await request.json();

        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
        }

        // 3. Fetch booking to ensure it exists and we have the total amount
        const { data: booking, error: fetchError } = await adminSupabase
            .from('bookings')
            .select('id, total_amount, status, paystack_reference')
            .eq('id', bookingId)
            .single();

        if (fetchError || !booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        if (booking.status === 'paid') {
            return NextResponse.json({ error: 'Booking is already marked as paid' }, { status: 400 });
        }

        // 4. Generate a mock Paystack reference for manual tracking
        // Or reuse existing if they had tried to pay online but failed
        const reference = booking.paystack_reference || `manual_${Date.now()}`;
        const amountInKobo = booking.total_amount * 100;

        // 5. Same path as the Paystack webhook, run right here (the old
        // Inngest hand-off never executes in production, so nothing happened).
        const { booking: confirmed, alreadyPaid, attention } = await confirmPaidBooking(adminSupabase, {
            reference,
            bookingId: booking.id,
            amountKobo: amountInKobo,
            raw: { channel: 'manual', status: 'success', reference, amount: amountInKobo, confirmed_by: user.id },
        });
        if (!alreadyPaid) {
            await Promise.all([
                notifyTeamNewBooking(adminSupabase, confirmed, attention),
                notifyGuestBookingConfirmed(confirmed),
            ]);
        }

        return NextResponse.json({
            success: true,
            attention: attention || null,
            message: attention ? `Payment recorded, but: ${attention}` : 'Payment confirmed.'
        });

    } catch (error: any) {
        console.error('[Manual Confirm API Error]:', error);
        try {
            require('fs').writeFileSync('/tmp/err.log', error.stack || error.message);
        } catch(e) {}
        return NextResponse.json(
            { error: error.message || 'Internal server error', stack: error.stack },
            { status: 500 }
        );
    }
}
